/**
 * Unit tests for SoulboundCredentialContract (Midnight/Compact)
 *
 * Tests validate the contract logic through the MockProvider,
 * which mirrors the Compact contract's behavior:
 *   - issue()                     → credential in PENDING state
 *   - claim()                     → ZK ownership proof, transitions to CLAIMED
 *   - revoke()                    → only issuer, transitions to REVOKED
 *   - generate_membership_proof() → ZK proof without revealing wallet
 *   - verify_membership_proof()   → validates proof correctness
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SoulboundIssuer } from "../../../packages/sdk/src/issuer.js";
import { SoulboundHolder } from "../../../packages/sdk/src/holder.js";
import { SoulboundVerifier } from "../../../packages/sdk/src/verifier.js";
import { MockProvider } from "../../../packages/sdk/src/providers/mock.js";
import type { SoulboundIssuer as SoulboundOrganization } from "@adasouls/soulbound-core";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const RESOURCE_MAIN = "example-app:main-gate";
const RESOURCE_DOCS = "example-app:docs";

const daoOrg: SoulboundOrganization = {
  orgId: "dao-policy-id-001",
  orgName: "Example DAO",
  orgType: "DAO",
  publicKey: "ed25519-pubkey-dao",
};

const hospitalOrg: SoulboundOrganization = {
  orgId: "hospital-policy-id-002",
  orgName: "Example Hospital",
  orgType: "HOSPITAL",
  publicKey: "ed25519-pubkey-hospital",
};

let provider: MockProvider;
let issuer: SoulboundIssuer;
let verifier: SoulboundVerifier;

beforeEach(() => {
  provider = new MockProvider();
  issuer = new SoulboundIssuer(daoOrg, provider);
  verifier = new SoulboundVerifier(provider);
});

// ─── issue() ─────────────────────────────────────────────────────────────────

describe("issue()", () => {
  it("emits a credential in PENDING state", async () => {
    const wallet = "addr1_issue_test";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });

    expect(credId).toBeDefined();
    expect(credId).toContain("soulbound:cred:");

    const holder = new SoulboundHolder(wallet, provider);
    const pending = await holder.listPending();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending.some((c) => c.id === credId)).toBe(true);
  });

  it("creates credential with correct issuer org info", async () => {
    const wallet = "addr1_issuer_check";
    const credId = await issuer.emit({
      schema: "soulbound:v1:membership",
      subject: { walletAddress: wallet },
    });

    const holder = new SoulboundHolder(wallet, provider);
    const pending = await holder.listPending();
    const cred = pending.find((c) => c.id === credId);
    expect(cred).toBeDefined();
    expect(cred!.credential.issuer.orgId).toBe(daoOrg.orgId);
    expect(cred!.credential.issuer.orgName).toBe("Example DAO");
    expect(cred!.credential.issuer.orgType).toBe("DAO");
  });

  it("emitTrial creates a time-limited credential", async () => {
    const wallet = "addr1_trial_test";
    const credId = await issuer.emitTrial(wallet, RESOURCE_MAIN, 7);

    const holder = new SoulboundHolder(wallet, provider);
    const pending = await holder.listPending();
    const cred = pending.find((c) => c.id === credId);
    expect(cred).toBeDefined();
    expect(cred!.credential.expiresAt).toBeDefined();
    const nowSecs = Math.floor(Date.now() / 1000);
    const diff = cred!.credential.expiresAt! - nowSecs;
    expect(diff).toBeGreaterThan(6 * 86400);
    expect(diff).toBeLessThanOrEqual(8 * 86400);
  });

  it("can issue multiple credentials to different wallets", async () => {
    const cred1 = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: "addr1_multi_1", resourceId: RESOURCE_MAIN },
    });
    const cred2 = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: "addr1_multi_2", resourceId: RESOURCE_MAIN },
    });
    expect(cred1).not.toBe(cred2);
  });

  it("PENDING credentials do not grant access", async () => {
    const wallet = "addr1_pending_no_access";
    await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const result = await verifier.checkAccess(wallet, { resourceId: RESOURCE_MAIN });
    expect(result.hasAccess).toBe(false);
  });
});

// ─── claim() ─────────────────────────────────────────────────────────────────

describe("claim()", () => {
  it("transitions credential from PENDING to CLAIMED", async () => {
    const wallet = "addr1_claim_test";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });

    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);

    const owned = await holder.listOwned();
    expect(owned.some((c) => c.id === credId)).toBe(true);
    const pending = await holder.listPending();
    expect(pending.some((c) => c.id === credId)).toBe(false);
  });

  it("wrong wallet cannot claim another wallet's credential", async () => {
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: "addr1_real_owner", resourceId: RESOURCE_MAIN },
    });
    const attackerHolder = new SoulboundHolder("addr1_attacker", provider);
    await expect(attackerHolder.claim(credId)).rejects.toThrow();
  });

  it("cannot claim a credential that does not exist", async () => {
    const holder = new SoulboundHolder("addr1_no_cred", provider);
    await expect(holder.claim("soulbound:cred:nonexistent" as any)).rejects.toThrow();
  });

  it("cannot claim an already claimed credential (idempotent)", async () => {
    const wallet = "addr1_double_claim";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);
    await holder.claim(credId);
    const owned = await holder.listOwned();
    expect(owned.filter((c) => c.id === credId)).toHaveLength(1);
  });

  it("claimed credential grants access", async () => {
    const wallet = "addr1_claimed_access";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);
    const result = await verifier.checkAccess(wallet, { resourceId: RESOURCE_MAIN });
    expect(result.hasAccess).toBe(true);
  });

  it("claimAll claims all pending credentials at once", async () => {
    const wallet = "addr1_claimall";
    await issuer.emit({ schema: "soulbound:v1:access", subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN } });
    await issuer.emit({ schema: "soulbound:v1:membership", subject: { walletAddress: wallet } });

    const holder = new SoulboundHolder(wallet, provider);
    expect(await holder.listPending()).toHaveLength(2);
    await holder.claimAll();
    expect(await holder.listPending()).toHaveLength(0);
    expect(await holder.listOwned()).toHaveLength(2);
  });
});

// ─── revoke() ────────────────────────────────────────────────────────────────

describe("revoke()", () => {
  it("revoked credential denies access", async () => {
    const wallet = "addr1_revoke_test";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);
    expect((await verifier.checkAccess(wallet, { resourceId: RESOURCE_MAIN })).hasAccess).toBe(true);

    await issuer.revoke(credId);
    expect((await verifier.checkAccess(wallet, { resourceId: RESOURCE_MAIN })).hasAccess).toBe(false);
  });

  it("cannot revoke a non-existent credential", async () => {
    await expect(issuer.revoke("soulbound:cred:ghost" as any)).rejects.toThrow();
  });

  it("another org cannot revoke credentials issued by a different org", async () => {
    const wallet = "addr1_cross_revoke";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN },
    });
    const otherIssuer = new SoulboundIssuer(hospitalOrg, provider);
    await expect(otherIssuer.revoke(credId)).rejects.toThrow();
  });

  it("cannot claim a revoked credential", async () => {
    const wallet = "addr1_revoke_before_claim";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN },
    });
    await issuer.revoke(credId);
    const holder = new SoulboundHolder(wallet, provider);
    await expect(holder.claim(credId)).rejects.toThrow();
  });
});

// ─── generate_membership_proof() ─────────────────────────────────────────────

describe("generate_membership_proof()", () => {
  it("generates a valid ZK proof for a claimed credential", async () => {
    const wallet = "addr1_proof_gen";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);

    const proof = await holder.generateProof(credId, RESOURCE_MAIN);
    expect(proof).toBeDefined();
    expect(proof.proofData).toBeDefined();
    expect(proof.resourceId).toBe(RESOURCE_MAIN);
    expect(proof.expectedOrgId).toBe(daoOrg.orgId);
    expect(proof.nonce).toBeDefined();
  });

  it("each proof has a unique nonce (replay prevention)", async () => {
    const wallet = "addr1_nonce_unique";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);

    const proof1 = await holder.generateProof(credId, RESOURCE_MAIN);
    const proof2 = await holder.generateProof(credId, RESOURCE_MAIN);
    expect(proof1.nonce).not.toBe(proof2.nonce);
    expect(proof1.proofData).not.toBe(proof2.proofData);
  });

  it("cannot generate proof for a PENDING credential", async () => {
    const wallet = "addr1_proof_pending";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await expect(holder.generateProof(credId, RESOURCE_MAIN)).rejects.toThrow();
  });

  it("cannot generate proof for an expired credential", async () => {
    const wallet = "addr1_proof_expired";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
      expiresAt: yesterday,
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);
    await expect(holder.generateProof(credId, RESOURCE_MAIN)).rejects.toThrow();
  });

  it("proof includes selectively disclosed fields", async () => {
    const wallet = "addr1_proof_disclose";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);

    const proof = await holder.generateProof(credId, RESOURCE_MAIN, ["orgId", "accessLevel"]);
    expect(proof.disclosedFields["orgId"]).toBe(daoOrg.orgId);
    expect(proof.disclosedFields["accessLevel"]).toBe("MEMBER");
  });

  it("proof without disclosure fields reveals nothing", async () => {
    const wallet = "addr1_proof_no_disclose";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);

    const proof = await holder.generateProof(credId, RESOURCE_MAIN, []);
    expect(Object.keys(proof.disclosedFields)).toHaveLength(0);
  });
});

// ─── verify_membership_proof() ───────────────────────────────────────────────

describe("verify_membership_proof()", () => {
  it("valid proof passes verification", async () => {
    const wallet = "addr1_verify_ok";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);

    const proof = await holder.generateProof(credId, RESOURCE_MAIN);
    const result = await verifier.verifyProof(proof);
    expect(result.isValid).toBe(true);
    expect(result.resourceId).toBe(RESOURCE_MAIN);
  });

  it("tampered proof fails verification", async () => {
    const wallet = "addr1_verify_tampered";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);

    const proof = await holder.generateProof(credId, RESOURCE_MAIN);
    proof.proofData = "tampered-invalid-proof";
    const result = await verifier.verifyProof(proof);
    expect(result.isValid).toBe(false);
  });

  it("verification returns orgId when disclosed", async () => {
    const wallet = "addr1_verify_org";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);

    const proof = await holder.generateProof(credId, RESOURCE_MAIN, ["orgId"]);
    const result = await verifier.verifyProof(proof);
    expect(result.isValid).toBe(true);
    expect(result.orgId).toBe(daoOrg.orgId);
  });
});

// ─── Cross-cutting: expiry ───────────────────────────────────────────────────

describe("Credential expiry", () => {
  it("expired credential denies access even if CLAIMED", async () => {
    const wallet = "addr1_expired_access";
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
      expiresAt: past,
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);
    expect((await verifier.checkAccess(wallet, { resourceId: RESOURCE_MAIN })).hasAccess).toBe(false);
  });

  it("credential without expiresAt never expires", async () => {
    const wallet = "addr1_no_expiry";
    const credId = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const holder = new SoulboundHolder(wallet, provider);
    await holder.claim(credId);
    const result = await verifier.checkAccess(wallet, { resourceId: RESOURCE_MAIN });
    expect(result.hasAccess).toBe(true);
    expect(result.expiresAt).toBeUndefined();
  });
});

// ─── Cross-cutting: multi-org isolation ──────────────────────────────────────

describe("Multi-org isolation", () => {
  it("credentials from different orgs are independent", async () => {
    const wallet = "addr1_multi_org";
    const hospitalIssuer = new SoulboundIssuer(hospitalOrg, provider);

    const daoCred = await issuer.emit({
      schema: "soulbound:v1:access",
      subject: { walletAddress: wallet, resourceId: RESOURCE_MAIN, accessLevel: "MEMBER" },
    });
    const hospitalCred = await hospitalIssuer.emit({
      schema: "soulbound:v1:professional",
      subject: { walletAddress: wallet, resourceId: "hospital:system" },
    });

    const holder = new SoulboundHolder(wallet, provider);
    await holder.claimAll();
    expect(await holder.listOwned()).toHaveLength(2);

    // Revoking one doesn't affect the other
    await issuer.revoke(daoCred);
    expect((await verifier.checkAccess(wallet, { resourceId: RESOURCE_MAIN })).hasAccess).toBe(false);

    const ownedAfterRevoke = await holder.listOwned();
    const hospitalStored = ownedAfterRevoke.find((c) => c.id === hospitalCred);
    expect(hospitalStored).toBeDefined();
    expect(hospitalStored!.credential.status).toBe("CLAIMED");
  });
});
