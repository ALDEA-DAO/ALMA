import type { Metadata } from "next";
import { MintFlow } from "@/components/MintFlow";

export const metadata: Metadata = {
  title: "Mint ALMA — ALDEA World Access Credential",
  description:
    "Pay in ADA and mint your ALMA soulbound credential for access to ALDEA World.",
};

export default function MintPage() {
  return (
    <div className="min-h-screen px-6 py-24">
      <div className="max-w-lg mx-auto text-center mb-12">
        <h1 className="text-3xl font-bold mb-3">Mint your ALMA</h1>
        <p className="text-[var(--alma-text-muted)]">
          Pay in ADA to mint a soulbound credential and join ALDEA World.
        </p>
      </div>
      <MintFlow />
    </div>
  );
}
