import { describe, it, expect } from "vitest";
import { SoulboundIssuer } from "../issuer.js";
import { SoulboundHolder } from "../holder.js";
import { SoulboundVerifier } from "../verifier.js";
import { MockProvider } from "../providers/mock.js";
import type { SoulboundIssuer as SoulboundOrganization } from "@adasouls/soulbound-core";

const GAME_RESOURCE = "my-game:main";

const exampleOrg: SoulboundOrganization = {
  orgId: "example-policy-id-abc123",
  orgName: "Example DAO",
  orgType: "DAO",
  publicKey: "ed25519-pubkey-mock",
};

function createSDK() {
  const provider = new MockProvider();
  const issuer = new SoulboundIssuer(exampleOrg, provider);
  const verifier = new SoulboundVerifier(provider);
  return { provider, issuer, verifier };
}

describe("Trial flow", () => {
  it("wallet without credential has no access", async () => {
    const { verifier } = createSDK();
    const result = await verifier.checkAccess("addr1_new_player", {
      resourceId: GAME_RESOURCE,
    });
    expect(result.hasAccess).toBe(false);
  });

  it("emit trial → claim → has access with isTrial=true", async () => {
    const { provider, issuer, verifier } = createSDK();
    const walletAddress = "addr1_trial_player";

    const credId = await issuer.emitTrial(walletAddress, GAME_RESOURCE, 7);

    // Before claim, no access (PENDING)
    const beforeClaim = await verifier.checkAccess(walletAddress, {
      resourceId: GAME_RESOURCE,
    });
    expect(beforeClaim.hasAccess).toBe(false);

    // Holder claims
    const holder = new SoulboundHolder(walletAddress, provider);
    await holder.claim(credId);

    // After claim, has access as TRIAL
    const afterClaim = await verifier.checkAccess(walletAddress, {
      resourceId: GAME_RESOURCE,
    });
    expect(afterClaim.hasAccess).toBe(true);
    expect(afterClaim.isTrial).toBe(true);
    expect(afterClaim.accessLevel).toBe("TRIAL");
    expect(afterClaim.expiresAt).toBeDefined();
  });

  it("emit MEMBER → claim → has access with isTrial=false", async () => {
    const { provider, issuer, verifier } = createSDK();
    const walletAddress = "addr1_member_player";

    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress, resourceId: GAME_RESOURCE, accessLevel: "MEMBER" },
    });

    const holder = new SoulboundHolder(walletAddress, provider);
    await holder.claim(credId);

    const result = await verifier.checkAccess(walletAddress, {
      resourceId: GAME_RESOURCE,
    });
    expect(result.hasAccess).toBe(true);
    expect(result.isTrial).toBe(false);
    expect(result.accessLevel).toBe("MEMBER");
    expect(result.expiresAt).toBeUndefined();
  });

  it("expired trial → no access", async () => {
    const { provider, issuer, verifier } = createSDK();
    const walletAddress = "addr1_expired_player";

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress, resourceId: GAME_RESOURCE, accessLevel: "TRIAL" },
      expiresAt: yesterday,
    });

    const holder = new SoulboundHolder(walletAddress, provider);
    await holder.claim(credId);

    const result = await verifier.checkAccess(walletAddress, {
      resourceId: GAME_RESOURCE,
    });
    expect(result.hasAccess).toBe(false);
  });

  it("revoked → no access", async () => {
    const { provider, issuer, verifier } = createSDK();
    const walletAddress = "addr1_revoked_player";

    const credId = await issuer.emitTrial(walletAddress, GAME_RESOURCE, 7);
    const holder = new SoulboundHolder(walletAddress, provider);
    await holder.claim(credId);

    await issuer.revoke(credId);

    const result = await verifier.checkAccess(walletAddress, {
      resourceId: GAME_RESOURCE,
    });
    expect(result.hasAccess).toBe(false);
  });

  it("claimAll claims all pending credentials at once", async () => {
    const { provider, issuer } = createSDK();
    const walletAddress = "addr1_bulk_player";

    await issuer.emitTrial(walletAddress, GAME_RESOURCE, 7);
    await issuer.emit({
      schema: "soulbound:v1:membership",
      subject: { walletAddress },
    });

    const holder = new SoulboundHolder(walletAddress, provider);
    const pending = await holder.listPending();
    expect(pending).toHaveLength(2);

    await holder.claimAll();

    const stillPending = await holder.listPending();
    expect(stillPending).toHaveLength(0);

    const owned = await holder.listOwned();
    expect(owned).toHaveLength(2);
  });

  it("ZK Proof flow: generateProof → verifyProof", async () => {
    const { provider, issuer, verifier } = createSDK();
    const walletAddress = "addr1_proof_player";

    const credId = await issuer.emitTrial(walletAddress, GAME_RESOURCE, 7);
    const holder = new SoulboundHolder(walletAddress, provider);
    await holder.claim(credId);

    const proof = await holder.generateProof(credId, GAME_RESOURCE);
    const result = await verifier.verifyProof(proof);

    expect(result.isValid).toBe(true);
    expect(result.resourceId).toBe(GAME_RESOURCE);
  });
});
