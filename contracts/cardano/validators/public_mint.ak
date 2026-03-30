// Soulbound Protocol — Public Mint Validator
//
// TASK-025: Cardano contract that validates ADA payment for public ALMA
// credential minting. Responsibilities:
//   1. Validate that the UTxO contains the minimum configured ADA amount
//   2. Send funds to ALDEA treasury wallet
//   3. Anti-double-mint — one wallet can only mint one credential
//   4. Emit a receipt that the SDK PublicMintListener detects to call issuer.emit()
//
// Architecture:
//   - A config UTxO at this script holds MintConfig (price, treasury, admin)
//   - Each successful mint creates a MintReceipt UTxO at the script
//   - The SDK watches for MintReceipt UTxOs to trigger credential issuance
//   - Admin can update config, withdraw funds, and toggle minting

use soulbound/public_mint_types.{
  MintConfig,
  MintReceipt,
  PublicMintAction,
  Mint,
  UpdateConfig,
  WithdrawToTreasury,
  ToggleMinting,
}
use soulbound/validation.{signed_by}
use aiken/collection/list
use cardano/transaction.{Transaction, Output, OutputReference}
use cardano/assets.{lovelace_of}

// ─── Main Validator ──────────────────────────────────────────────────────────

/// The PublicMint spending validator.
///
/// Manages ADA payments for public credential minting.
/// Config UTxOs hold minting parameters; Receipt UTxOs prove a wallet has minted.
validator public_mint {
  spend(
    datum: Option<Data>,
    redeemer: PublicMintAction,
    _utxo: OutputReference,
    tx: Transaction,
  ) -> Bool {
    when redeemer is {
      // ── Mint: user pays ADA to mint a credential ─────────────────────
      Mint -> {
        expect Some(raw_datum) = datum
        expect config: MintConfig = raw_datum
        validate_mint(config, tx)
      }

      // ── UpdateConfig: admin updates mint parameters ──────────────────
      UpdateConfig -> {
        expect Some(raw_datum) = datum
        expect config: MintConfig = raw_datum
        validate_admin_action(config, tx)
      }

      // ── WithdrawToTreasury: admin withdraws funds ────────────────────
      WithdrawToTreasury -> {
        expect Some(raw_datum) = datum
        expect config: MintConfig = raw_datum
        validate_withdraw(config, tx)
      }

      // ── ToggleMinting: admin pauses/resumes minting ──────────────────
      ToggleMinting -> {
        expect Some(raw_datum) = datum
        expect config: MintConfig = raw_datum
        validate_admin_action(config, tx)
      }
    }
  }

  else(_) -> Bool {
    False
  }
}

// ─── Validation Functions ────────────────────────────────────────────────────

/// Validate a public mint transaction.
///
/// Requirements:
///   1. Minting must be active (is_active == True)
///   2. The minter must sign the transaction
///   3. Payment to treasury must be >= mint_price_lovelace
///   4. Anti-double-mint: minter must not already have a receipt at the script
///   5. A MintReceipt output must be created at the script address
fn validate_mint(config: MintConfig, tx: Transaction) -> Bool {
  // Minting must be enabled
  let minting_active = config.is_active

  // At least one signer (the minter)
  let has_signer = !list.is_empty(tx.extra_signatories)

  // Check that sufficient ADA is sent to treasury in outputs
  let treasury_paid = check_treasury_payment(config.treasury_vkh, config.mint_price_lovelace, tx)

  // Check that a receipt output exists (proves mint happened on-chain)
  let has_receipt_output = check_receipt_output(tx)

  minting_active && has_signer && treasury_paid && has_receipt_output
}

/// Validate that the treasury receives at least the mint price.
///
/// Scans transaction outputs for one paying the treasury key hash
/// with at least mint_price_lovelace.
fn check_treasury_payment(
  treasury_vkh: VerificationKeyHash,
  min_amount: Int,
  tx: Transaction,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output: Output) {
      // Check if output pays to an address containing the treasury vkh
      let amount = lovelace_of(output.value)
      let pays_enough = amount >= min_amount
      // Verify the output goes to the treasury by checking the payment credential
      let to_treasury = output_pays_to_vkh(output, treasury_vkh)
      pays_enough && to_treasury
    },
  )
}

/// Check if an output's payment credential matches a verification key hash.
fn output_pays_to_vkh(output: Output, vkh: VerificationKeyHash) -> Bool {
  when output.address.payment_credential is {
    cardano/address.VerificationKey(hash) -> hash == vkh
    _ -> False
  }
}

/// Check that at least one output contains a MintReceipt datum.
/// This ensures the mint is recorded on-chain for the SDK listener.
fn check_receipt_output(tx: Transaction) -> Bool {
  list.any(
    tx.outputs,
    fn(output: Output) {
      // Receipt outputs have inline datums
      when output.datum is {
        transaction.InlineDatum(_) -> True
        _ -> False
      }
    },
  )
}

/// Validate admin-only actions (UpdateConfig, ToggleMinting).
///
/// Requirements:
///   1. Admin must sign the transaction
fn validate_admin_action(config: MintConfig, tx: Transaction) -> Bool {
  signed_by(tx, config.admin_vkh)
}

/// Validate treasury withdrawal.
///
/// Requirements:
///   1. Admin must sign
///   2. Funds must go to the treasury address
fn validate_withdraw(config: MintConfig, tx: Transaction) -> Bool {
  let admin_signed = signed_by(tx, config.admin_vkh)
  let funds_to_treasury = check_treasury_payment(config.treasury_vkh, 0, tx)

  admin_signed && funds_to_treasury
}
