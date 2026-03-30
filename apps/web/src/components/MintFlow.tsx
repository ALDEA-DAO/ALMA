"use client";

import { useState } from "react";
import { useWallet, type WalletName } from "@/hooks/useWallet";
import { WalletSelector } from "./WalletSelector";
import { TransactionStatus, type TxStage } from "./TransactionStatus";
import { MINT_PRICE_ADA, ALDEA_WORLD_URL } from "@/lib/alma-config";

/**
 * MintFlow — Public mint experience for new ALDEA members.
 *
 * Steps:
 *   1. Explain what ALMA is and what the token gives access to
 *   2. Connect wallet
 *   3. Confirm ADA payment amount
 *   4. Sign and submit transaction
 *   5. Wait for on-chain confirmation
 *   6. ALMA credential issued and auto-claimed
 *   7. ZK proof generated in background → redirect to ALDEA World
 */

type MintStep = "intro" | "connect" | "confirm" | "processing" | "success";

export function MintFlow() {
  const wallet = useWallet();
  const [step, setStep] = useState<MintStep>("intro");
  const [txStage, setTxStage] = useState<TxStage>("idle");
  const [txHash, setTxHash] = useState<string>();
  const [error, setError] = useState<string>();
  const [connectingWallet, setConnectingWallet] = useState<WalletName | null>(
    null
  );

  const handleConnect = async (walletName: WalletName) => {
    setConnectingWallet(walletName);
    const result = await wallet.connect(walletName);
    setConnectingWallet(null);
    if (result) {
      setStep("confirm");
    }
  };

  const handleMint = async () => {
    setStep("processing");
    setError(undefined);

    try {
      // Step 1: Build and sign transaction
      setTxStage("signing");
      const { MeshTxBuilder } = await import("@meshsdk/core");

      // In production, the treasury address comes from the deployed contract config.
      // For testnet, we use the configured treasury address.
      const treasuryAddress =
        process.env.NEXT_PUBLIC_ALDEA_TREASURY_ADDRESS ?? "";

      if (!treasuryAddress) {
        throw new Error("Treasury address not configured");
      }

      // Build payment transaction
      const txBuilder = new MeshTxBuilder();
      const unsignedTx = await (txBuilder as any)
        .txOut(treasuryAddress, [
          { unit: "lovelace", quantity: (BigInt(MINT_PRICE_ADA) * 1_000_000n).toString() },
        ])
        .changeAddress(wallet.address!)
        .complete();

      // Step 2: Submit
      setTxStage("submitting");
      const { BrowserWallet } = await import("@meshsdk/core");
      const connectedWallet = await BrowserWallet.enable(wallet.walletName!);
      const signedTx = await connectedWallet.signTx(unsignedTx);
      const submittedHash = await connectedWallet.submitTx(signedTx);
      setTxHash(submittedHash);

      // Step 3: Wait for confirmation
      setTxStage("confirming");
      // In production, poll Blockfrost for tx confirmation.
      // The PublicMintListener will detect the receipt and issue the credential.
      // For now, simulate a brief wait.
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 4: Credential issuance (handled by PublicMintListener in production)
      setTxStage("issuing");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 5: Done
      setTxStage("complete");
      setStep("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transaction failed";
      setError(message);
      setTxStage("error");
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Step: Intro */}
      {step === "intro" && (
        <div className="alma-fade-in">
          <div className="alma-card mb-6">
            <h2 className="text-xl font-semibold mb-3">What you get</h2>
            <ul className="space-y-2 text-sm text-[var(--alma-text-muted)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--alma-accent)] mt-0.5">&#9679;</span>
                <span>
                  A soulbound ALMA credential — your passport to ALDEA World
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--alma-accent)] mt-0.5">&#9679;</span>
                <span>
                  Full MEMBER access to all ALDEA ecosystem resources
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--alma-accent)] mt-0.5">&#9679;</span>
                <span>
                  Privacy-preserving ZK proofs for identity verification
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--alma-accent)] mt-0.5">&#9679;</span>
                <span>
                  Non-transferable — tied to your wallet forever
                </span>
              </li>
            </ul>
          </div>

          <div className="alma-card mb-6">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm text-[var(--alma-text-dim)]">
                  Mint price
                </p>
                <p className="text-3xl font-bold">{MINT_PRICE_ADA} ADA</p>
              </div>
              <p className="text-xs text-[var(--alma-text-dim)]">
                Cardano Preprod Testnet
              </p>
            </div>
          </div>

          <button
            onClick={() => setStep("connect")}
            className="w-full alma-btn alma-btn-primary"
          >
            Connect Wallet to Mint
          </button>
        </div>
      )}

      {/* Step: Connect Wallet */}
      {step === "connect" && (
        <div className="alma-fade-in">
          <WalletSelector
            onSelect={handleConnect}
            connecting={wallet.connecting}
            connectingWallet={connectingWallet}
          />
          {wallet.error && (
            <p className="text-sm text-[var(--alma-error)] mt-3">
              {wallet.error}
            </p>
          )}
          <button
            onClick={() => setStep("intro")}
            className="w-full mt-4 text-sm text-[var(--alma-text-muted)] hover:text-[var(--alma-text)]"
          >
            Back
          </button>
        </div>
      )}

      {/* Step: Confirm Payment */}
      {step === "confirm" && (
        <div className="alma-fade-in">
          <div className="alma-card mb-6">
            <p className="text-sm text-[var(--alma-text-dim)] mb-1">
              Connected wallet
            </p>
            <p className="font-mono text-sm text-[var(--alma-text-muted)] break-all">
              {wallet.address}
            </p>
          </div>

          <div className="alma-card mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[var(--alma-text-muted)]">
                ALMA Credential
              </span>
              <span className="font-semibold">{MINT_PRICE_ADA} ADA</span>
            </div>
            <div className="flex items-center justify-between text-sm text-[var(--alma-text-dim)]">
              <span>Network</span>
              <span>Cardano Preprod</span>
            </div>
            <div className="flex items-center justify-between text-sm text-[var(--alma-text-dim)] mt-1">
              <span>Access Level</span>
              <span>MEMBER</span>
            </div>
            <div className="flex items-center justify-between text-sm text-[var(--alma-text-dim)] mt-1">
              <span>Resource</span>
              <span>ALDEA World Main Gate</span>
            </div>
          </div>

          <button
            onClick={handleMint}
            className="w-full alma-btn alma-btn-primary"
          >
            Pay {MINT_PRICE_ADA} ADA & Mint
          </button>
          <button
            onClick={() => {
              wallet.disconnect();
              setStep("intro");
            }}
            className="w-full mt-3 text-sm text-[var(--alma-text-muted)] hover:text-[var(--alma-text)]"
          >
            Disconnect & cancel
          </button>
        </div>
      )}

      {/* Step: Processing */}
      {step === "processing" && (
        <div className="alma-fade-in">
          <TransactionStatus stage={txStage} txHash={txHash} error={error} />
          {txStage === "error" && (
            <button
              onClick={() => {
                setTxStage("idle");
                setStep("confirm");
              }}
              className="w-full mt-4 alma-btn alma-btn-secondary"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Step: Success */}
      {step === "success" && (
        <div className="alma-fade-in text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--alma-success)]/10 border border-[var(--alma-success)]/30 flex items-center justify-center mx-auto mb-6">
            <span className="text-[var(--alma-success)] text-3xl">
              &#10003;
            </span>
          </div>

          <h2 className="text-2xl font-bold mb-2">Welcome to ALDEA World</h2>
          <p className="text-[var(--alma-text-muted)] mb-8">
            Your ALMA credential has been minted and claimed. A ZK proof is
            being generated in the background for instant access.
          </p>

          {txHash && (
            <p className="text-xs text-[var(--alma-text-dim)] font-mono mb-6 break-all">
              Tx: {txHash}
            </p>
          )}

          <a
            href={ALDEA_WORLD_URL}
            className="alma-btn alma-btn-primary w-full"
          >
            Enter ALDEA World
          </a>
        </div>
      )}
    </div>
  );
}
