"use client";

import { useState } from "react";

type WalletName = "lace" | "nami" | "eternl" | "flint" | "typhon";

const WALLETS: { name: WalletName; label: string }[] = [
  { name: "lace", label: "Lace" },
  { name: "nami", label: "Nami" },
  { name: "eternl", label: "Eternl" },
  { name: "flint", label: "Flint" },
];

interface ConnectWalletProps {
  onConnect: (address: string) => void;
}

/**
 * Wallet connection screen for the ALDEA World demo.
 */
export function ConnectWallet({ onConnect }: ConnectWalletProps) {
  const [connecting, setConnecting] = useState<WalletName | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (walletName: WalletName) => {
    setConnecting(walletName);
    setError(null);

    try {
      const { BrowserWallet } = await import("@meshsdk/core");
      const wallet = await BrowserWallet.enable(walletName);
      const addresses = await wallet.getUsedAddresses();

      if (addresses.length === 0) {
        throw new Error("No addresses found in wallet.");
      }

      onConnect(addresses[0]!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
      <div className="max-w-sm w-full">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
            A
          </div>
          <h1 className="text-2xl font-bold mb-2">Enter ALDEA World</h1>
          <p className="text-sm text-[var(--aldea-text-muted)]">
            Connect your Cardano wallet to verify your ALMA credential.
          </p>
        </div>

        <div className="space-y-2">
          {WALLETS.map(({ name, label }) => (
            <button
              key={name}
              onClick={() => handleConnect(name)}
              disabled={connecting !== null}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-[var(--aldea-bg-card)] border border-[var(--aldea-border)] hover:border-[var(--aldea-accent)]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-medium">{label}</span>
              {connecting === name ? (
                <span className="spinner" />
              ) : (
                <span className="text-xs text-[var(--aldea-text-dim)]">Connect</span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-[var(--aldea-error)] mt-4 text-center">
            {error}
          </p>
        )}

        <p className="text-xs text-[var(--aldea-text-dim)] text-center mt-8">
          Don&apos;t have an ALMA credential?{" "}
          <a
            href={process.env.NEXT_PUBLIC_ALMA_URL ?? "https://alma.aldea.world"}
            className="text-[var(--aldea-accent)] hover:underline"
          >
            Get one here
          </a>
        </p>
      </div>
    </div>
  );
}
