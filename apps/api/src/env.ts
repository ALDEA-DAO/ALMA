// Environment configuration — validated at startup

export interface Env {
  // Server
  PORT: number;
  NODE_ENV: "development" | "testnet" | "mainnet";
  API_URL: string;
  FRONTEND_URL: string;

  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_CENTS: number;

  // Mercado Pago
  MP_ACCESS_TOKEN: string;
  MP_WEBHOOK_SECRET: string;
  MP_PRICE_ARS: number;

  // ALDEA
  ALDEA_POLICY_ID: string;
  ALDEA_PUBLIC_KEY: string;
  ALDEA_TREASURY_ADDRESS: string;
  MINT_PRICE_LOVELACE: string;

  // Midnight
  MIDNIGHT_NODE_URL: string;
  MIDNIGHT_PROOF_SERVER_URL: string;
  MIDNIGHT_CREDENTIAL_CONTRACT: string;

  // Cardano
  BLOCKFROST_PROJECT_ID: string;
  BLOCKFROST_URL: string;

  // Database
  DATABASE_PATH: string;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function loadEnv(): Env {
  return {
    PORT: Number(optionalEnv("PORT", "3100")),
    NODE_ENV: (optionalEnv("NODE_ENV", "development") as Env["NODE_ENV"]),
    API_URL: optionalEnv("API_URL", "http://localhost:3100"),
    FRONTEND_URL: optionalEnv("FRONTEND_URL", "http://localhost:3000"),

    STRIPE_SECRET_KEY: optionalEnv("STRIPE_SECRET_KEY", ""),
    STRIPE_WEBHOOK_SECRET: optionalEnv("STRIPE_WEBHOOK_SECRET", ""),
    STRIPE_PRICE_CENTS: Number(optionalEnv("STRIPE_PRICE_CENTS", "1500")),

    MP_ACCESS_TOKEN: optionalEnv("MP_ACCESS_TOKEN", ""),
    MP_WEBHOOK_SECRET: optionalEnv("MP_WEBHOOK_SECRET", ""),
    MP_PRICE_ARS: Number(optionalEnv("MP_PRICE_ARS", "15000")),

    ALDEA_POLICY_ID: optionalEnv("ALDEA_POLICY_ID", "aldea-dao-policy-id"),
    ALDEA_PUBLIC_KEY: optionalEnv("ALDEA_PUBLIC_KEY", ""),
    ALDEA_TREASURY_ADDRESS: optionalEnv("ALDEA_TREASURY_ADDRESS", ""),
    MINT_PRICE_LOVELACE: optionalEnv("MINT_PRICE_LOVELACE", "35000000"),

    MIDNIGHT_NODE_URL: optionalEnv("MIDNIGHT_NODE_URL", "ws://localhost:9944"),
    MIDNIGHT_PROOF_SERVER_URL: optionalEnv("MIDNIGHT_PROOF_SERVER_URL", "http://localhost:6300"),
    MIDNIGHT_CREDENTIAL_CONTRACT: optionalEnv("MIDNIGHT_CREDENTIAL_CONTRACT", ""),

    BLOCKFROST_PROJECT_ID: optionalEnv("BLOCKFROST_PROJECT_ID", ""),
    BLOCKFROST_URL: optionalEnv("BLOCKFROST_URL", "https://cardano-preprod.blockfrost.io/api/v0"),

    DATABASE_PATH: optionalEnv("DATABASE_PATH", "data/alma-api.db"),
  };
}
