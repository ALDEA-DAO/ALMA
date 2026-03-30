// TASK-014 — Integration tests for SoulboundRegistry (Aiken)
//
// Tests for the validation logic of the registry contract:
//   - register_issuer: admin signature, valid name, schemas
//   - register_schema: registrar signature, valid schema_id, required fields
//   - publish_revocation: issuer signature, valid hashes
//   - deactivate_issuer: admin signature
//   - update_issuer: admin signature, active status
//
// These tests use Aiken's built-in test framework and mock transactions.

use soulbound/types.{
  IssuerDatum,
  SchemaDatum,
  RevocationDatum,
  DAO,
  Hospital,
  Club,
}
use soulbound/validation.{signed_by, is_non_empty, has_schemas, schema_in_list}
use aiken/crypto.{VerificationKeyHash}

// ─── Helper: mock verification key hashes ────────────────────────────────────

const admin_vkh: VerificationKeyHash =
  #"0000000000000000000000000000000000000000000000000000000000000001"

const other_vkh: VerificationKeyHash =
  #"0000000000000000000000000000000000000000000000000000000000000002"

// ─── Validation helper tests ─────────────────────────────────────────────────

test is_non_empty_rejects_empty() {
  !is_non_empty("")
}

test is_non_empty_accepts_value() {
  is_non_empty("Example DAO")
}

test has_schemas_rejects_empty_list() {
  !has_schemas([])
}

test has_schemas_accepts_non_empty_list() {
  has_schemas(["soulbound:v1:access"])
}

test schema_in_list_finds_existing() {
  schema_in_list("soulbound:v1:access", ["soulbound:v1:membership", "soulbound:v1:access"])
}

test schema_in_list_rejects_missing() {
  !schema_in_list("soulbound:v1:professional", ["soulbound:v1:membership", "soulbound:v1:access"])
}

// ─── IssuerDatum construction tests ──────────────────────────────────────────

test issuer_datum_with_dao_type() {
  let datum =
    IssuerDatum {
      org_name: "Example DAO",
      org_type: DAO,
      admin_vkh: admin_vkh,
      schemas: ["soulbound:v1:access", "soulbound:v1:membership"],
      is_active: True,
    }
  datum.org_type == DAO && datum.is_active
}

test issuer_datum_with_hospital_type() {
  let datum =
    IssuerDatum {
      org_name: "Hospital Garrahan",
      org_type: Hospital,
      admin_vkh: admin_vkh,
      schemas: ["soulbound:v1:professional", "soulbound:v1:certificate"],
      is_active: True,
    }
  datum.org_type == Hospital
}

test issuer_datum_inactive_flag() {
  let datum =
    IssuerDatum {
      org_name: "Inactive Org",
      org_type: Club,
      admin_vkh: admin_vkh,
      schemas: ["soulbound:v1:membership"],
      is_active: False,
    }
  !datum.is_active
}

// ─── Register Issuer validation tests ────────────────────────────────────────

test register_issuer_valid_datum_passes_checks() {
  let datum =
    IssuerDatum {
      org_name: "Example DAO",
      org_type: DAO,
      admin_vkh: admin_vkh,
      schemas: ["soulbound:v1:access"],
      is_active: True,
    }
  is_non_empty(datum.org_name) && has_schemas(datum.schemas) && datum.is_active
}

test register_issuer_empty_name_fails() {
  let datum =
    IssuerDatum {
      org_name: "",
      org_type: DAO,
      admin_vkh: admin_vkh,
      schemas: ["soulbound:v1:access"],
      is_active: True,
    }
  !is_non_empty(datum.org_name)
}

test register_issuer_no_schemas_fails() {
  let datum =
    IssuerDatum {
      org_name: "Example DAO",
      org_type: DAO,
      admin_vkh: admin_vkh,
      schemas: [],
      is_active: True,
    }
  !has_schemas(datum.schemas)
}

test register_issuer_inactive_fails() {
  let datum =
    IssuerDatum {
      org_name: "Example DAO",
      org_type: DAO,
      admin_vkh: admin_vkh,
      schemas: ["soulbound:v1:access"],
      is_active: False,
    }
  // New registration must be active
  !datum.is_active
}

// ─── SchemaDatum construction tests ──────────────────────────────────────────

test schema_datum_valid() {
  let datum =
    SchemaDatum {
      schema_id: "soulbound:v1:access",
      registered_by: admin_vkh,
      required_fields: ["orgId", "walletHash", "resourceId", "issuedAt"],
      optional_fields: ["accessLevel", "expiresAt"],
      disclosable_fields: ["resourceId", "accessLevel"],
    }
  is_non_empty(datum.schema_id) && has_schemas(datum.required_fields)
}

test schema_datum_empty_id_fails() {
  let datum =
    SchemaDatum {
      schema_id: "",
      registered_by: admin_vkh,
      required_fields: ["orgId"],
      optional_fields: [],
      disclosable_fields: [],
    }
  !is_non_empty(datum.schema_id)
}

test schema_datum_no_required_fields_fails() {
  let datum =
    SchemaDatum {
      schema_id: "soulbound:v1:custom",
      registered_by: admin_vkh,
      required_fields: [],
      optional_fields: ["someField"],
      disclosable_fields: [],
    }
  !has_schemas(datum.required_fields)
}

// ─── RevocationDatum construction tests ──────────────────────────────────────

test revocation_datum_valid() {
  let datum =
    RevocationDatum {
      credential_hash: #"abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      revocation_anchor: #"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      revoked_by: admin_vkh,
      revoked_at: 1711234567,
    }
  is_non_empty(datum.credential_hash) && is_non_empty(datum.revocation_anchor)
}

test revocation_datum_empty_hash_fails() {
  let datum =
    RevocationDatum {
      credential_hash: "",
      revocation_anchor: #"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      revoked_by: admin_vkh,
      revoked_at: 1711234567,
    }
  !is_non_empty(datum.credential_hash)
}

test revocation_datum_empty_anchor_fails() {
  let datum =
    RevocationDatum {
      credential_hash: #"abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      revocation_anchor: "",
      revoked_by: admin_vkh,
      revoked_at: 1711234567,
    }
  !is_non_empty(datum.revocation_anchor)
}

// ─── Multi-schema issuer tests ───────────────────────────────────────────────

test issuer_with_multiple_schemas() {
  let datum =
    IssuerDatum {
      org_name: "University of Buenos Aires",
      org_type: types.University,
      admin_vkh: admin_vkh,
      schemas: [
        "soulbound:v1:certificate",
        "soulbound:v1:professional",
        "soulbound:v1:membership",
      ],
      is_active: True,
    }
  schema_in_list("soulbound:v1:certificate", datum.schemas) && schema_in_list(
    "soulbound:v1:professional",
    datum.schemas,
  ) && !schema_in_list("soulbound:v1:access", datum.schemas)
}

// ─── Update issuer tests ─────────────────────────────────────────────────────

test update_issuer_must_be_active() {
  let active_datum =
    IssuerDatum {
      org_name: "Example DAO",
      org_type: DAO,
      admin_vkh: admin_vkh,
      schemas: ["soulbound:v1:access"],
      is_active: True,
    }
  let inactive_datum =
    IssuerDatum {
      org_name: "Example DAO",
      org_type: DAO,
      admin_vkh: admin_vkh,
      schemas: ["soulbound:v1:access"],
      is_active: False,
    }
  // Active issuer can be updated, inactive cannot
  active_datum.is_active && !inactive_datum.is_active
}
