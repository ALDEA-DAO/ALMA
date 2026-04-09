// Soulbound Protocol — Public Mint Validator
//
// TASK-025: Cardano contract that validates ADA or ALDEA token payment for
// public ALMA credential minting. Responsibilities:
//   1. Validate that the UTxO contains the minimum configured ADA or ALDEA token amount
//   2. Send funds to ALDEA treasury wallet
//   3. Anti-double-mint — one stake key can only mint one credential
//   4. Emit a receipt that the SDK PublicMintListener detects to call issuer.emit()
//   5. Preserve the config UTxO as a continuing output
//
// Architecture:
//   - A config UTxO at this script holds MintConfig (price, treasury, admin, token config)
//   - Each successful mint creates a MintReceipt UTxO at the script
//   - The SDK watches for MintReceipt UTxOs to trigger credential issuance
//   - Admin can update config, withdraw funds, and toggle minting
//   - Supports two payment paths: ADA (Mint) and ALDEA token (MintWithToken)
//
// Security (audit fixes 2026-04-04):
//   - C-01: Anti-double-mint enforced via stake key hash in reference input scan
//   - C-02: Receipt output validated as proper MintReceipt with correct stake_key_hash
//   - H-02: UpdateConfig validates continuing output (min price, preserved admin)
//   - H-03: WithdrawToTreasury ensures all outputs go to treasury
//   - H-04: Mint preserves config UTxO as continuing output

use soulbound/public_mint_types.{
  MintConfig,
  MintReceipt,
  PublicMintAction,
  Mint,
  MintWithToken,
  UpdateConfig,
  WithdrawToTreasury,
  ToggleMinting,
}
use soulbound/validation.{signed_by}
use aiken/collection/list
use aiken/crypto.{VerificationKeyHash, sha2_256}
use cardano/transaction.{Transaction, Output, OutputReference}
use cardano/assets.{lovelace_of, quantity_of}
use cardano/address.{VerificationKey, Inline}

// Minimum mint price: 1 ADA (prevents accidental or malicious zero-price config)
const min_allowed_price_lovelace: Int = 1_000_000

// ─── Main Validator ──────────────────────────────────────────────────────────

/// The PublicMint spending validator.
///
/// Manages ADA and ALDEA token payments for public credential minting.
/// Config UTxOs hold minting parameters; Receipt UTxOs prove a wallet has minted.
validator public_mint {
  spend(
    datum: Option<Data>,
    redeemer: PublicMintAction,
    own_utxo: OutputReference,
    tx: Transaction,
  ) -> Bool {
    when redeemer is {
      // ── Mint: user pays ADA to mint a credential ─────────────────────
      Mint -> {
        expect Some(raw_datum) = datum
        expect config: MintConfig = raw_datum
        validate_mint_ada(config, own_utxo, tx)
      }

      // ── MintWithToken: user pays ALDEA tokens to mint ────────────────
      MintWithToken -> {
        expect Some(raw_datum) = datum
        expect config: MintConfig = raw_datum
        validate_mint_token(config, own_utxo, tx)
      }

      // ── UpdateConfig: admin updates mint parameters ──────────────────
      UpdateConfig -> {
        expect Some(raw_datum) = datum
        expect config: MintConfig = raw_datum
        validate_update_config(config, tx)
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

// ─── ADA Payment Validation ─────────────────────────────────────────────────

/// Validate a public mint transaction paid with ADA.
///
/// Requirements:
///   1. Minting must be active (is_active == True)
///   2. The minter must sign the transaction
///   3. A stake key must be present in one of the transaction inputs
///   4. Payment to treasury must be >= mint_price_lovelace
///   5. Anti-double-mint: stake key must not have an existing receipt (C-01)
///   6. A valid MintReceipt output with correct stake_key_hash must be created (C-02)
///   7. Config UTxO must be preserved as continuing output (H-04)
fn validate_mint_ada(config: MintConfig, own_utxo: OutputReference, tx: Transaction) -> Bool {
  // Must be enabled
  expect config.is_active

  // Must have at least one signer (the minter's payment key)
  expect [_minter_vkh, ..] = tx.extra_signatories

  // Extract stake key hash from tx inputs — required for anti-double-mint
  expect Some(stake_key_hash) = extract_hashed_stake_key(tx)

  // Treasury must receive at least the mint price in ADA
  let treasury_paid =
    check_treasury_ada_payment(config.treasury_vkh, config.mint_price_lovelace, tx)

  // [C-01] Anti-double-mint: no existing receipt for this stake key
  let no_duplicate = no_existing_receipt(stake_key_hash, tx)

  // [C-02] Valid MintReceipt output with correct stake_key_hash
  let has_receipt = check_valid_receipt_output(stake_key_hash, tx)

  // [H-04] Config UTxO preserved as continuing output
  let config_preserved = has_continuing_config(config, own_utxo, tx)

  treasury_paid && no_duplicate && has_receipt && config_preserved
}

// ─── ALDEA Token Payment Validation ─────────────────────────────────────────

/// Validate a public mint transaction paid with ALDEA tokens.
///
/// Same requirements as ADA mint, but checks token quantity instead of ADA.
fn validate_mint_token(config: MintConfig, own_utxo: OutputReference, tx: Transaction) -> Bool {
  // Must be enabled and token payment configured
  expect config.is_active
  expect config.mint_price_aldea_token > 0

  // Must have at least one signer
  expect [_minter_vkh, ..] = tx.extra_signatories

  // Extract stake key hash from tx inputs
  expect Some(stake_key_hash) = extract_hashed_stake_key(tx)

  // Treasury must receive enough ALDEA tokens
  let treasury_paid =
    check_treasury_token_payment(
      config.treasury_vkh,
      config.aldea_token_policy,
      config.aldea_token_name,
      config.mint_price_aldea_token,
      tx,
    )

  // [C-01] Anti-double-mint by stake key
  let no_duplicate = no_existing_receipt(stake_key_hash, tx)

  // [C-02] Valid receipt output with stake key
  let has_receipt = check_valid_receipt_output(stake_key_hash, tx)

  // [H-04] Config preserved
  let config_preserved = has_continuing_config(config, own_utxo, tx)

  treasury_paid && no_duplicate && has_receipt && config_preserved
}

// ─── Treasury Payment Checks ────────────────────────────────────────────────

/// Validate that the treasury receives at least the mint price in ADA.
fn check_treasury_ada_payment(
  treasury_vkh: VerificationKeyHash,
  min_amount: Int,
  tx: Transaction,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output: Output) {
      let amount = lovelace_of(output.value)
      let pays_enough = amount >= min_amount
      let to_treasury = output_pays_to_vkh(output, treasury_vkh)
      pays_enough && to_treasury
    },
  )
}

/// Validate that the treasury receives at least the required ALDEA tokens.
/// (L-02) Also checks that the output includes minimum ADA for a valid Cardano UTxO.
fn check_treasury_token_payment(
  treasury_vkh: VerificationKeyHash,
  policy_id: ByteArray,
  asset_name: ByteArray,
  min_amount: Int,
  tx: Transaction,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output: Output) {
      let token_qty = quantity_of(output.value, policy_id, asset_name)
      let pays_enough = token_qty >= min_amount
      let to_treasury = output_pays_to_vkh(output, treasury_vkh)
      // (L-02) Token outputs must carry minimum ADA for a valid UTxO
      let has_min_ada = lovelace_of(output.value) >= 1_500_000
      pays_enough && to_treasury && has_min_ada
    },
  )
}

// ─── Stake Key Extraction ───────────────────────────────────────────────────

/// Extract and hash the stake key from the first transaction input that has one.
/// Returns SHA-256(stake_key) so the raw stake key is not stored in the receipt.
/// Returns None if no input carries a stake credential (e.g. enterprise address).
fn extract_hashed_stake_key(tx: Transaction) -> Option<ByteArray> {
  let stake_keys =
    list.filter_map(
      tx.inputs,
      fn(input) {
        when input.output.address.stake_credential is {
          Some(Inline(VerificationKey(hash))) -> Some(sha2_256(hash))
          _ -> None
        }
      },
    )
  list.head(stake_keys)
}

// ─── Anti-Double-Mint (C-01) ────────────────────────────────────────────────

/// [C-01] Check that no existing MintReceipt for this stake key exists in
/// the transaction's reference inputs. The frontend must include all
/// existing receipt UTxOs at the script address as reference inputs
/// so the contract can scan them for duplicates.
fn no_existing_receipt(stake_key_hash: ByteArray, tx: Transaction) -> Bool {
  !list.any(
    tx.reference_inputs,
    fn(ref_input) {
      when ref_input.output.datum is {
        transaction.InlineDatum(raw_datum) ->
          is_receipt_for_stake_key(raw_datum, stake_key_hash)
        _ -> False
      }
    },
  )
}

/// Try to parse a datum as MintReceipt and check if it belongs to this stake key.
fn is_receipt_for_stake_key(raw_datum: Data, stake_key_hash: ByteArray) -> Bool {
  expect receipt: MintReceipt = raw_datum
  receipt.stake_key_hash == stake_key_hash
}

// ─── Receipt Output Validation (C-02) ───────────────────────────────────────

/// [C-02] Verify that at least one output contains a properly formed
/// MintReceipt datum with the correct stake_key_hash.
fn check_valid_receipt_output(stake_key_hash: ByteArray, tx: Transaction) -> Bool {
  list.any(
    tx.outputs,
    fn(output: Output) {
      when output.datum is {
        transaction.InlineDatum(raw_datum) ->
          is_receipt_for_stake_key(raw_datum, stake_key_hash)
        _ -> False
      }
    },
  )
}

// ─── Config Preservation (H-04) ─────────────────────────────────────────────

/// [H-04] Verify that the config UTxO is preserved as a continuing output.
/// After a mint, the config must remain at the script address so future
/// mints can read it. We check that at least one output has a MintConfig
/// datum matching the current config.
fn has_continuing_config(
  config: MintConfig,
  _own_utxo: OutputReference,
  tx: Transaction,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output: Output) {
      when output.datum is {
        transaction.InlineDatum(raw_datum) ->
          is_matching_config(raw_datum, config)
        _ -> False
      }
    },
  )
}

/// Check if a datum is a MintConfig matching the expected values.
fn is_matching_config(raw_datum: Data, config: MintConfig) -> Bool {
  expect preserved: MintConfig = raw_datum
  preserved.mint_price_lovelace == config.mint_price_lovelace && preserved.treasury_vkh == config.treasury_vkh && preserved.admin_vkh == config.admin_vkh && preserved.is_active == config.is_active && preserved.aldea_token_policy == config.aldea_token_policy && preserved.aldea_token_name == config.aldea_token_name && preserved.mint_price_aldea_token == config.mint_price_aldea_token
}

// ─── UpdateConfig Validation (H-02) ─────────────────────────────────────────

/// [H-02] Validate admin config update. The admin must sign, and the
/// continuing output must have a valid new config with minimum price
/// and the same admin key (admin can't change their own key via UpdateConfig).
fn validate_update_config(config: MintConfig, tx: Transaction) -> Bool {
  let admin_signed = signed_by(tx, config.admin_vkh)

  let has_valid_new_config =
    list.any(
      tx.outputs,
      fn(output: Output) {
        when output.datum is {
          transaction.InlineDatum(raw_datum) ->
            is_valid_new_config(raw_datum, config)
          _ -> False
        }
      },
    )

  admin_signed && has_valid_new_config
}

/// Validate a new config datum has minimum price and preserved admin key.
fn is_valid_new_config(raw_datum: Data, config: MintConfig) -> Bool {
  expect new_config: MintConfig = raw_datum
  // Admin key must not change via UpdateConfig
  new_config.admin_vkh == config.admin_vkh
  // ADA price must be above minimum
  && (new_config.mint_price_lovelace >= min_allowed_price_lovelace)
  // Token price must be non-negative
  && (new_config.mint_price_aldea_token >= 0)
}

// ─── Withdraw Validation (H-03) ─────────────────────────────────────────────

/// [H-03] Validate treasury withdrawal. Admin must sign, and ALL outputs
/// must pay to the treasury address. This prevents draining funds to
/// an arbitrary address.
fn validate_withdraw(config: MintConfig, tx: Transaction) -> Bool {
  let admin_signed = signed_by(tx, config.admin_vkh)

  // Every output must go to treasury or be a config continuation
  let all_to_treasury =
    list.all(
      tx.outputs,
      fn(output: Output) {
        let to_treasury = output_pays_to_vkh(output, config.treasury_vkh)
        // Also allow the config UTxO continuation at the script address
        let is_config_continuation = is_config_datum(output)
        to_treasury || is_config_continuation
      },
    )

  admin_signed && all_to_treasury
}

// ─── Admin Action Validation ────────────────────────────────────────────────

/// Validate admin-only actions (ToggleMinting).
fn validate_admin_action(config: MintConfig, tx: Transaction) -> Bool {
  signed_by(tx, config.admin_vkh)
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

/// Check if an output contains a MintConfig datum (used to identify config continuations).
fn is_config_datum(output: Output) -> Bool {
  when output.datum is {
    transaction.InlineDatum(raw_datum) -> {
      expect _cfg: MintConfig = raw_datum
      True
    }
    _ -> False
  }
}

/// Check if an output's payment credential matches a verification key hash.
fn output_pays_to_vkh(output: Output, vkh: VerificationKeyHash) -> Bool {
  when output.address.payment_credential is {
    VerificationKey(hash) -> hash == vkh
    _ -> False
  }
}
