export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Decorative glow */}
          <div className="absolute top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

          <p className="text-sm font-medium text-[var(--alma-accent)] tracking-wider uppercase mb-4 alma-fade-in">
            Access Layer for Modular Autonomy
          </p>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] alma-fade-in">
            Your identity in
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              ALDEA World
            </span>
          </h1>

          <p className="mt-6 text-lg text-[var(--alma-text-muted)] max-w-2xl mx-auto leading-relaxed alma-fade-in">
            ALMA is a privacy-first credential that grants you access to the
            ALDEA ecosystem. One soulbound token. Zero personal data exposed.
            Full access to everything ALDEA has to offer.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4 alma-fade-in">
            <a href="/mint" className="alma-btn alma-btn-primary text-base">
              Mint my ALMA
            </a>
            <a href="/claim" className="alma-btn alma-btn-secondary text-base">
              Claim Airdrop
            </a>
          </div>

          <p className="mt-4 text-xs text-[var(--alma-text-dim)]">
            Testnet &middot; 35 ADA &middot; Cardano + Midnight
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">
            How ALMA works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              step="01"
              title="Connect wallet"
              description="Link your Cardano wallet (Lace, Nami, Eternl). Your public address is hashed on-chain — we never store it."
            />
            <StepCard
              step="02"
              title="Pay & mint"
              description="Send 35 ADA to the ALDEA treasury. The smart contract validates your payment and issues your ALMA credential."
            />
            <StepCard
              step="03"
              title="Access ALDEA"
              description="Your ALMA generates a ZK proof that verifies membership without revealing your identity. Enter ALDEA World."
            />
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-24 px-6 border-t border-[var(--alma-border)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            What ALMA gives you
          </h2>
          <p className="text-center text-[var(--alma-text-muted)] mb-16 max-w-2xl mx-auto">
            One credential, full access to the ALDEA World ecosystem.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <FeatureCard
              title="Privacy by default"
              description="Built on Midnight's ZK proofs. Prove membership without revealing your wallet address or identity."
            />
            <FeatureCard
              title="Soulbound"
              description="Non-transferable credential tied to your wallet. Can't be sold, traded, or stolen."
            />
            <FeatureCard
              title="Verifiable on-chain"
              description="Anyone can verify your ALMA credential on the Cardano public registry without accessing your private data."
            />
            <FeatureCard
              title="Selective disclosure"
              description="Choose exactly which attributes to reveal in each interaction. Share your access level without exposing your wallet."
            />
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-24 px-6 border-t border-[var(--alma-border)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Built on solid ground</h2>
          <p className="text-[var(--alma-text-muted)] mb-12">
            ALMA combines two blockchain layers for the best of both worlds.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="alma-card text-left">
              <p className="text-xs text-[var(--alma-text-dim)] uppercase tracking-wider mb-2">
                Public layer
              </p>
              <p className="text-lg font-semibold mb-2">Cardano</p>
              <p className="text-sm text-[var(--alma-text-muted)]">
                Issuer registry, schema validation, and revocation anchors.
                Public and auditable by anyone.
              </p>
            </div>
            <div className="alma-card text-left">
              <p className="text-xs text-[var(--alma-text-dim)] uppercase tracking-wider mb-2">
                Private layer
              </p>
              <p className="text-lg font-semibold mb-2">Midnight</p>
              <p className="text-sm text-[var(--alma-text-muted)]">
                Credential state, ownership proofs, and selective disclosure.
                Shielded by zero-knowledge cryptography.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-[var(--alma-border)]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to join ALDEA World?
          </h2>
          <p className="text-[var(--alma-text-muted)] mb-8">
            Mint your ALMA credential now and become part of the ecosystem.
            Founding members can claim their airdrop.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a href="/mint" className="alma-btn alma-btn-primary">
              Mint ALMA
            </a>
            <a href="/claim" className="alma-btn alma-btn-secondary">
              Claim Airdrop
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="alma-card group">
      <span className="text-xs font-mono text-[var(--alma-accent)] mb-3 block">
        {step}
      </span>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--alma-text-muted)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="alma-card">
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--alma-text-muted)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
