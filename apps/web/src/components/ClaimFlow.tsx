"use client";

import { useState } from "react";
import { useWallet, type WalletName } from "@/hooks/useWallet";
import { WalletSelector } from "./WalletSelector";
import { ALDEA_WORLD_URL } from "@/lib/alma-config";

/**
 * ClaimFlow — Claim experience for founding members with airdrop.
 *
 * Steps:
 *   1. Welcome animation
 *   2. Connect wallet
 *   3. Check for pending ALMA credentials
 *   4. Claim with wallet signature
 *   5. ZK proof generated in background
 *   6. Redirect to ALDEA World
 */

type ClaimStep =
  | "welcome"
  | "connect"
  | "checking"
  | "found"
  | "claiming"
  | "success"
  | "not-found";

interface PendingCredential {
  id: string;
  accessLevel: string;
  issuedAt: number;
}

export function ClaimFlow() {
  const wallet = useWallet();
  const [step, setStep] = useState<ClaimStep>("welcome");
  const [credentials, setCredentials] = useState<PendingCredential[]>([]);
  const [error, setError] = useState<string>();
  const [connectingWallet, setConnectingWallet] = useState<WalletName | null>(
    null
  );

  const handleConnect = async (walletName: WalletName) => {
    setConnectingWallet(walletName);
    const result = await wallet.connect(walletName);
    setConnectingWallet(null);

    if (result) {
      await checkForCredentials(result.address);
    }
  };

  const checkForCredentials = async (address: string) => {
    setStep("checking");
    setError(undefined);

    try {
      // In production, this queries the Midnight contract via the SDK:
      //   const holder = new SoulboundHolder(address, provider);
      //   const pending = await holder.listPending();
      //
      // For testnet, we simulate the check. The real implementation
      // will use MidnightProvider once deployed.

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // TODO: Replace with real SDK query
      // For now, simulate finding credentials for demo purposes
      const mockPending: PendingCredential[] = [];

      if (mockPending.length > 0) {
        setCredentials(mockPending);
        setStep("found");
      } else {
        setStep("not-found");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check credentials"
      );
      setStep("not-found");
    }
  };

  const handleClaim = async () => {
    setStep("claiming");
    setError(undefined);

    try {
      // In production:
      //   const holder = new SoulboundHolder(wallet.address!, provider);
      //   await holder.claimAll();
      //   const proof = await holder.generateProof(credId, "aldea-world:main-gate");

      // Simulate claim process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
      setStep("found"); // Go back to retry
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Step: Welcome */}
      {step === "welcome" && (
        <div className="alma-fade-in text-center">
          <div className="relative mb-8">
            {/* Decorative glow ring */}
            <div className="w-32 h-32 rounded-full border-2 border-[var(--alma-accent)]/20 mx-auto flex items-center justify-center alma-glow">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
                <span className="text-4xl font-bold text-[var(--alma-accent)] alma-glow-text">
                  A
                </span>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-3">Welcome back, founder</h2>
          <p className="text-[var(--alma-text-muted)] mb-8 leading-relaxed">
            As an original ALDEA member, your ALMA credential is waiting for
            you. Connect your wallet to claim it and unlock access to ALDEA
            World.
          </p>

          <button
            onClick={() => setStep("connect")}
            className="alma-btn alma-btn-primary w-full"
          >
            Claim my ALMA
          </button>

          <p className="text-xs text-[var(--alma-text-dim)] mt-4">
            New to ALDEA?{" "}
            <a href="/mint" className="text-[var(--alma-accent)] hover:underline">
              Mint a new credential instead
            </a>
          </p>
        </div>
      )}

      {/* Step: Connect Wallet */}
      {step === "connect" && (
        <div className="alma-fade-in">
          <WalletSelector
            onSelect={handleConnect}
            connecting={wallet.connecting}
            connectingWallet={connectingWallet}
          />
          {wallet.error && (
            <p className="text-sm text-[var(--alma-error)] mt-3">
              {wallet.error}
            </p>
          )}
          <button
            onClick={() => setStep("welcome")}
            className="w-full mt-4 text-sm text-[var(--alma-text-muted)] hover:text-[var(--alma-text)]"
          >
            Back
          </button>
        </div>
      )}

      {/* Step: Checking */}
      {step === "checking" && (
        <div className="alma-fade-in text-center py-12">
          <div className="alma-spinner mx-auto mb-4" />
          <p className="text-[var(--alma-text-muted)]">
            Checking for pending credentials...
          </p>
          <p className="text-xs text-[var(--alma-text-dim)] mt-2 font-mono break-all">
            {wallet.address}
          </p>
        </div>
      )}

      {/* Step: Found credentials */}
      {step === "found" && (
        <div className="alma-fade-in">
          <div className="alma-card mb-6 border-[var(--alma-accent)]/20">
            <p className="text-sm text-[var(--alma-accent)] font-medium mb-3">
              {credentials.length} credential{credentials.length > 1 ? "s" : ""}{" "}
              found
            </p>

            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center justify-between py-2 border-t border-[var(--alma-border)]"
              >
                <div>
                  <p className="text-sm font-medium">ALMA Access</p>
                  <p className="text-xs text-[var(--alma-text-dim)]">
                    {cred.accessLevel}
                  </p>
                </div>
                <span className="text-xs text-[var(--alma-warning)] bg-[var(--alma-warning)]/10 px-2 py-1 rounded">
                  PENDING
                </span>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-[var(--alma-error)] mb-4">{error}</p>
          )}

          <button
            onClick={handleClaim}
            className="w-full alma-btn alma-btn-primary"
          >
            Claim All
          </button>
        </div>
      )}

      {/* Step: Claiming */}
      {step === "claiming" && (
        <div className="alma-fade-in text-center py-12">
          <div className="alma-spinner mx-auto mb-4" />
          <p className="text-[var(--alma-text-muted)]">
            Claiming your ALMA credentials...
          </p>
          <p className="text-xs text-[var(--alma-text-dim)] mt-2">
            Signing ZK proof of wallet ownership
          </p>
        </div>
      )}

      {/* Step: Success */}
      {step === "success" && (
        <div className="alma-fade-in text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--alma-success)]/10 border border-[var(--alma-success)]/30 flex items-center justify-center mx-auto mb-6">
            <span className="text-[var(--alma-success)] text-3xl">
              &#10003;
            </span>
          </div>

          <h2 className="text-2xl font-bold mb-2">Welcome to ALDEA World</h2>
          <p className="text-[var(--alma-text-muted)] mb-2">
            Your ALMA credentials have been claimed. A ZK proof is being
            generated for instant access.
          </p>
          <p className="text-sm text-[var(--alma-accent)] mb-8">
            FOUNDING_MEMBER access granted
          </p>

          <a
            href={ALDEA_WORLD_URL}
            className="alma-btn alma-btn-primary w-full"
          >
            Enter ALDEA World
          </a>
        </div>
      )}

      {/* Step: Not Found */}
      {step === "not-found" && (
        <div className="alma-fade-in text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--alma-bg-elevated)] border border-[var(--alma-border)] flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl text-[var(--alma-text-dim)]">?</span>
          </div>

          <h2 className="text-xl font-bold mb-2">No pending credentials</h2>
          <p className="text-[var(--alma-text-muted)] mb-2">
            We didn&apos;t find any pending ALMA credentials for this wallet.
          </p>
          <p className="text-sm text-[var(--alma-text-dim)] font-mono mb-8 break-all">
            {wallet.address}
          </p>

          {error && (
            <p className="text-sm text-[var(--alma-error)] mb-4">{error}</p>
          )}

          <div className="space-y-3">
            <a href="/mint" className="alma-btn alma-btn-primary w-full">
              Mint a new ALMA instead
            </a>
            <button
              onClick={() => {
                wallet.disconnect();
                setStep("connect");
              }}
              className="w-full text-sm text-[var(--alma-text-muted)] hover:text-[var(--alma-text)]"
            >
              Try a different wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
