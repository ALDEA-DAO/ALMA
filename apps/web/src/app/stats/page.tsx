import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stats — ALMA Protocol",
  description: "Public metrics for the ALMA credential protocol.",
};

// In production, these would come from on-chain queries via Blockfrost
// or an indexer. For now, placeholder values for the testnet launch.
const PLACEHOLDER_STATS = {
  totalMinted: 0,
  totalClaimed: 0,
  totalPending: 0,
  treasuryBalance: "0",
  mintPrice: "35",
  activeIssuers: 1,
};

export default function StatsPage() {
  const stats = PLACEHOLDER_STATS;

  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <h1 className="text-4xl font-bold mb-4">Protocol Stats</h1>
      <p className="text-[var(--alma-text-muted)] mb-12">
        Public on-chain metrics for the ALMA protocol. Updated in real-time from
        the Cardano and Midnight networks.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
        <StatCard label="Total Minted" value={stats.totalMinted.toString()} />
        <StatCard label="Claimed" value={stats.totalClaimed.toString()} />
        <StatCard label="Pending" value={stats.totalPending.toString()} />
        <StatCard
          label="Mint Price"
          value={`${stats.mintPrice} ADA`}
        />
        <StatCard label="Active Issuers" value={stats.activeIssuers.toString()} />
        <StatCard
          label="Treasury"
          value={`${stats.treasuryBalance} ADA`}
        />
      </div>

      <div className="alma-card">
        <h2 className="text-lg font-semibold mb-3">Network</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[var(--alma-text-dim)]">Environment</p>
            <p className="text-[var(--alma-text)]">Cardano Preprod Testnet</p>
          </div>
          <div>
            <p className="text-[var(--alma-text-dim)]">Privacy Layer</p>
            <p className="text-[var(--alma-text)]">Midnight Devnet</p>
          </div>
          <div>
            <p className="text-[var(--alma-text-dim)]">Registry Contract</p>
            <p className="font-mono text-xs text-[var(--alma-text-muted)] break-all">
              SoulboundRegistry (Plutus V3)
            </p>
          </div>
          <div>
            <p className="text-[var(--alma-text-dim)]">Mint Contract</p>
            <p className="font-mono text-xs text-[var(--alma-text-muted)] break-all">
              PublicMint (Plutus V3)
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--alma-text-dim)] mt-8 text-center">
        Stats are currently placeholder values. Live data will be available
        after testnet deployment.
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="alma-card text-center">
      <p className="text-2xl font-bold text-[var(--alma-text)]">{value}</p>
      <p className="text-xs text-[var(--alma-text-muted)] mt-1">{label}</p>
    </div>
  );
}
