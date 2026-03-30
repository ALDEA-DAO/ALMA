"use client";

/**
 * Simulated ALDEA World protected content.
 *
 * In production, this is the actual ALDEA World application.
 * For the demo, we show a placeholder confirming access was granted.
 */

export function ALDEAWorldContent({
  walletAddress,
  accessLevel,
}: {
  walletAddress: string;
  accessLevel: string | null;
}) {
  return (
    <div className="min-h-screen animate-fade-in">
      {/* Header bar */}
      <header className="border-b border-[var(--aldea-border)] bg-[var(--aldea-bg-card)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
              A
            </div>
            <span className="font-semibold text-sm">ALDEA World</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--aldea-accent)] bg-[var(--aldea-accent)]/10 px-2.5 py-1 rounded-full">
              {accessLevel ?? "MEMBER"}
            </span>
            <span className="text-xs text-[var(--aldea-text-dim)] font-mono">
              {walletAddress.slice(0, 12)}...{walletAddress.slice(-6)}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="w-16 h-16 rounded-full bg-[var(--aldea-success)]/10 border border-[var(--aldea-success)]/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-[var(--aldea-success)] text-2xl">&#10003;</span>
          </div>
          <h1 className="text-3xl font-bold mb-3">
            Welcome to ALDEA World
          </h1>
          <p className="text-[var(--aldea-text-muted)]">
            Your ALMA credential has been verified. Access granted via ZK proof.
          </p>
        </div>

        {/* Demo sections */}
        <div className="grid md:grid-cols-2 gap-6">
          <DemoCard
            title="Community Hub"
            description="Connect with other ALDEA members. Discussions, proposals, and coordination."
            tag="Active"
          />
          <DemoCard
            title="Governance"
            description="Vote on proposals, submit ideas, and shape the future of ALDEA."
            tag="Open"
          />
          <DemoCard
            title="Resource Library"
            description="Exclusive documentation, tutorials, and research for ALDEA members."
            tag="Available"
          />
          <DemoCard
            title="Events"
            description="Upcoming community events, workshops, and presentations."
            tag="Upcoming"
          />
        </div>

        {/* Verification details */}
        <div className="mt-12 p-6 rounded-2xl bg-[var(--aldea-bg-card)] border border-[var(--aldea-border)]">
          <h3 className="text-sm font-medium text-[var(--aldea-text-dim)] uppercase tracking-wider mb-4">
            Verification Details
          </h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--aldea-text-dim)]">Status</dt>
              <dd className="text-[var(--aldea-success)]">Verified</dd>
            </div>
            <div>
              <dt className="text-[var(--aldea-text-dim)]">Method</dt>
              <dd>ZK Proof (Midnight)</dd>
            </div>
            <div>
              <dt className="text-[var(--aldea-text-dim)]">Access Level</dt>
              <dd>{accessLevel ?? "MEMBER"}</dd>
            </div>
            <div>
              <dt className="text-[var(--aldea-text-dim)]">Resource</dt>
              <dd>aldea-world:main-gate</dd>
            </div>
          </dl>
          <p className="text-xs text-[var(--aldea-text-dim)] mt-4">
            Your identity was verified without revealing your wallet address.
            Only your access level and resource were disclosed.
          </p>
        </div>
      </main>
    </div>
  );
}

function DemoCard({
  title,
  description,
  tag,
}: {
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <div className="p-5 rounded-2xl bg-[var(--aldea-bg-card)] border border-[var(--aldea-border)] hover:border-[var(--aldea-accent)]/20 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-[var(--aldea-accent)] bg-[var(--aldea-accent)]/10 px-2 py-0.5 rounded">
          {tag}
        </span>
      </div>
      <p className="text-sm text-[var(--aldea-text-muted)]">{description}</p>
    </div>
  );
}
