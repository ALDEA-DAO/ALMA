/**
 * ALMA — ALDEA-specific configuration
 *
 * This is the single source of truth for ALDEA's deployment of the
 * Umbra Protocol. All apps and scripts in this repo import from here.
 */

import type { SoulboundIssuer as SoulboundOrganization } from "@adasouls/soulbound-sdk";

// ─── Organization ────────────────────────────────────────────────────────────

export const ALDEA_ORG: SoulboundOrganization = {
  orgId: process.env.ALDEA_POLICY_ID ?? "aldea-dao-policy-id",
  orgName: "ALDEA DAO",
  orgType: "DAO",
  publicKey: process.env.ALDEA_PUBLIC_KEY ?? "",
};

// ─── Resources ───────────────────────────────────────────────────────────────

/** Resource IDs for ALDEA World access gates */
export const RESOURCES = {
  /** Main gate to ALDEA World */
  MAIN_GATE: "aldea-world:main-gate",
  /** Access to ALDEA World documentation */
  DOCS: "aldea-world:docs",
  /** Access to governance features */
  GOVERNANCE: "aldea-world:governance",
} as const;

// ─── Schemas ─────────────────────────────────────────────────────────────────

/** ALDEA uses the access schema for all memberships */
export const ALDEA_SCHEMA = "soulbound:v1:access" as const;

// ─── Mint configuration ──────────────────────────────────────────────────────

/** Price to mint a new ALMA credential (in Lovelace) */
export const MINT_PRICE_LOVELACE = 35_000_000n; // 35 ADA

/** Treasury wallet that receives mint payments */
export const TREASURY_ADDRESS = process.env.ALDEA_TREASURY_ADDRESS ?? "";

// ─── Access levels ───────────────────────────────────────────────────────────

export const ACCESS_LEVELS = {
  MEMBER: "MEMBER",
  TRIAL: "TRIAL",
  FOUNDING: "FOUNDING_MEMBER",
} as const;
