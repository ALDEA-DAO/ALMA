import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALMA — Access Layer for Modular Autonomy",
  description:
    "Privacy-first digital credentials for ALDEA World. Mint your ALMA to access the ecosystem.",
  openGraph: {
    title: "ALMA Protocol",
    description: "Your identity in ALDEA World. Private. Verifiable. Yours.",
    url: "https://alma.aldea.world",
    siteName: "ALMA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen alma-grid-bg antialiased">
        <nav className="fixed top-0 w-full z-50 border-b border-[var(--alma-border)] bg-[var(--alma-bg)]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                A
              </div>
              <span className="font-semibold text-[var(--alma-text)] tracking-tight">
                ALMA
              </span>
            </a>
            <div className="flex items-center gap-6">
              <a
                href="/docs"
                className="text-sm text-[var(--alma-text-muted)] hover:text-[var(--alma-text)] transition-colors"
              >
                Docs
              </a>
              <a
                href="/stats"
                className="text-sm text-[var(--alma-text-muted)] hover:text-[var(--alma-text)] transition-colors"
              >
                Stats
              </a>
              <a
                href="/mint"
                className="alma-btn alma-btn-primary text-sm !py-2 !px-5"
              >
                Mint ALMA
              </a>
            </div>
          </div>
        </nav>
        <main className="pt-16">{children}</main>
        <footer className="border-t border-[var(--alma-border)] mt-32">
          <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between gap-8">
            <div>
              <p className="font-semibold text-[var(--alma-text)]">ALMA Protocol</p>
              <p className="text-sm text-[var(--alma-text-muted)] mt-1">
                Access Layer for Modular Autonomy
              </p>
              <p className="text-xs text-[var(--alma-text-dim)] mt-2">
                Built by ALDEA DAO on Cardano + Midnight
              </p>
            </div>
            <div className="flex gap-12 text-sm text-[var(--alma-text-muted)]">
              <div className="flex flex-col gap-2">
                <span className="text-[var(--alma-text-dim)] text-xs uppercase tracking-wider">Protocol</span>
                <a href="/docs" className="hover:text-[var(--alma-text)]">Documentation</a>
                <a href="/stats" className="hover:text-[var(--alma-text)]">Stats</a>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[var(--alma-text-dim)] text-xs uppercase tracking-wider">Community</span>
                <a href="https://aldea.world" target="_blank" rel="noopener" className="hover:text-[var(--alma-text)]">ALDEA World</a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
