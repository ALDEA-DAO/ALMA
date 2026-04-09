// Reconciliation service — retries stuck payments on a cron interval

import type { PaymentService } from "./payment.js";
import type { FastifyBaseLogger } from "fastify";

export class ReconciliationService {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private paymentService: PaymentService,
    private logger: FastifyBaseLogger,
    private intervalMs = 5 * 60 * 1000, // 5 minutes
  ) {}

  start(): void {
    this.logger.info(`Reconciliation service started (interval: ${this.intervalMs / 1000}s)`);
    this.timer = setInterval(() => this.run(), this.intervalMs);
    // Run immediately on start
    this.run();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info("Reconciliation service stopped");
    }
  }

  private async run(): Promise<void> {
    await this.retryStalePayments();
    await this.retryFailedReceipts();
  }

  private async retryStalePayments(): Promise<void> {
    const stale = await this.paymentService.getPendingReconciliation();

    if (stale.length === 0) return;

    this.logger.info(`Reconciliation: found ${stale.length} stale payment(s)`);

    for (const payment of stale) {
      try {
        const result = await this.paymentService.tryMint(payment.id);
        if (result.status === "COMPLETE") {
          this.logger.info(`Reconciliation: payment ${payment.id} minted successfully`);
        } else if (result.status === "FAILED") {
          this.logger.error(`Reconciliation: payment ${payment.id} permanently failed after ${result.retries} retries`);
        } else {
          this.logger.warn(`Reconciliation: payment ${payment.id} still pending (retry ${result.retries})`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        this.logger.error(`Reconciliation: error processing payment ${payment.id}: ${msg}`);
      }
    }
  }

  private async retryFailedReceipts(): Promise<void> {
    const pending = await this.paymentService.getPendingReceipts();
    const failed = await this.paymentService.getFailedReceipts();
    const toRetry = [...pending, ...failed];

    if (toRetry.length === 0) return;

    this.logger.info(`Reconciliation: ${toRetry.length} receipt(s) to retry`);

    for (const payment of toRetry) {
      try {
        await this.paymentService.submitReceipt(payment.id);
        this.logger.info(`Reconciliation: receipt for payment ${payment.id} submitted`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        this.logger.error(`Reconciliation: receipt retry failed for ${payment.id}: ${msg}`);
      }
    }
  }
}
