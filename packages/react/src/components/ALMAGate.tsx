"use client";

import { type ReactNode } from "react";
import type { SoulboundProvider } from "@adasouls/soulbound-sdk";
import { useALMAProof } from "../hooks/useALMAProof.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ALMAGateProps {
  /** Connected wallet address. Pass null if not connected. */
  walletAddress: string | null | undefined;
  /** The SoulboundProvider to use for credential checks. */
  provider: SoulboundProvider;
  /** Issuer organization ID (policy ID on Cardano). */
  orgId: string;
  /** Resource ID to gate access for (e.g., "aldea-world:main-gate"). */
  resourceId: string;
  /** Content to render when access is verified. */
  children: ReactNode;
  /** Content to render when the user does NOT have access. */
  fallback: ReactNode;
  /** Content to render while verifying (optional — defaults to null). */
  loading?: ReactNode;
  /** Content to render when no wallet is connected (optional — defaults to fallback). */
  noWallet?: ReactNode;
  /** Callback fired when verification completes. */
  onVerified?: (result: {
    isVerified: boolean;
    accessLevel: string | null;
  }) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * ALMAGate — Access control component for the Soulbound Protocol.
 *
 * Wraps content and only renders it if the connected wallet has a valid
 * ALMA credential for the given resource. Shows a fallback otherwise.
 *
 * This is the primary integration point for applications like ALDEA World.
 *
 * @example
 *   <ALMAGate
 *     walletAddress={connectedAddress}
 *     provider={provider}
 *     orgId="aldea-dao-policy-id"
 *     resourceId="aldea-world:main-gate"
 *     fallback={<NotAMember />}
 *     loading={<Spinner />}
 *   >
 *     <ALDEAWorldApp />
 *   </ALMAGate>
 */
export function ALMAGate({
  walletAddress,
  provider,
  orgId,
  resourceId,
  children,
  fallback,
  loading = null,
  noWallet,
  onVerified,
}: ALMAGateProps) {
  const { isVerified, isLoading, accessLevel } = useALMAProof({
    walletAddress,
    provider,
    resourceId,
    orgId,
  });

  // Notify parent when verification state changes
  if (onVerified && !isLoading) {
    onVerified({ isVerified, accessLevel });
  }

  // No wallet connected
  if (!walletAddress) {
    return <>{noWallet ?? fallback}</>;
  }

  // Still verifying
  if (isLoading) {
    return <>{loading}</>;
  }

  // Verified — show protected content
  if (isVerified) {
    return <>{children}</>;
  }

  // Not verified — show fallback
  return <>{fallback}</>;
}
