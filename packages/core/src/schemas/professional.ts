/**
 * soulbound:v1:professional — Professional credential
 *
 * Use case: Medical licenses, professional certifications, bar memberships.
 * Required: walletAddress, professionCode, licenseNumber
 * Optional: specialty, issuingAuthority
 * Disclosable: professionCode, licenseNumber, issuingAuthority
 */

import type { SchemaValidator } from "./validator.js";
import { checkRequired, checkOptionalString } from "./validator.js";

export const professionalSchema: SchemaValidator = {
  schemaId: "soulbound:v1:professional",
  requiredFields: ["walletAddress", "professionCode", "licenseNumber"],
  optionalFields: ["specialty", "issuingAuthority"],
  disclosableFields: ["professionCode", "licenseNumber", "issuingAuthority"],

  validate(subject) {
    const errors = checkRequired(subject, ["walletAddress", "professionCode", "licenseNumber"]);

    const specialtyErr = checkOptionalString(subject, "specialty");
    if (specialtyErr) errors.push(specialtyErr);

    const authorityErr = checkOptionalString(subject, "issuingAuthority");
    if (authorityErr) errors.push(authorityErr);

    return errors;
  },
};
