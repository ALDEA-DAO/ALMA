import type {
  SoulboundCredential,
  SoulboundCredentialId,
  SoulboundMembershipProof,
  SoulboundProofVerificationResult,
} from "@adasouls/soulbound-core";

export interface StoredCredential {
  id: SoulboundCredentialId;
  credential: SoulboundCredential;
}

/**
 * Abstract provider interface for the Soulbound Protocol.
 *
 * Implementations:
 *   - MockProvider     → in-memory, for development and tests
 *   - MidnightProvider → real ZK contracts on Midnight
 *   - (swap providers without changing application code)
 */
export interface SoulboundProvider {
  /** Issue a credential. Returns the ID and credential with issuer proof. */
  issue(
    credential: Omit<SoulboundCredential, "credentialProof">
  ): Promise<StoredCredential>;

  /** Claim a PENDING credential for the given wallet. */
  claim(credentialId: SoulboundCredentialId, walletAddress: string): Promise<SoulboundCredential>;

  /** Revoke a credential. Only the original issuer can do this. */
  revoke(credentialId: SoulboundCredentialId, issuerOrgId: string): Promise<void>;

  /** Return all credentials associated with a wallet hash. */
  listByWalletHash(walletHash: string): Promise<StoredCredential[]>;

  /** Generate a ZK membership proof without revealing the holder's identity. */
  generateProof(
    credentialId: SoulboundCredentialId,
    resourceId: string,
    disclosureFields: string[]
  ): Promise<SoulboundMembershipProof>;

  /** Verify a ZK Proof. */
  verifyProof(proof: SoulboundMembershipProof): Promise<SoulboundProofVerificationResult>;

  /** Deterministic hash of a wallet address (for on-chain privacy). */
  hashWalletAddress(walletAddress: string): string;
}
