import type { Metadata } from "next";
import { ClaimFlow } from "@/components/ClaimFlow";

export const metadata: Metadata = {
  title: "Claim ALMA — Founding Member Airdrop",
  description:
    "Claim your ALMA credential if you are an existing ALDEA member.",
};

export default function ClaimPage() {
  return (
    <div className="min-h-screen px-6 py-24">
      <div className="max-w-lg mx-auto text-center mb-12">
        <h1 className="text-3xl font-bold mb-3">Claim your ALMA</h1>
        <p className="text-[var(--alma-text-muted)]">
          Founding ALDEA members — connect your wallet to claim your airdropped
          credential.
        </p>
      </div>
      <ClaimFlow />
    </div>
  );
}
