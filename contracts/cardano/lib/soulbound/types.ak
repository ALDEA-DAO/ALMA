// Soulbound Protocol — Core types for Cardano registry contracts
//
// These types define the on-chain data structures for the public
// registry layer: issuers, schemas, and revocation anchors.

use aiken/crypto.{VerificationKeyHash}

// ─── Organization Types ──────────────────────────────────────────────────────

/// The type of organization that can issue Soulbound credentials.
/// Maps to SoulboundOrgType in the TypeScript SDK.
pub type OrgType {
  DAO
  Club
  Hospital
  University
  Corp
  Cooperative
  Government
  Other
}

// ─── Registry Datums ─────────────────────────────────────────────────────────

/// Datum stored in each issuer registration UTxO.
/// One UTxO per registered issuer in the SoulboundRegistry.
pub type IssuerDatum {
  /// Human-readable name of the organization
  org_name: ByteArray,
  /// Type of organization
  org_type: OrgType,
  /// Admin verification key hash — the key that controls this issuer
  admin_vkh: VerificationKeyHash,
  /// List of schema IDs this issuer is authorized to use
  schemas: List<ByteArray>,
  /// Whether this issuer is currently active
  is_active: Bool,
}

/// Datum stored in each schema registration UTxO.
pub type SchemaDatum {
  /// Schema identifier (e.g. hash of "soulbound:v1:membership")
  schema_id: ByteArray,
  /// The issuer that registered this schema (admin vkh)
  registered_by: VerificationKeyHash,
  /// List of required field names (hashed)
  required_fields: List<ByteArray>,
  /// List of optional field names (hashed)
  optional_fields: List<ByteArray>,
  /// List of fields that can be selectively disclosed
  disclosable_fields: List<ByteArray>,
}

/// Datum stored in each revocation anchor UTxO.
/// Published from Midnight — does NOT contain holder identity.
pub type RevocationDatum {
  /// Hash of the credential being revoked (from Midnight contract)
  credential_hash: ByteArray,
  /// Revocation anchor — opaque hash linking to Midnight state
  revocation_anchor: ByteArray,
  /// The issuer who performed the revocation (admin vkh)
  revoked_by: VerificationKeyHash,
  /// Block slot when revocation was published
  revoked_at: Int,
}

// ─── Redeemer Actions ────────────────────────────────────────────────────────

/// Actions that can be performed on the SoulboundRegistry validator.
pub type RegistryAction {
  /// Register a new issuer organization
  RegisterIssuer
  /// Update an existing issuer's data (schemas, active status)
  UpdateIssuer
  /// Deactivate an issuer (soft delete — keeps the UTxO)
  DeactivateIssuer
  /// Register a new credential schema
  RegisterSchema
  /// Publish a revocation anchor from Midnight
  PublishRevocation
}
