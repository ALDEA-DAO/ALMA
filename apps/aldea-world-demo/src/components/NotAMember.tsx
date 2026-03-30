"use client";

/**
 * TASK-032 — "Not a Member" screen for ALDEA World.
 *
 * Shown when the connected wallet does not have a valid ALMA credential.
 * Includes direct CTAs to alma.aldea.world for minting or claiming.
 */

const ALMA_MINT_URL = process.env.NEXT_PUBLIC_ALMA_URL ?? "https://alma.aldea.world";

export function NotAMember() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
      <div className="max-w-md w-full text-center">
        {/* Lock icon */}
        <div className="w-24 h-24 rounded-full border-2 border-[var(--aldea-border)] mx-auto mb-8 flex items-center justify-center bg-[var(--aldea-bg-card)]">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--aldea-text-dim)]"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-3">ALDEA World Access Required</h1>

        <p className="text-[var(--aldea-text-muted)] mb-2 leading-relaxed">
          You need a valid ALMA credential to enter ALDEA World.
          Your wallet does not have one — or it hasn&apos;t been claimed yet.
        </p>

        <p className="text-sm text-[var(--aldea-text-dim)] mb-8">
          ALMA is a privacy-first soulbound credential that verifies your
          membership without exposing your identity.
        </p>

        <div className="space-y-3">
          <a
            href={`${ALMA_MINT_URL}/mint`}
            className="block w-full py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-center hover:from-indigo-400 hover:to-purple-500 transition-all"
          >
            Mint ALMA Credential
          </a>

          <a
            href={`${ALMA_MINT_URL}/claim`}
            className="block w-full py-3 px-6 rounded-xl border border-[var(--aldea-border)] text-[var(--aldea-accent)] font-medium text-center hover:border-[var(--aldea-accent)]/40 transition-colors"
          >
            I&apos;m a founding member — Claim Airdrop
          </a>
        </div>

        <div className="mt-10 pt-6 border-t border-[var(--aldea-border)]">
          <p className="text-xs text-[var(--aldea-text-dim)]">
            Already minted?
            Make sure you&apos;re using the same wallet and that your credential
            has been claimed. If the issue persists, check{" "}
            <a
              href={ALMA_MINT_URL}
              className="text-[var(--aldea-accent)] hover:underline"
            >
              alma.aldea.world
            </a>{" "}
            for support.
          </p>
        </div>
      </div>
    </div>
  );
}
