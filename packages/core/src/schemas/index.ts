/**
 * TASK-022 — Standard ALMA Schemas with runtime validators
 *
 * Each schema defines:
 *   - Which fields are required, optional, and disclosable
 *   - A validate() function that checks emit input at runtime
 *   - A getDisclosureFields() helper for the schema's default disclosure
 *
 * Schemas are the source of truth for what data a credential of each type
 * must contain. The SDK uses these validators when emitting credentials.
 *
 * @example
 *   import { schemas, validateEmitInput } from "@adasouls/soulbound-core/schemas";
 *
 *   // Validate before emitting
 *   const errors = validateEmitInput("alma:v1:access", {
 *     walletAddress: "addr1...",
 *     resourceId: "my-game:main",
 *   });
 *   if (errors.length > 0) throw new Error(errors.join(", "));
 */

export { membershipSchema } from "./membership.js";
export { certificateSchema } from "./certificate.js";
export { professionalSchema } from "./professional.js";
export { accessSchema } from "./access.js";
export {
  validateEmitInput,
  getSchema,
  type SchemaValidator,
  type ValidationError,
} from "./validator.js";
