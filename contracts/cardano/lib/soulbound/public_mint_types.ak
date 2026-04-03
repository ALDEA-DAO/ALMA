// Soulbound Protocol — Public Mint types
//
// Types for the public mint validator that handles ADA and ALDEA token
// payments for new ALMA credential minting.

use aiken/crypto.{VerificationKeyHash}

// ─── Public Mint Datums ─────────────────────────────────────────────────────

/// Configuration datum stored at the validator address.
/// Holds minting parameters that can be updated by the admin.
pub type MintConfig {
  /// Minimum payment in Lovelace required to mint (ADA path)
  mint_price_lovelace: Int,
  /// Treasury address key hash — where payments are sent
  treasury_vkh: VerificationKeyHash,
  /// Admin key hash — can update config and pause minting
  admin_vkh: VerificationKeyHash,
  /// Whether public minting is currently enabled
  is_active: Bool,
  /// ALDEA token policy ID (empty ByteArray = token payment disabled)
  aldea_token_policy: ByteArray,
  /// ALDEA token asset name
  aldea_token_name: ByteArray,
  /// Minimum ALDEA tokens required to mint (0 = token payment disabled)
  mint_price_aldea_token: Int,
}

/// Receipt datum stored for each successful mint.
/// Used for anti-double-mint: one receipt per minter wallet.
pub type MintReceipt {
  /// Key hash of the wallet that minted
  minter_vkh: VerificationKeyHash,
  /// Slot when the mint occurred
  minted_at: Int,
  /// Payment amount (lovelace or token units depending on method)
  payment_amount: Int,
  /// Payment method: "ada" or "aldea_token"
  payment_method: ByteArray,
}

// ─── Redeemer Actions ───────────────────────────────────────────────────────

/// Actions for the public mint validator.
pub type PublicMintAction {
  /// Pay ADA and mint a credential receipt
  Mint
  /// Pay ALDEA tokens and mint a credential receipt
  MintWithToken
  /// Admin: update mint configuration (price, active status)
  UpdateConfig
  /// Admin: withdraw accumulated funds to treasury
  WithdrawToTreasury
  /// Admin: pause or resume minting
  ToggleMinting
}
