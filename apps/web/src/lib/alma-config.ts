/**
 * ALMA web app configuration.
 *
 * Re-exports from the shared config with web-specific defaults.
 */

export const ALDEA_ORG = {
  orgId: process.env.NEXT_PUBLIC_ALDEA_POLICY_ID ?? "aldea-dao-policy-id",
  orgName: "ALDEA DAO",
  orgType: "DAO" as const,
  publicKey: process.env.NEXT_PUBLIC_ALDEA_PUBLIC_KEY ?? "",
};

export const RESOURCES = {
  MAIN_GATE: "aldea-world:main-gate",
  DOCS: "aldea-world:docs",
  GOVERNANCE: "aldea-world:governance",
} as const;

export const MINT_PRICE_ADA = 35;
export const MINT_PRICE_LOVELACE = BigInt(MINT_PRICE_ADA) * 1_000_000n;

export const TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_ALDEA_TREASURY_ADDRESS ?? "";

export const ALDEA_WORLD_URL =
  process.env.NEXT_PUBLIC_ALDEA_WORLD_URL ?? "https://aldea.world";

export const CARDANO_NETWORK = (process.env.NEXT_PUBLIC_CARDANO_NETWORK ??
  "preprod") as "preprod" | "preview" | "mainnet";

export const BLOCKFROST_URL =
  process.env.NEXT_PUBLIC_BLOCKFROST_URL ??
  "https://cardano-preprod.blockfrost.io/api/v0";
