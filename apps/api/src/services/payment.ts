// Unified payment service — handles all payment methods and the mint pipeline

import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { createQueries, PaymentMethod, PaymentRecord } from "../db/schema.js";
import type { CardanoReceiptService } from "./cardano-receipt.js";

export interface CreatePaymentInput {
  method: PaymentMethod;
  externalId: string;
  walletHash: string;
  username?: string | undefined;
  amount: string;
  currency: string;
}

export interface MintService {
  issueCredential(walletHash: string): Promise<string>;
}

export class PaymentService {
  constructor(
    private db: Database.Database,
    private queries: ReturnType<typeof createQueries>,
    private mintService: MintService,
    private receiptService?: CardanoReceiptService,
  ) {}

  createPayment(input: CreatePaymentInput): PaymentRecord {
    const id = randomUUID();
    const idempotencyKey = `${input.method}:${input.externalId}`;

    // Check idempotency — if already processed, return existing
    const existing = this.queries.getPaymentByIdempotencyKey.get(idempotencyKey) as PaymentRecord | undefined;
    if (existing) {
      return existing;
    }

    this.queries.insertPayment.run(
      id,
      input.method,
      input.externalId,
      input.walletHash,
      input.username ?? null,
      input.amount,
      input.currency,
      idempotencyKey,
    );

    this.queries.insertAuditLog.run(id, null, "PENDING", `Payment created via ${input.method}`);

    return this.queries.getPaymentById.get(id) as PaymentRecord;
  }

  async confirmPayment(paymentId: string): Promise<PaymentRecord> {
    const payment = this.queries.getPaymentById.get(paymentId) as PaymentRecord | undefined;
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status === "COMPLETE") {
      return payment;
    }

    this.updateStatus(paymentId, payment.status, "CONFIRMED");

    // Immediately try to mint
    return this.tryMint(paymentId);
  }

  async confirmByExternalId(externalId: string, method: PaymentMethod): Promise<PaymentRecord> {
    const payment = this.queries.getPaymentByExternalId.get(externalId, method) as PaymentRecord | undefined;
    if (!payment) {
      throw new Error(`Payment not found for external ID: ${externalId} (${method})`);
    }
    return this.confirmPayment(payment.id);
  }

  async tryMint(paymentId: string): Promise<PaymentRecord> {
    const payment = this.queries.getPaymentById.get(paymentId) as PaymentRecord | undefined;
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status === "COMPLETE") {
      return payment;
    }

    if (payment.status === "FAILED" || payment.status === "REFUNDED") {
      throw new Error(`Payment ${paymentId} is in terminal state: ${payment.status}`);
    }

    this.updateStatus(paymentId, payment.status, "MINT_INITIATED");

    try {
      const credentialId = await this.mintService.issueCredential(payment.wallet_hash);

      this.queries.setCredentialId.run(credentialId, paymentId);
      this.queries.insertAuditLog.run(paymentId, "MINT_INITIATED", "COMPLETE", `Credential issued: ${credentialId}`);

      // Fire-and-forget: submit Cardano receipt for fiat payments
      const updatedPayment = this.queries.getPaymentById.get(paymentId) as PaymentRecord;
      if (this.isFiatPayment(updatedPayment.method)) {
        this.submitReceipt(paymentId).catch(() => {});
      }

      return updatedPayment;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.queries.setError.run(message, paymentId);
      this.queries.insertAuditLog.run(paymentId, "MINT_INITIATED", "MINT_INITIATED", `Mint failed (retry ${payment.retries + 1}): ${message}`);

      // If too many retries, mark as failed
      if (payment.retries >= 4) {
        this.updateStatus(paymentId, "MINT_INITIATED", "FAILED");
      }

      return this.queries.getPaymentById.get(paymentId) as PaymentRecord;
    }
  }

  getPayment(paymentId: string): PaymentRecord | undefined {
    return this.queries.getPaymentById.get(paymentId) as PaymentRecord | undefined;
  }

  getPaymentsByWallet(walletHash: string): PaymentRecord[] {
    return this.queries.getPaymentsByWallet.all(walletHash) as PaymentRecord[];
  }

  getPendingReconciliation(): PaymentRecord[] {
    return this.queries.getPendingReconciliation.all() as PaymentRecord[];
  }

  async submitReceipt(paymentId: string): Promise<void> {
    if (!this.receiptService?.isAvailable()) return;

    const payment = this.queries.getPaymentById.get(paymentId) as PaymentRecord | undefined;
    if (!payment || payment.receipt_status === "SUBMITTED") return;

    this.queries.setReceiptStatus.run("PENDING", paymentId);

    const result = await this.receiptService.submitFiatReceipt({
      walletHash: payment.wallet_hash,
      paymentAmount: Number(payment.amount),
      paymentMethod: payment.method,
    });

    if (result.success) {
      this.queries.setReceiptTxHash.run(result.txHash, paymentId);
      this.queries.insertAuditLog.run(paymentId, "COMPLETE", "COMPLETE", `Cardano receipt submitted: ${result.txHash}`);
    } else {
      this.queries.setReceiptStatus.run("FAILED", paymentId);
      this.queries.insertAuditLog.run(paymentId, "COMPLETE", "COMPLETE", `Cardano receipt failed: ${result.error}`);
    }
  }

  getPendingReceipts(): PaymentRecord[] {
    return this.queries.getPendingReceipts.all() as PaymentRecord[];
  }

  getFailedReceipts(): PaymentRecord[] {
    return this.queries.getFailedReceipts.all() as PaymentRecord[];
  }

  private isFiatPayment(method: string): boolean {
    return method === "stripe" || method === "mercadopago";
  }

  private updateStatus(paymentId: string, from: string, to: string): void {
    this.queries.updatePaymentStatus.run(to, paymentId);
    this.queries.insertAuditLog.run(paymentId, from, to, null);
  }
}
