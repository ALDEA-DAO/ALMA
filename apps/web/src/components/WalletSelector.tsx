"use client";

import type { WalletName } from "@/hooks/useWallet";

const WALLETS: { name: WalletName; label: string }[] = [
  { name: "lace", label: "Lace" },
  { name: "nami", label: "Nami" },
  { name: "eternl", label: "Eternl" },
  { name: "flint", label: "Flint" },
  { name: "typhon", label: "Typhon" },
];

interface WalletSelectorProps {
  onSelect: (wallet: WalletName) => void;
  connecting: boolean;
  connectingWallet: WalletName | null;
}

export function WalletSelector({
  onSelect,
  connecting,
  connectingWallet,
}: WalletSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--alma-text-muted)] mb-4">
        Select your Cardano wallet to continue
      </p>
      {WALLETS.map(({ name, label }) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          disabled={connecting}
          className="w-full alma-card flex items-center justify-between cursor-pointer hover:border-[var(--alma-border-glow)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="font-medium">{label}</span>
          {connecting && connectingWallet === name ? (
            <span className="alma-spinner" />
          ) : (
            <span className="text-sm text-[var(--alma-text-dim)]">
              Connect
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
