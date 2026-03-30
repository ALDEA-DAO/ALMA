"use client";

import { useState, useMemo } from "react";
import { MockProvider } from "@adasouls/soulbound-sdk";
import { ALMAGate } from "@adasouls/soulbound-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { NotAMember } from "@/components/NotAMember";
import { ALDEAWorldContent } from "@/components/ALDEAWorldContent";

/**
 * TASK-033 — ALDEA World Demo
 *
 * End-to-end demo of the ALMA access control flow:
 *   1. User connects wallet
 *   2. ALMAGate checks for valid ALMA credential
 *   3. If verified → shows ALDEA World content
 *   4. If not → shows NotAMember with CTA to mint
 *
 * Uses MockProvider for testnet demo. Replace with MidnightProvider
 * for production deployment.
 */

const ALDEA_ORG_ID = process.env.NEXT_PUBLIC_ALDEA_POLICY_ID ?? "aldea-dao-policy-id";
const RESOURCE_ID = "aldea-world:main-gate";

export default function ALDEAWorldDemoPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<string | null>(null);

  // In production, use MidnightProvider with real contract addresses.
  // MockProvider lets us demo the full flow without a running network.
  const provider = useMemo(() => new MockProvider(), []);

  // Not connected — show wallet connect screen
  if (!walletAddress) {
    return <ConnectWallet onConnect={setWalletAddress} />;
  }

  return (
    <ALMAGate
      walletAddress={walletAddress}
      provider={provider}
      orgId={ALDEA_ORG_ID}
      resourceId={RESOURCE_ID}
      loading={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center animate-fade-in">
            <div className="spinner mx-auto mb-4" />
            <p className="text-[var(--aldea-text-muted)]">
              Verifying ALMA credential...
            </p>
            <p className="text-xs text-[var(--aldea-text-dim)] mt-2">
              Generating ZK proof for access verification
            </p>
          </div>
        </div>
      }
      fallback={<NotAMember />}
      onVerified={(result) => setAccessLevel(result.accessLevel)}
    >
      <ALDEAWorldContent
        walletAddress={walletAddress}
        accessLevel={accessLevel}
      />
    </ALMAGate>
  );
}
