/**
 * soulbound:v1:certificate — Achievement/completion certificate
 *
 * Use case: University diplomas, course certificates, achievement badges.
 * Required: walletAddress, achievementName
 * Optional: grade, courseId, validUntil
 * Disclosable: orgId, achievementName, issuedAt
 */

import type { SchemaValidator } from "./validator.js";
import { checkRequired, checkOptionalString } from "./validator.js";

export const certificateSchema: SchemaValidator = {
  schemaId: "soulbound:v1:certificate",
  requiredFields: ["walletAddress", "achievementName"],
  optionalFields: ["grade", "courseId"],
  disclosableFields: ["orgId", "achievementName", "issuedAt"],

  validate(subject) {
    const errors = checkRequired(subject, ["walletAddress", "achievementName"]);

    const gradeErr = checkOptionalString(subject, "grade");
    if (gradeErr) errors.push(gradeErr);

    const courseIdErr = checkOptionalString(subject, "courseId");
    if (courseIdErr) errors.push(courseIdErr);

    return errors;
  },
};
