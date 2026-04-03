// Midnight shielded account derivation
//
// Derives a Midnight shielded account from the Cardano wallet identity.
// This links the user's Cardano wallet (public layer) to their Midnight
// identity (private layer) without exposing either.
//
// Key properties:
//   - Deterministic: same Cardano key always produces same Midnight account
//   - One-way: Midnight account can't be reversed to Cardano wallet
//   - Subsidized: ALDEA pays DUST fees so users never need Midnight tokens
//
// Architecture:
//   Cardano private key → HKDF derivation → Midnight secret key
//   Midnight secret key → persistent_hash → wallet_hash (used in ZK circuits)

export interface MidnightAccount {
  /** Midnight shielded account identifier */
  accountId: string;
  /** Wallet hash used in the SoulboundCredentialContract (ZK-friendly) */
  walletHash: string;
  /** Sign a Midnight transaction (delegates to derived key) */
  signMidnightTx(txPayload: string): Promise<string>;
}

export interface MidnightAccountConfig {
  /** Domain separator for key derivation (prevents cross-protocol key reuse) */
  derivationDomain?: string;
}

const DEFAULT_DOMAIN = "alma-protocol:midnight:v1";

/**
 * Derive a Midnight shielded account from a Cardano wallet key hash.
 *
 * Uses HKDF (HMAC-based Key Derivation) to create a deterministic
 * Midnight secret key from the Cardano identity. The derivation is:
 *
 *   cardano_key_hash + domain_separator → HKDF → midnight_secret_key
 *   midnight_secret_key → SHA-256 → midnight_wallet_hash
 *
 * In production, the wallet_hash should use persistent_hash from the
 * Compact contract (which is ZK-circuit-friendly). For now we use
 * SHA-256 as an approximation.
 */
export async function deriveMidnightAccount(
  cardanoKeyHash: string,
  cardanoPrivateKeyHex: string | null,
  config: MidnightAccountConfig = {},
): Promise<MidnightAccount> {
  const domain = config.derivationDomain ?? DEFAULT_DOMAIN;

  // Step 1: Derive a Midnight-specific secret key via HKDF
  const midnightSecretKey = await hkdfDerive(cardanoKeyHash, domain);

  // Step 2: Derive the wallet hash (public identifier on Midnight)
  // This is what goes into the SoulboundCredentialContract as subject_wallet_hash
  const walletHash = await sha256Hash(`${midnightSecretKey}:wallet_hash`);

  // Step 3: Derive the account ID (human-readable identifier)
  const accountId = `midnight:${walletHash.slice(0, 16)}`;

  return {
    accountId,
    walletHash,

    async signMidnightTx(txPayload: string): Promise<string> {
      // In production, this uses the Midnight SDK's transaction signing:
      //
      //   import { signTransaction } from "@midnight-ntwrk/midnight-js-types";
      //   return signTransaction(midnightSecretKey, txPayload);
      //
      // The secret key is derived from the Cardano key, so the user
      // never needs to manage a separate Midnight key.

      // TODO: Replace with real Midnight SDK signing
      const signatureInput = `${midnightSecretKey}:${txPayload}`;
      const signature = await sha256Hash(signatureInput);
      return signature;
    },
  };
}

// ─── Cryptographic helpers ────────────────────────────────────────────────

/**
 * HKDF-SHA256 key derivation.
 *
 * Derives a key from input material + domain separator.
 * Uses the Web Crypto API for standards-compliant derivation.
 */
async function hkdfDerive(inputKeyMaterial: string, info: string): Promise<string> {
  const encoder = new TextEncoder();

  // Import the input as key material
  const ikm = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(inputKeyMaterial),
    "HKDF",
    false,
    ["deriveBits"],
  );

  // Derive 32 bytes using HKDF
  const derived = await globalThis.crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("alma-midnight-salt"),
      info: encoder.encode(info),
    },
    ikm,
    256, // 32 bytes
  );

  return bytesToHex(new Uint8Array(derived));
}

async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
