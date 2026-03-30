import type {
  SoulboundCredential,
  SoulboundCredentialId,
  SoulboundMembershipProof,
} from "@adasouls/soulbound-core";
import type { SoulboundProvider, StoredCredential } from "./providers/types.js";

export class SoulboundHolder {
  constructor(
    private readonly walletAddress: string,
    private readonly provider: SoulboundProvider
  ) {}

  /**
   * List all valid credentials for this wallet: CLAIMED and not expired.
   */
  async listOwned(): Promise<StoredCredential[]> {
    const walletHash = this.provider.hashWalletAddress(this.walletAddress);
    const all = await this.provider.listByWalletHash(walletHash);
    const nowSecs = Math.floor(Date.now() / 1000);
    return all.filter(
      ({ credential }) =>
        credential.status === "CLAIMED" &&
        (credential.expiresAt === undefined || credential.expiresAt > nowSecs)
    );
  }

  /**
   * List credentials pending claim (issued by an org, not yet claimed).
   */
  async listPending(): Promise<StoredCredential[]> {
    const walletHash = this.provider.hashWalletAddress(this.walletAddress);
    const all = await this.provider.listByWalletHash(walletHash);
    return all.filter(({ credential }) => credential.status === "PENDING");
  }

  /**
   * Claim a PENDING credential. On real Midnight, this requires a ZK wallet signature.
   */
  async claim(credentialId: SoulboundCredentialId): Promise<SoulboundCredential> {
    return this.provider.claim(credentialId, this.walletAddress);
  }

  /**
   * Claim all pending credentials for this wallet at once.
   * Useful during onboarding: user connects wallet and everything is ready.
   */
  async claimAll(): Promise<SoulboundCredential[]> {
    const pending = await this.listPending();
    return Promise.all(pending.map(({ id }) => this.claim(id)));
  }

  /**
   * Find a valid access credential for a specific resource.
   * Returns the credential if found, undefined otherwise.
   */
  async findValidAccess(
    resourceId: string,
    orgId?: string
  ): Promise<StoredCredential | undefined> {
    const owned = await this.listOwned();
    return owned.find(({ credential }) => {
      const matchesResource =
        credential.subject.metadata?.["resourceId"] === resourceId;
      const matchesOrg =
        orgId === undefined || credential.issuer.orgId === orgId;
      return matchesResource && matchesOrg;
    });
  }

  /**
   * Generate a ZK membership proof to access a resource.
   * The proof can be passed to SoulboundVerifier without revealing the holder's identity.
   *
   * @example
   *   const proof = await holder.generateProof(credId, "my-game:main");
   *   const result = await verifier.verifyProof(proof);
   *   if (result.isValid) allowEntry();
   */
  async generateProof(
    credentialId: SoulboundCredentialId,
    resourceId: string,
    disclosureFields: string[] = ["resourceId", "accessLevel"]
  ): Promise<SoulboundMembershipProof> {
    return this.provider.generateProof(credentialId, resourceId, disclosureFields);
  }
}
