// Soulbound Protocol — SoulboundRegistry Validator
//
// Cardano-side registry contract for the Soulbound credential protocol.
// Manages the public layer: issuer registration, schema registration,
// and revocation anchors from Midnight.
//
// TASK-011: register_issuer, register_schema, is_valid_issuer, is_valid_schema
// TASK-012: publish_revocation
//
// Architecture:
//   - Each issuer registration is a UTxO locked at this script address
//     with an IssuerDatum containing org info and admin key
//   - Each schema registration is a UTxO with a SchemaDatum
//   - Each revocation is a UTxO with a RevocationDatum
//   - The admin_vkh must sign all operations for their issuer
//
// Privacy guarantee:
//   - Revocation anchors are opaque hashes — no holder identity is exposed
//   - The credential_hash in RevocationDatum cannot be reversed to find the holder

use soulbound/types.{
  IssuerDatum,
  SchemaDatum,
  RevocationDatum,
  RegistryAction,
  RegisterIssuer,
  UpdateIssuer,
  DeactivateIssuer,
  RegisterSchema,
  PublishRevocation,
}
use soulbound/validation.{signed_by, is_non_empty, has_schemas}
use aiken/collection/list
use cardano/transaction.{Transaction, OutputReference}

// ─── Main Validator ──────────────────────────────────────────────────────────

/// The SoulboundRegistry spending validator.
///
/// Validates all registry operations: issuer management, schema registration,
/// and revocation publishing. Each operation type has its own datum and
/// requires the appropriate admin signature.
validator registry {
  spend(
    datum: Option<Data>,
    redeemer: RegistryAction,
    _utxo: OutputReference,
    tx: Transaction,
  ) -> Bool {
    when redeemer is {
      // ── TASK-011: Register a new issuer ──────────────────────────────
      // The initial registration is validated at the time of creating the
      // UTxO. This spend path handles consuming a registration UTxO
      // (e.g., for updates). The admin must sign.
      RegisterIssuer -> {
        expect Some(raw_datum) = datum
        expect issuer_datum: IssuerDatum = raw_datum
        validate_register_issuer(issuer_datum, tx)
      }

      // ── Update an existing issuer ────────────────────────────────────
      UpdateIssuer -> {
        expect Some(raw_datum) = datum
        expect issuer_datum: IssuerDatum = raw_datum
        validate_update_issuer(issuer_datum, tx)
      }

      // ── Deactivate an issuer ─────────────────────────────────────────
      DeactivateIssuer -> {
        expect Some(raw_datum) = datum
        expect issuer_datum: IssuerDatum = raw_datum
        validate_deactivate_issuer(issuer_datum, tx)
      }

      // ── TASK-011: Register a schema ──────────────────────────────────
      RegisterSchema -> {
        expect Some(raw_datum) = datum
        expect schema_datum: SchemaDatum = raw_datum
        validate_register_schema(schema_datum, tx)
      }

      // ── TASK-012: Publish a revocation anchor ────────────────────────
      PublishRevocation -> {
        expect Some(raw_datum) = datum
        expect revocation_datum: RevocationDatum = raw_datum
        validate_publish_revocation(revocation_datum, tx)
      }
    }
  }

  else(_) -> Bool {
    False
  }
}

// ─── Validation Functions ────────────────────────────────────────────────────

/// Validate issuer registration.
///
/// Requirements:
///   1. The admin_vkh must sign the transaction
///   2. org_name must be non-empty
///   3. Must declare at least one schema
///   4. Issuer must be marked as active
fn validate_register_issuer(datum: IssuerDatum, tx: Transaction) -> Bool {
  // Admin must sign
  let admin_signed = signed_by(tx, datum.admin_vkh)

  // Basic validation
  let valid_name = is_non_empty(datum.org_name)
  let valid_schemas = has_schemas(datum.schemas)
  let is_active = datum.is_active

  admin_signed && valid_name && valid_schemas && is_active
}

/// Validate issuer update (e.g., adding new schemas).
///
/// Requirements:
///   1. The current admin_vkh must sign
///   2. The issuer must still be active
fn validate_update_issuer(datum: IssuerDatum, tx: Transaction) -> Bool {
  signed_by(tx, datum.admin_vkh) && datum.is_active
}

/// Validate issuer deactivation (soft delete).
///
/// Requirements:
///   1. The admin must sign the deactivation
fn validate_deactivate_issuer(datum: IssuerDatum, tx: Transaction) -> Bool {
  signed_by(tx, datum.admin_vkh)
}

/// Validate schema registration.
///
/// Requirements:
///   1. The registering issuer (registered_by) must sign
///   2. schema_id must be non-empty
///   3. Must have at least one required field
///   4. (M-03) No existing schema with the same schema_id in reference inputs
fn validate_register_schema(datum: SchemaDatum, tx: Transaction) -> Bool {
  let registrar_signed = signed_by(tx, datum.registered_by)
  let valid_id = is_non_empty(datum.schema_id)
  let has_required = has_schemas(datum.required_fields)
  // (M-03) Check no duplicate schema_id exists. The frontend must include
  // all existing schema UTxOs at the script address as reference inputs.
  let no_duplicate = no_existing_schema(datum.schema_id, tx)

  registrar_signed && valid_id && has_required && no_duplicate
}

/// (M-03) Check that no existing SchemaDatum with the same schema_id exists
/// in the transaction's reference inputs.
fn no_existing_schema(schema_id: ByteArray, tx: Transaction) -> Bool {
  !list.any(
    tx.reference_inputs,
    fn(ref_input) {
      when ref_input.output.datum is {
        transaction.InlineDatum(raw_datum) -> {
          expect existing: SchemaDatum = raw_datum
          existing.schema_id == schema_id
        }
        _ -> False
      }
    },
  )
}

/// Validate publishing a revocation anchor from Midnight.
///
/// TASK-012: This is the bridge between Midnight (private) and Cardano (public).
/// When a credential is revoked in the Midnight contract, the issuer publishes
/// an opaque revocation anchor on Cardano so that anyone can verify the
/// credential was revoked WITHOUT learning who the holder was.
///
/// Requirements:
///   1. The revoking issuer (revoked_by) must sign
///   2. credential_hash must be non-empty
///   3. revocation_anchor must be non-empty
fn validate_publish_revocation(datum: RevocationDatum, tx: Transaction) -> Bool {
  let issuer_signed = signed_by(tx, datum.revoked_by)
  let valid_hash = is_non_empty(datum.credential_hash)
  let valid_anchor = is_non_empty(datum.revocation_anchor)

  issuer_signed && valid_hash && valid_anchor
}
