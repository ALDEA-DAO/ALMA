// Soulbound Protocol — Public Mint types
//
// Types for the public mint validator that handles ADA payments
// for new ALMA credential minting.

use aiken/crypto.{VerificationKeyHash}

// ─── Public Mint Datums ─────────────────────────────────────────────────────

/// Configuration datum stored at the validator address.
/// Holds minting parameters that can be updated by the admin.
pub type MintConfig {
  /// Minimum payment in Lovelace required to mint
  mint_price_lovelace: Int,
  /// Treasury address key hash — where payments are sent
  treasury_vkh: VerificationKeyHash,
  /// Admin key hash — can update config and pause minting
  admin_vkh: VerificationKeyHash,
  /// Whether public minting is currently enabled
  is_active: Bool,
}

/// Receipt datum stored for each successful mint.
/// Used for anti-double-mint: one receipt per minter wallet.
pub type MintReceipt {
  /// Key hash of the wallet that minted
  minter_vkh: VerificationKeyHash,
  /// Slot when the mint occurred
  minted_at: Int,
  /// Payment tx hash reference (for SDK listener correlation)
  payment_amount: Int,
}

// ─── Redeemer Actions ───────────────────────────────────────────────────────

/// Actions for the public mint validator.
pub type PublicMintAction {
  /// Pay ADA and mint a credential receipt
  Mint
  /// Admin: update mint configuration (price, active status)
  UpdateConfig
  /// Admin: withdraw accumulated funds to treasury
  WithdrawToTreasury
  /// Admin: pause or resume minting
  ToggleMinting
}
