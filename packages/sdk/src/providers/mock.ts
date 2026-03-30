import { createHash, randomUUID } from "node:crypto";
import type {
  SoulboundCredential,
  SoulboundCredentialId,
  SoulboundMembershipProof,
  SoulboundProofVerificationResult,
} from "@adasouls/soulbound-core";
import type { SoulboundProvider, StoredCredential } from "./types.js";

/**
 * MockProvider — in-memory implementation for development and testing.
 *
 * No contracts or blockchain required. Use it for:
 *   - Testing credential flows before having Midnight contracts
 *   - Unit tests of the SDK and applications
 *   - Demos and prototypes
 *
 * When contracts are ready, swap for MidnightProvider
 * without changing any application code.
 *
 * @example
 *   const provider = new MockProvider();
 *   const issuer = new SoulboundIssuer(myOrg, provider);
 *   const verifier = new SoulboundVerifier(provider);
 *
 *   await issuer.emitTrial(walletAddress, "my-game:main", 7);
 *   const { hasAccess, isTrial } = await verifier.checkAccess(walletAddress, {
 *     resourceId: "my-game:main",
 *   });
 */
export class MockProvider implements SoulboundProvider {
  private store = new Map<SoulboundCredentialId, SoulboundCredential>();

  hashWalletAddress(walletAddress: string): string {
    return createHash("sha256").update(walletAddress).digest("hex");
  }

  async issue(
    credential: Omit<SoulboundCredential, "credentialProof">
  ): Promise<StoredCredential> {
    const id = `soulbound:cred:mock:${randomUUID()}` as SoulboundCredentialId;
    const full: SoulboundCredential = {
      ...credential,
      credentialProof: `mock-proof-${randomUUID()}`,
    };
    this.store.set(id, full);
    return { id, credential: full };
  }

  async claim(
    credentialId: SoulboundCredentialId,
    walletAddress: string
  ): Promise<SoulboundCredential> {
    const credential = this.store.get(credentialId);
    if (!credential) throw new Error(`Credential ${credentialId} not found`);
    if (credential.status === "REVOKED") throw new Error("Credential is revoked");
    if (credential.status === "CLAIMED") return credential;

    const walletHash = this.hashWalletAddress(walletAddress);
    if (credential.subject.walletHash !== walletHash) {
      throw new Error("Wallet mismatch — this credential does not belong to this wallet");
    }

    const claimed: SoulboundCredential = { ...credential, status: "CLAIMED" };
    this.store.set(credentialId, claimed);
    return claimed;
  }

  async revoke(credentialId: SoulboundCredentialId, issuerOrgId: string): Promise<void> {
    const credential = this.store.get(credentialId);
    if (!credential) throw new Error(`Credential ${credentialId} not found`);
    if (credential.issuer.orgId !== issuerOrgId) {
      throw new Error("Only the original issuer can revoke this credential");
    }
    this.store.set(credentialId, { ...credential, status: "REVOKED" });
  }

  async listByWalletHash(walletHash: string): Promise<StoredCredential[]> {
    const results: StoredCredential[] = [];
    for (const [id, credential] of this.store) {
      if (credential.subject.walletHash === walletHash) {
        results.push({ id, credential });
      }
    }
    return results;
  }

  async generateProof(
    credentialId: SoulboundCredentialId,
    resourceId: string,
    disclosureFields: string[]
  ): Promise<SoulboundMembershipProof> {
    const credential = this.store.get(credentialId);
    if (!credential) throw new Error(`Credential ${credentialId} not found`);
    if (credential.status !== "CLAIMED") {
      throw new Error("Credential must be CLAIMED to generate a proof");
    }

    const nowSecs = Math.floor(Date.now() / 1000);
    if (credential.expiresAt !== undefined && credential.expiresAt < nowSecs) {
      throw new Error("Cannot generate proof for an expired credential");
    }

    const disclosed: Record<string, unknown> = {};
    for (const field of disclosureFields) {
      if (field === "orgId") disclosed["orgId"] = credential.issuer.orgId;
      if (field === "resourceId") disclosed["resourceId"] = resourceId;
      if (field === "accessLevel") {
        const level = credential.subject.metadata?.["accessLevel"];
        if (level !== undefined) disclosed["accessLevel"] = level;
      }
    }

    return {
      proofData: `mock-zk-proof-${randomUUID()}`,
      disclosedFields: disclosed,
      resourceId,
      expectedOrgId: credential.issuer.orgId,
      nonce: randomUUID(),
      generatedAt: nowSecs,
    };
  }

  async verifyProof(
    proof: SoulboundMembershipProof
  ): Promise<SoulboundProofVerificationResult> {
    const isValid = proof.proofData.startsWith("mock-zk-proof-");
    const orgId = proof.disclosedFields["orgId"];
    const result: SoulboundProofVerificationResult = {
      isValid,
      resourceId: proof.resourceId,
      verifiedAt: Math.floor(Date.now() / 1000),
    };
    if (typeof orgId === "string") result.orgId = orgId;
    return result;
  }
}
