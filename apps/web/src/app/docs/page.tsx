import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — ALMA Protocol",
  description: "Learn how the ALMA credential protocol works.",
};

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <h1 className="text-4xl font-bold mb-4">Documentation</h1>
      <p className="text-[var(--alma-text-muted)] mb-12">
        Everything you need to understand the ALMA protocol.
      </p>

      <div className="space-y-8">
        <DocSection title="What is ALMA?">
          <p>
            ALMA (Access Layer for Modular Autonomy) is a privacy-first
            soulbound credential protocol built on Cardano and Midnight.
            It provides verifiable digital identity credentials that prove
            membership or access rights without exposing personal data.
          </p>
        </DocSection>

        <DocSection title="Architecture">
          <p>
            ALMA operates across two blockchain layers:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>
              <strong>Cardano (Public Layer)</strong> — Issuer registry, schema
              definitions, and revocation anchors. Fully auditable.
            </li>
            <li>
              <strong>Midnight (Private Layer)</strong> — Credential state,
              ownership, and ZK proof generation. Shielded by zero-knowledge
              cryptography.
            </li>
          </ul>
        </DocSection>

        <DocSection title="Credential Lifecycle">
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              <strong>Issuance</strong> — An organization (like ALDEA DAO) issues
              a credential to a wallet. The credential starts in PENDING state.
            </li>
            <li>
              <strong>Claim</strong> — The wallet owner connects and claims the
              credential by signing a ZK proof of ownership. Status becomes CLAIMED.
            </li>
            <li>
              <strong>Usage</strong> — The holder generates ZK proofs to access
              resources. Each proof selectively discloses only the required fields.
            </li>
            <li>
              <strong>Revocation</strong> — The issuer can revoke a credential.
              A revocation anchor is published on Cardano without revealing who was revoked.
            </li>
          </ol>
        </DocSection>

        <DocSection title="Public Mint">
          <p>
            New members can mint an ALMA credential by paying ADA to the public
            mint contract. The smart contract validates the payment amount,
            ensures anti-double-mint (one credential per wallet), and sends
            funds to the ALDEA treasury. After payment confirmation, the
            credential is automatically issued and available for claim.
          </p>
        </DocSection>

        <DocSection title="Genesis Airdrop">
          <p>
            Founding members of ALDEA receive their ALMA credentials via a
            one-time genesis airdrop. Credentials are pre-issued in PENDING
            state — each member claims theirs by connecting their wallet on the
            claim page.
          </p>
        </DocSection>

        <DocSection title="Schemas">
          <p>
            ALMA uses the <code className="text-[var(--alma-accent)] bg-[var(--alma-bg-elevated)] px-1.5 py-0.5 rounded text-sm">soulbound:v1:access</code> schema
            with the following fields:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>resourceId</strong> — The resource being accessed (e.g., aldea-world:main-gate)</li>
            <li><strong>accessLevel</strong> — MEMBER, TRIAL, or FOUNDING_MEMBER</li>
            <li><strong>walletHash</strong> — SHA-256 hash of the wallet address (never the raw address)</li>
          </ul>
        </DocSection>

        <DocSection title="SDK Integration">
          <p>
            Developers can integrate with ALMA using the Soulbound SDK:
          </p>
          <pre className="mt-3 bg-[var(--alma-bg-elevated)] border border-[var(--alma-border)] rounded-lg p-4 text-sm overflow-x-auto">
{`import { SoulboundHolder, SoulboundVerifier, MockProvider } from "@adasouls/soulbound-sdk";

// Verify access
const verifier = new SoulboundVerifier(provider);
const { hasAccess } = await verifier.checkAccess(walletAddress, {
  resourceId: "aldea-world:main-gate",
});

// Generate ZK proof
const holder = new SoulboundHolder(walletAddress, provider);
const proof = await holder.generateProof(credentialId, "aldea-world:main-gate");`}
          </pre>
        </DocSection>
      </div>
    </div>
  );
}

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="alma-card">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="text-sm text-[var(--alma-text-muted)] leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}
