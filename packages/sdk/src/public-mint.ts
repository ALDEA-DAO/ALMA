/**
 * TASK-026 — PublicMintListener
 *
 * Listens for on-chain ADA payment events from the public mint contract
 * and automatically emits ALMA credentials to the paying wallet.
 *
 * Flow:
 *   1. User pays ADA via the public mint contract
 *   2. Payment is confirmed on-chain (MintReceipt UTxO created)
 *   3. PublicMintListener detects the receipt via Blockfrost polling
 *   4. Calls issuer.emit() to create a PENDING credential for the wallet
 *   5. Credential is available for the user to claim
 *
 * Handles retries if credential issuance fails after payment.
 *
 * @example
 *   const listener = new PublicMintListener({
 *     issuer,
 *     blockfrostUrl: "https://cardano-preprod.blockfrost.io/api/v0",
 *     blockfrostProjectId: "preprod_xxx",
 *     publicMintScriptHash: "abc123...",
 *     schema: "soulbound:v1:access",
 *     resourceId: "aldea-world:main-gate",
 *     accessLevel: "MEMBER",
 *   });
 *
 *   listener.start();
 */

import type {
  SoulboundCredentialId,
  SoulboundSchemaId,
} from "@adasouls/soulbound-core";
import type { SoulboundIssuer } from "./issuer.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PublicMintListenerConfig {
  /** SoulboundIssuer instance to emit credentials */
  issuer: SoulboundIssuer;
  /** Blockfrost API base URL */
  blockfrostUrl: string;
  /** Blockfrost project ID */
  blockfrostProjectId: string;
  /** Script hash of the deployed PublicMint validator */
  publicMintScriptHash: string;
  /** Schema to use for emitted credentials */
  schema: SoulboundSchemaId;
  /** Resource ID to set on emitted credentials */
  resourceId: string;
  /** Access level to set on emitted credentials */
  accessLevel: string;
  /** Polling interval in milliseconds (default: 10000) */
  pollIntervalMs?: number;
  /** Max retries for credential issuance after payment (default: 3) */
  maxRetries?: number;
  /** Callback when a credential is successfully issued */
  onMintProcessed?: (event: MintProcessedEvent) => void;
  /** Callback when an error occurs */
  onError?: (error: MintError) => void;
}

export interface MintProcessedEvent {
  walletAddress: string;
  stakeKeyHash: string;
  credentialId: SoulboundCredentialId;
  paymentTxHash: string;
  paymentAmount: bigint;
  usernameHash: string;
  processedAt: number;
}

export interface MintError {
  walletAddress: string;
  paymentTxHash: string;
  error: string;
  retriesLeft: number;
}

interface MintReceiptUtxo {
  txHash: string;
  outputIndex: number;
  stakeKeyHash: string;
  minterAddress: string;
  paymentAmount: bigint;
  mintedAt: number;
  usernameHash: string;
}

interface PendingMint {
  receipt: MintReceiptUtxo;
  retriesLeft: number;
}

// ─── Blockfrost response types ──────────────────────────────────────────────

interface BlockfrostUtxo {
  tx_hash: string;
  output_index: number;
  amount: { unit: string; quantity: string }[];
  inline_datum: string | null;
  address: string;
}

interface BlockfrostTx {
  hash: string;
  inputs: { address: string; tx_hash: string; output_index: number }[];
}

// ─── PublicMintListener ─────────────────────────────────────────────────────

export class PublicMintListener {
  private config: PublicMintListenerConfig;
  private pollIntervalMs: number;
  private maxRetries: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private processedTxHashes = new Set<string>();
  private pendingMints: PendingMint[] = [];
  private running = false;

  constructor(config: PublicMintListenerConfig) {
    this.config = config;
    this.pollIntervalMs = config.pollIntervalMs ?? 10_000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  /**
   * Start polling for new mint receipts on-chain.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.poll(); // Immediate first poll
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  /**
   * Stop polling.
   */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Check if the listener is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Process a single mint receipt manually (for testing or manual recovery).
   */
  async processReceipt(receipt: MintReceiptUtxo): Promise<SoulboundCredentialId> {
    return this.emitCredential(receipt);
  }

  /**
   * Get the set of already-processed transaction hashes.
   */
  getProcessedTxHashes(): ReadonlySet<string> {
    return this.processedTxHashes;
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    try {
      // Fetch new receipt UTxOs from the public mint script
      const receipts = await this.fetchMintReceipts();

      // Filter out already-processed
      const newReceipts = receipts.filter(
        (r) => !this.processedTxHashes.has(r.txHash)
      );

      // Queue new mints
      for (const receipt of newReceipts) {
        this.pendingMints.push({ receipt, retriesLeft: this.maxRetries });
      }

      // Process pending mints
      await this.processPendingMints();
    } catch (err) {
      // Non-fatal — will retry on next poll
      this.config.onError?.({
        walletAddress: "",
        paymentTxHash: "",
        error: `Poll error: ${(err as Error).message}`,
        retriesLeft: -1,
      });
    }
  }

  private async processPendingMints(): Promise<void> {
    const remaining: PendingMint[] = [];

    for (const pending of this.pendingMints) {
      try {
        const credentialId = await this.emitCredential(pending.receipt);
        this.processedTxHashes.add(pending.receipt.txHash);

        this.config.onMintProcessed?.({
          walletAddress: pending.receipt.minterAddress,
          stakeKeyHash: pending.receipt.stakeKeyHash,
          credentialId,
          paymentTxHash: pending.receipt.txHash,
          paymentAmount: pending.receipt.paymentAmount,
          usernameHash: pending.receipt.usernameHash,
          processedAt: Math.floor(Date.now() / 1000),
        });
      } catch (err) {
        const retriesLeft = pending.retriesLeft - 1;

        this.config.onError?.({
          walletAddress: pending.receipt.minterAddress,
          paymentTxHash: pending.receipt.txHash,
          error: (err as Error).message,
          retriesLeft,
        });

        if (retriesLeft > 0) {
          remaining.push({ receipt: pending.receipt, retriesLeft });
        }
        // If retriesLeft <= 0, the mint is dropped (needs manual intervention)
      }
    }

    this.pendingMints = remaining;
  }

  private async emitCredential(receipt: MintReceiptUtxo): Promise<SoulboundCredentialId> {
    return this.config.issuer.emit({
      schema: this.config.schema,
      subject: {
        walletAddress: receipt.minterAddress,
        resourceId: this.config.resourceId,
        accessLevel: this.config.accessLevel,
      },
    });
  }

  private async fetchMintReceipts(): Promise<MintReceiptUtxo[]> {
    const scriptAddress = this.getScriptAddress();
    const url = `${this.config.blockfrostUrl}/addresses/${scriptAddress}/utxos`;

    const res = await fetch(url, {
      headers: { project_id: this.config.blockfrostProjectId },
    });

    if (!res.ok) {
      if (res.status === 404) return []; // No UTxOs yet
      throw new Error(`Blockfrost query failed: ${res.status} ${res.statusText}`);
    }

    const utxos = (await res.json()) as BlockfrostUtxo[];
    const receipts: MintReceiptUtxo[] = [];

    for (const utxo of utxos) {
      const receipt = this.parseMintReceipt(utxo);
      if (receipt) receipts.push(receipt);
    }

    return receipts;
  }

  private parseMintReceipt(utxo: BlockfrostUtxo): MintReceiptUtxo | null {
    if (!utxo.inline_datum) return null;

    try {
      const datum = JSON.parse(utxo.inline_datum);
      // MintReceipt has 6 fields: stake_key_hash, minter_vkh, minted_at,
      // payment_amount, payment_method, username_hash
      if (datum.fields?.length !== 6) return null;

      const stakeKeyHash = datum.fields[0]?.bytes;
      const minterVkh = datum.fields[1]?.bytes;
      const mintedAt = datum.fields[2]?.int;
      const paymentAmount = datum.fields[3]?.int;
      // fields[4] = payment_method (not needed for processing)
      const usernameHash = datum.fields[5]?.bytes ?? "";

      if (!stakeKeyHash || !minterVkh || mintedAt === undefined || paymentAmount === undefined) {
        return null;
      }

      return {
        txHash: utxo.tx_hash,
        outputIndex: utxo.output_index,
        stakeKeyHash,
        minterAddress: minterVkh, // In production, resolve to bech32 via Blockfrost
        paymentAmount: BigInt(paymentAmount),
        mintedAt,
        usernameHash,
      };
    } catch {
      return null;
    }
  }

  private getScriptAddress(): string {
    // Derive the script address from the script hash.
    // In production, use proper bech32 encoding.
    return `addr_test1:public_mint:${this.config.publicMintScriptHash}`;
  }
}
