/**
 * Tests for standard Soulbound schema validators
 */

import { describe, it, expect } from "vitest";
import { validateEmitInput, getSchema } from "../validator.js";

describe("Schema validators", () => {
  // ─── soulbound:v1:access ─────────────────────────────────────────────

  describe("soulbound:v1:access", () => {
    it("valid input passes", () => {
      const errors = validateEmitInput("soulbound:v1:access", {
        walletAddress: "addr1_test",
        resourceId: "my-game:main",
      });
      expect(errors).toHaveLength(0);
    });

    it("missing resourceId fails", () => {
      const errors = validateEmitInput("soulbound:v1:access", {
        walletAddress: "addr1_test",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.field).toBe("resourceId");
    });

    it("missing walletAddress fails", () => {
      const errors = validateEmitInput("soulbound:v1:access", {
        resourceId: "my-game:main",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.field).toBe("walletAddress");
    });

    it("optional accessLevel accepted", () => {
      const errors = validateEmitInput("soulbound:v1:access", {
        walletAddress: "addr1_test",
        resourceId: "my-game:main",
        accessLevel: "MEMBER",
      });
      expect(errors).toHaveLength(0);
    });

    it("non-string accessLevel rejected", () => {
      const errors = validateEmitInput("soulbound:v1:access", {
        walletAddress: "addr1_test",
        resourceId: "my-game:main",
        accessLevel: 42,
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.field).toBe("accessLevel");
    });
  });

  // ─── soulbound:v1:membership ─────────────────────────────────────────

  describe("soulbound:v1:membership", () => {
    it("valid input passes", () => {
      const errors = validateEmitInput("soulbound:v1:membership", {
        walletAddress: "addr1_test",
      });
      expect(errors).toHaveLength(0);
    });

    it("with optional fields passes", () => {
      const errors = validateEmitInput("soulbound:v1:membership", {
        walletAddress: "addr1_test",
        memberId: "ORG-001",
        tier: "FULL_MEMBER",
        memberSince: 1700000000,
      });
      expect(errors).toHaveLength(0);
    });

    it("non-number memberSince rejected", () => {
      const errors = validateEmitInput("soulbound:v1:membership", {
        walletAddress: "addr1_test",
        memberSince: "yesterday",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.field).toBe("memberSince");
    });
  });

  // ─── soulbound:v1:certificate ────────────────────────────────────────

  describe("soulbound:v1:certificate", () => {
    it("valid input passes", () => {
      const errors = validateEmitInput("soulbound:v1:certificate", {
        walletAddress: "addr1_test",
        achievementName: "Blockchain Fundamentals",
      });
      expect(errors).toHaveLength(0);
    });

    it("missing achievementName fails", () => {
      const errors = validateEmitInput("soulbound:v1:certificate", {
        walletAddress: "addr1_test",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.field).toBe("achievementName");
    });

    it("with optional grade and courseId passes", () => {
      const errors = validateEmitInput("soulbound:v1:certificate", {
        walletAddress: "addr1_test",
        achievementName: "Smart Contract Development",
        grade: "A",
        courseId: "CS-401",
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ─── soulbound:v1:professional ───────────────────────────────────────

  describe("soulbound:v1:professional", () => {
    it("valid input passes", () => {
      const errors = validateEmitInput("soulbound:v1:professional", {
        walletAddress: "addr1_test",
        professionCode: "MD",
        licenseNumber: "LIC-2024-0001",
      });
      expect(errors).toHaveLength(0);
    });

    it("missing professionCode fails", () => {
      const errors = validateEmitInput("soulbound:v1:professional", {
        walletAddress: "addr1_test",
        licenseNumber: "LIC-2024-0001",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.field).toBe("professionCode");
    });

    it("missing licenseNumber fails", () => {
      const errors = validateEmitInput("soulbound:v1:professional", {
        walletAddress: "addr1_test",
        professionCode: "MD",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.field).toBe("licenseNumber");
    });

    it("missing both required fields gives 2 errors", () => {
      const errors = validateEmitInput("soulbound:v1:professional", {
        walletAddress: "addr1_test",
      });
      expect(errors).toHaveLength(2);
    });

    it("with optional fields passes", () => {
      const errors = validateEmitInput("soulbound:v1:professional", {
        walletAddress: "addr1_test",
        professionCode: "MD",
        licenseNumber: "LIC-2024-0001",
        specialty: "Cardiology",
        issuingAuthority: "Medical Board",
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ─── getSchema ───────────────────────────────────────────────────────

  describe("getSchema()", () => {
    it("returns schema for valid ID", () => {
      const schema = getSchema("soulbound:v1:access");
      expect(schema).toBeDefined();
      expect(schema!.schemaId).toBe("soulbound:v1:access");
      expect(schema!.disclosableFields).toContain("resourceId");
    });

    it("returns undefined for unknown schema", () => {
      const schema = getSchema("soulbound:v99:unknown" as any);
      expect(schema).toBeUndefined();
    });

    it("all 4 standard schemas are registered", () => {
      expect(getSchema("soulbound:v1:membership")).toBeDefined();
      expect(getSchema("soulbound:v1:certificate")).toBeDefined();
      expect(getSchema("soulbound:v1:professional")).toBeDefined();
      expect(getSchema("soulbound:v1:access")).toBeDefined();
    });
  });

  // ─── Unknown schema ──────────────────────────────────────────────────

  describe("unknown schema", () => {
    it("returns error for unknown schema ID", () => {
      const errors = validateEmitInput("soulbound:v99:fake" as any, {
        walletAddress: "addr1_test",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.field).toBe("schemaId");
    });
  });
});
