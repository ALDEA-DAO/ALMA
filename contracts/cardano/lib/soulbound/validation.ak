// Soulbound Protocol — Validation helpers for registry contracts
//
// Reusable validation functions extracted from the validator logic.
// Inspired by AdaSouls check_policy pattern.

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{Transaction}

/// Check that a specific verification key hash has signed the transaction.
pub fn signed_by(tx: Transaction, vkh: VerificationKeyHash) -> Bool {
  list.has(tx.extra_signatories, vkh)
}

/// Validate that a byte array is non-empty (basic sanity check for names/IDs).
pub fn is_non_empty(bytes: ByteArray) -> Bool {
  bytes != ""
}

/// Validate that a list of schemas is non-empty (issuer must support at least one).
pub fn has_schemas(schemas: List<ByteArray>) -> Bool {
  when schemas is {
    [] -> False
    _ -> True
  }
}

/// Check if a schema_id exists in a list of schemas.
pub fn schema_in_list(schema_id: ByteArray, schemas: List<ByteArray>) -> Bool {
  list.has(schemas, schema_id)
}
