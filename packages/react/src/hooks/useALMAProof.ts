"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  SoulboundCredentialId,
  SoulboundMembershipProof,
} from "@adasouls/soulbound-core";
import type { SoulboundProvider } from "@adasouls/soulbound-sdk";
import { SoulboundHolder, SoulboundVerifier } from "@adasouls/soulbound-sdk";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseALMAProofOptions {
  /** The connected wallet address. Pass null/undefined if not connected. */
  walletAddress: string | null | undefined;
  /** The provider instance to use for credential queries and proof generation. */
  provider: SoulboundProvider;
  /** Resource ID to check access for (e.g., "aldea-world:main-gate"). */
  resourceId: string;
  /** Optional: filter by issuer organization ID. */
  orgId?: string;
  /** Fields to disclose in the ZK proof. Defaults to ["resourceId", "accessLevel"]. */
  disclosureFields?: string[];
  /** Whether to auto-verify on mount/wallet change. Defaults to true. */
  autoVerify?: boolean;
}

export interface UseALMAProofResult {
  /** True if the wallet has a valid, verified ALMA credential for the resource. */
  isVerified: boolean;
  /** True while checking credentials or generating/verifying proof. */
  isLoading: boolean;
  /** Error message if verification failed. */
  error: string | null;
  /** The access level (e.g., "MEMBER", "TRIAL", "FOUNDING_MEMBER"). */
  accessLevel: string | null;
  /** The credential ID that was verified. */
  credentialId: SoulboundCredentialId | null;
  /** The generated ZK proof (available after successful verification). */
  proof: SoulboundMembershipProof | null;
  /** True if the credential is a trial. */
  isTrial: boolean;
  /** Manually trigger re-verification. */
  verify: () => Promise<void>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * useALMAProof — Full ALMA verification flow as a React hook.
 *
 * Detects wallet → finds credentials → generates ZK proof → verifies.
 * Returns `{ isVerified, isLoading, error, accessLevel, proof }`.
 *
 * @example
 *   const { isVerified, isLoading, error } = useALMAProof({
 *     walletAddress: connectedAddress,
 *     provider: myProvider,
 *     resourceId: "aldea-world:main-gate",
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (!isVerified) return <NotAMember />;
 *   return <ProtectedContent />;
 */
export function useALMAProof(options: UseALMAProofOptions): UseALMAProofResult {
  const {
    walletAddress,
    provider,
    resourceId,
    orgId,
    disclosureFields = ["resourceId", "accessLevel"],
    autoVerify = true,
  } = options;

  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState<SoulboundCredentialId | null>(null);
  const [proof, setProof] = useState<SoulboundMembershipProof | null>(null);
  const [isTrial, setIsTrial] = useState(false);

  const verify = useCallback(async () => {
    if (!walletAddress) {
      setIsVerified(false);
      setError(null);
      setAccessLevel(null);
      setCredentialId(null);
      setProof(null);
      setIsTrial(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Check if wallet has a valid credential
      const holder = new SoulboundHolder(walletAddress, provider);
      const access = await holder.findValidAccess(resourceId, orgId);

      if (!access) {
        // No valid credential — check if there are pending ones to claim first
        const pending = await holder.listPending();
        const pendingForResource = pending.find(
          ({ credential }) =>
            credential.subject.metadata?.["resourceId"] === resourceId &&
            (orgId === undefined || credential.issuer.orgId === orgId)
        );

        if (pendingForResource) {
          // Auto-claim pending credential
          await holder.claim(pendingForResource.id);
          // Re-check after claim
          const rechecked = await holder.findValidAccess(resourceId, orgId);
          if (!rechecked) {
            setIsVerified(false);
            setError("Credential claimed but verification failed");
            return;
          }
          // Continue with the rechecked credential
          await processCredential(holder, rechecked.id, rechecked.credential);
        } else {
          setIsVerified(false);
          setAccessLevel(null);
          setCredentialId(null);
          setProof(null);
          setIsTrial(false);
        }
        return;
      }

      await processCredential(holder, access.id, access.credential);
    } catch (err) {
      setIsVerified(false);
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }

    async function processCredential(
      holder: SoulboundHolder,
      credId: SoulboundCredentialId,
      credential: { subject: { metadata?: Record<string, unknown> } }
    ) {
      // Step 2: Generate ZK proof
      const generatedProof = await holder.generateProof(
        credId,
        resourceId,
        disclosureFields
      );

      // Step 3: Verify the proof
      const verifier = new SoulboundVerifier(provider);
      const result = await verifier.verifyProof(generatedProof);

      if (result.isValid) {
        const level = credential.subject.metadata?.["accessLevel"];
        const levelStr = typeof level === "string" ? level : null;

        setIsVerified(true);
        setAccessLevel(levelStr);
        setCredentialId(credId);
        setProof(generatedProof);
        setIsTrial(levelStr === "TRIAL");
      } else {
        setIsVerified(false);
        setError("ZK proof verification failed");
      }
    }
  }, [walletAddress, provider, resourceId, orgId, disclosureFields]);

  useEffect(() => {
    if (autoVerify) {
      verify();
    }
  }, [autoVerify, verify]);

  return {
    isVerified,
    isLoading,
    error,
    accessLevel,
    credentialId,
    proof,
    isTrial,
    verify,
  };
}
