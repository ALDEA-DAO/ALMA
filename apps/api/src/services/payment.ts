// Unified payment service — handles all payment methods and the mint pipeline

import { randomUUID } from "node:crypto";
import type { Queries, PaymentMethod, PaymentRecord } from "../db/schema.js";
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
    private queries: Queries,
    private mintService: MintService,
    private receiptService?: CardanoReceiptService,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    const id = randomUUID();
    const idempotencyKey = `${input.method}:${input.externalId}`;

    // Check idempotency — if already processed, return existing
    const existing = await this.queries.getPaymentByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    await this.queries.insertPayment(
      id,
      input.method,
      input.externalId,
      input.walletHash,
      input.username ?? null,
      input.amount,
      input.currency,
      idempotencyKey,
    );

    await this.queries.insertAuditLog(id, null, "PENDING", `Payment created via ${input.method}`);

    return (await this.queries.getPaymentById(id))!;
  }

  async confirmPayment(paymentId: string): Promise<PaymentRecord> {
    const payment = await this.queries.getPaymentById(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status === "COMPLETE") {
      return payment;
    }

    await this.updateStatus(paymentId, payment.status, "CONFIRMED");

    // Immediately try to mint
    return this.tryMint(paymentId);
  }

  async confirmByExternalId(externalId: string, method: PaymentMethod): Promise<PaymentRecord> {
    const payment = await this.queries.getPaymentByExternalId(externalId, method);
    if (!payment) {
      throw new Error(`Payment not found for external ID: ${externalId} (${method})`);
    }
    return this.confirmPayment(payment.id);
  }

  async tryMint(paymentId: string): Promise<PaymentRecord> {
    const payment = await this.queries.getPaymentById(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.status === "COMPLETE") {
      return payment;
    }

    if (payment.status === "FAILED" || payment.status === "REFUNDED") {
      throw new Error(`Payment ${paymentId} is in terminal state: ${payment.status}`);
    }

    await this.updateStatus(paymentId, payment.status, "MINT_INITIATED");

    try {
      const credentialId = await this.mintService.issueCredential(payment.wallet_hash);

      await this.queries.setCredentialId(credentialId, paymentId);
      await this.queries.insertAuditLog(paymentId, "MINT_INITIATED", "COMPLETE", `Credential issued: ${credentialId}`);

      // Fire-and-forget: submit Cardano receipt for fiat payments
      const updatedPayment = (await this.queries.getPaymentById(paymentId))!;
      if (this.isFiatPayment(updatedPayment.method)) {
        this.submitReceipt(paymentId).catch(() => {});
      }

      return updatedPayment;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.queries.setError(message, paymentId);
      await this.queries.insertAuditLog(paymentId, "MINT_INITIATED", "MINT_INITIATED", `Mint failed (retry ${payment.retries + 1}): ${message}`);

      // If too many retries, mark as failed
      if (payment.retries >= 4) {
        await this.updateStatus(paymentId, "MINT_INITIATED", "FAILED");
      }

      return (await this.queries.getPaymentById(paymentId))!;
    }
  }

  async getPayment(paymentId: string): Promise<PaymentRecord | undefined> {
    return this.queries.getPaymentById(paymentId);
  }

  async getPaymentsByWallet(walletHash: string): Promise<PaymentRecord[]> {
    return this.queries.getPaymentsByWallet(walletHash);
  }

  async getPendingReconciliation(): Promise<PaymentRecord[]> {
    return this.queries.getPendingReconciliation();
  }

  async submitReceipt(paymentId: string): Promise<void> {
    if (!this.receiptService?.isAvailable()) return;

    const payment = await this.queries.getPaymentById(paymentId);
    if (!payment || payment.receipt_status === "SUBMITTED") return;

    await this.queries.setReceiptStatus("PENDING", paymentId);

    const result = await this.receiptService.submitFiatReceipt({
      walletHash: payment.wallet_hash,
      paymentAmount: Number(payment.amount),
      paymentMethod: payment.method,
    });

    if (result.success) {
      await this.queries.setReceiptTxHash(result.txHash, paymentId);
      await this.queries.insertAuditLog(paymentId, "COMPLETE", "COMPLETE", `Cardano receipt submitted: ${result.txHash}`);
    } else {
      await this.queries.setReceiptStatus("FAILED", paymentId);
      await this.queries.insertAuditLog(paymentId, "COMPLETE", "COMPLETE", `Cardano receipt failed: ${result.error}`);
    }
  }

  async getPendingReceipts(): Promise<PaymentRecord[]> {
    return this.queries.getPendingReceipts();
  }

  async getFailedReceipts(): Promise<PaymentRecord[]> {
    return this.queries.getFailedReceipts();
  }

  private isFiatPayment(method: string): boolean {
    return method === "stripe" || method === "mercadopago";
  }

  private async updateStatus(paymentId: string, from: string, to: string): Promise<void> {
    await this.queries.updatePaymentStatus(to, paymentId);
    await this.queries.insertAuditLog(paymentId, from, to, null);
  }
}
