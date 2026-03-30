/**
 * Schema validation engine for Soulbound credential emit inputs.
 */

import type { SoulboundSchemaId } from "../types.js";
import { membershipSchema } from "./membership.js";
import { certificateSchema } from "./certificate.js";
import { professionalSchema } from "./professional.js";
import { accessSchema } from "./access.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export interface SchemaValidator {
  schemaId: SoulboundSchemaId;
  requiredFields: string[];
  optionalFields: string[];
  disclosableFields: string[];
  /** Validate the subject fields of an emit input. */
  validate(subject: Record<string, unknown>): ValidationError[];
}

// ─── Schema registry ─────────────────────────────────────────────────────────

const schemaRegistry = new Map<SoulboundSchemaId, SchemaValidator>([
  ["soulbound:v1:membership", membershipSchema],
  ["soulbound:v1:certificate", certificateSchema],
  ["soulbound:v1:professional", professionalSchema],
  ["soulbound:v1:access", accessSchema],
]);

/**
 * Get a schema validator by ID.
 * Returns undefined if the schema is not registered.
 */
export function getSchema(schemaId: SoulboundSchemaId): SchemaValidator | undefined {
  return schemaRegistry.get(schemaId);
}

/**
 * Validate an emit input's subject fields against the schema's requirements.
 *
 * @param schemaId - The schema to validate against
 * @param subject  - The subject fields from SoulboundEmitInput
 * @returns Array of validation errors (empty = valid)
 */
export function validateEmitInput(
  schemaId: SoulboundSchemaId,
  subject: Record<string, unknown>
): ValidationError[] {
  const schema = schemaRegistry.get(schemaId);
  if (!schema) {
    return [{ field: "schemaId", message: `Unknown schema: ${schemaId}` }];
  }
  return schema.validate(subject);
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Check that required fields are present and non-empty strings. */
export function checkRequired(
  subject: Record<string, unknown>,
  fields: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const field of fields) {
    const value = subject[field];
    if (value === undefined || value === null || value === "") {
      errors.push({ field, message: `${field} is required` });
    }
  }
  return errors;
}

/** Check that a field, if present, is a non-empty string. */
export function checkOptionalString(
  subject: Record<string, unknown>,
  field: string
): ValidationError | null {
  const value = subject[field];
  if (value !== undefined && typeof value !== "string") {
    return { field, message: `${field} must be a string` };
  }
  return null;
}
