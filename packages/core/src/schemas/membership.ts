/**
 * soulbound:v1:membership — General organization membership
 *
 * Use case: Club membership, DAO membership, cooperative credential.
 * Required: walletAddress
 * Optional: memberId, memberSince, tier, expiresAt
 * Disclosable: orgId, memberSince, tier
 */

import type { SchemaValidator } from "./validator.js";
import { checkRequired, checkOptionalString } from "./validator.js";

export const membershipSchema: SchemaValidator = {
  schemaId: "soulbound:v1:membership",
  requiredFields: ["walletAddress"],
  optionalFields: ["memberId", "memberSince", "tier"],
  disclosableFields: ["orgId", "memberSince", "tier"],

  validate(subject) {
    const errors = checkRequired(subject, ["walletAddress"]);

    const tierErr = checkOptionalString(subject, "tier");
    if (tierErr) errors.push(tierErr);

    const memberIdErr = checkOptionalString(subject, "memberId");
    if (memberIdErr) errors.push(memberIdErr);

    if (subject["memberSince"] !== undefined && typeof subject["memberSince"] !== "number") {
      errors.push({ field: "memberSince", message: "memberSince must be a unix timestamp (number)" });
    }

    return errors;
  },
};
