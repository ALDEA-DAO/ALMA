/**
 * soulbound:v1:access — Service/platform access credential
 *
 * Use case: Game access, platform membership, service gates.
 * Required: walletAddress, resourceId
 * Optional: accessLevel, expiresAt
 * Disclosable: resourceId, accessLevel
 */

import type { SchemaValidator } from "./validator.js";
import { checkRequired, checkOptionalString } from "./validator.js";

export const accessSchema: SchemaValidator = {
  schemaId: "soulbound:v1:access",
  requiredFields: ["walletAddress", "resourceId"],
  optionalFields: ["accessLevel"],
  disclosableFields: ["resourceId", "accessLevel"],

  validate(subject) {
    const errors = checkRequired(subject, ["walletAddress", "resourceId"]);

    const levelErr = checkOptionalString(subject, "accessLevel");
    if (levelErr) errors.push(levelErr);

    return errors;
  },
};
