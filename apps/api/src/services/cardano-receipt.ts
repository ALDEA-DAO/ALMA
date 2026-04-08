// Cardano receipt service — submits MintReceipt UTxOs on-chain for fiat payments.
//
// Sends a UTxO TO the public_mint script address (validator does NOT run).
// This creates an on-chain proof that a fiat payment occurred, unifying
// the receipt layer across all payment methods.

import type { Env } from "../env.js";

export interface ReceiptSubmissionResult {
  txHash: string;
  success: boolean;
  error?: string;
}

export interface CardanoReceiptService {
  submitFiatReceipt(params: {
    walletHash: string;
    paymentAmount: number;
    paymentMethod: string;
  }): Promise<ReceiptSubmissionResult>;

  isAvailable(): boolean;
}

/**
 * Build a MintReceipt inline datum in Plutus JSON format (constructor 0, 4 fields).
 *
 * MintReceipt { minter_vkh: ByteArray, minted_at: Int, payment_amount: Int, payment_method: ByteArray }
 */
function buildReceiptDatum(
  minterVkh: string,
  mintedAt: number,
  paymentAmount: number,
  paymentMethod: string,
): string {
  const methodHex = Buffer.from(paymentMethod, "utf-8").toString("hex");
  return JSON.stringify({
    constructor: 0,
    fields: [
      { bytes: minterVkh },
      { int: mintedAt },
      { int: paymentAmount },
      { bytes: methodHex },
    ],
  });
}

/**
 * Query current Cardano slot from Blockfrost tip endpoint.
 */
async function getCurrentSlot(blockfrostUrl: string, projectId: string): Promise<number> {
  const res = await fetch(`${blockfrostUrl}/blocks/latest`, {
    headers: { project_id: projectId },
  });
  if (!res.ok) {
    throw new Error(`Blockfrost tip query failed: ${res.status}`);
  }
  const block = (await res.json()) as { slot: number };
  return block.slot;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCardanoReceiptService(env: Env): CardanoReceiptService {
  if (env.NODE_ENV === "development" || !env.BACKEND_WALLET_SEED) {
    return createMockReceiptService();
  }

  return createRealReceiptService(env);
}

// ─── Mock (development) ───────────────────────────────────────────────────────

function createMockReceiptService(): CardanoReceiptService {
  let counter = 0;
  const available = true;

  return {
    async submitFiatReceipt(params) {
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 300));
      counter++;
      const txHash = `mock-receipt-tx-${counter}-${params.walletHash.slice(0, 8)}`;
      console.log(`[mock] Cardano receipt submitted: ${txHash} (method: ${params.paymentMethod})`);
      return { txHash, success: true };
    },
    isAvailable() {
      return available;
    },
  };
}

// ─── Real (testnet / mainnet) ─────────────────────────────────────────────────

function createRealReceiptService(env: Env): CardanoReceiptService {
  // Lazy-load MeshJS to avoid import issues in environments without it
  let meshInitialized = false;
  let wallet: any = null;
  let walletAddress: string = "";

  const MIN_RECEIPT_LOVELACE = "2000000"; // 2 ADA minimum for UTxO

  async function ensureWallet(): Promise<void> {
    if (meshInitialized) return;

    const { MeshWallet, MeshTxBuilder } = await import("@meshsdk/core");

    wallet = new MeshWallet({
      networkId: env.BLOCKFROST_URL.includes("mainnet") ? 1 : 0,
      fetcher: {
        // Blockfrost-backed fetcher for MeshJS
        async fetchAddressUTxOs(address: string) {
          const res = await fetch(`${env.BLOCKFROST_URL}/addresses/${address}/utxos`, {
            headers: { project_id: env.BLOCKFROST_PROJECT_ID },
          });
          if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`Blockfrost UTxO query failed: ${res.status}`);
          }
          return res.json();
        },
      } as any,
      key: {
        type: "mnemonic",
        words: env.BACKEND_WALLET_SEED.split(" "),
      },
    });

    walletAddress = wallet.getChangeAddress();
    meshInitialized = true;

    // Log wallet info on first init
    console.log(`[cardano-receipt] Backend wallet initialized: ${walletAddress}`);
  }

  return {
    async submitFiatReceipt(params) {
      try {
        await ensureWallet();

        const { MeshTxBuilder } = await import("@meshsdk/core");

        // Get current slot for minted_at
        const currentSlot = await getCurrentSlot(env.BLOCKFROST_URL, env.BLOCKFROST_PROJECT_ID);

        // Build the MintReceipt datum
        const datum = buildReceiptDatum(
          params.walletHash,
          currentSlot,
          params.paymentAmount,
          params.paymentMethod,
        );

        // Build transaction: send UTxO with receipt datum to script address
        const txBuilder = new MeshTxBuilder({
          fetcher: wallet.fetcher,
          submitter: {
            async submitTx(tx: string): Promise<string> {
              const res = await fetch(`${env.BLOCKFROST_URL}/tx/submit`, {
                method: "POST",
                headers: {
                  project_id: env.BLOCKFROST_PROJECT_ID,
                  "Content-Type": "application/cbor",
                },
                body: Buffer.from(tx, "hex"),
              });
              if (!res.ok) {
                const errorBody = await res.text();
                throw new Error(`Tx submission failed: ${res.status} ${errorBody}`);
              }
              return (await res.json()) as string;
            },
          },
        });

        const utxos = await wallet.getUtxos();

        const unsignedTx = await txBuilder
          .txOut(env.PUBLIC_MINT_SCRIPT_ADDRESS, [
            { unit: "lovelace", quantity: MIN_RECEIPT_LOVELACE },
          ])
          .txOutInlineDatumValue(datum)
          .changeAddress(walletAddress)
          .selectUtxosFrom(utxos)
          .complete();

        const signedTx = wallet.signTx(unsignedTx);
        const txHash = await wallet.submitTx(signedTx);

        console.log(`[cardano-receipt] Receipt submitted: ${txHash} for wallet ${params.walletHash}`);
        return { txHash, success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[cardano-receipt] Failed to submit receipt: ${message}`);
        return { txHash: "", success: false, error: message };
      }
    },

    isAvailable() {
      return !!(env.BACKEND_WALLET_SEED && env.PUBLIC_MINT_SCRIPT_ADDRESS);
    },
  };
}
