// General payment routes — status checking, listing, and reconciliation

import type { FastifyInstance } from "fastify";
import type { PaymentService } from "../services/payment.js";

export function registerPaymentRoutes(
  app: FastifyInstance,
  paymentService: PaymentService,
) {
  // ─── Get payment status ─────────────────────────────────────────────────

  app.get<{
    Params: { paymentId: string };
  }>("/payments/:paymentId", {
    handler: async (request, reply) => {
      const payment = await paymentService.getPayment(request.params.paymentId);
      if (!payment) {
        return reply.status(404).send({ error: "Payment not found" });
      }
      return reply.send({
        id: payment.id,
        method: payment.method,
        status: payment.status,
        credentialId: payment.credential_id,
        createdAt: payment.created_at,
      });
    },
  });

  // ─── Get payments by wallet ─────────────────────────────────────────────

  app.get<{
    Params: { walletHash: string };
  }>("/payments/wallet/:walletHash", {
    handler: async (request, reply) => {
      const payments = await paymentService.getPaymentsByWallet(request.params.walletHash);
      return reply.send(
        payments.map((p) => ({
          id: p.id,
          method: p.method,
          status: p.status,
          credentialId: p.credential_id,
          amount: p.amount,
          currency: p.currency,
          createdAt: p.created_at,
        })),
      );
    },
  });

  // ─── Manual retry (admin) ──────────────────────────────────────────────

  app.post<{
    Params: { paymentId: string };
  }>("/payments/:paymentId/retry", {
    handler: async (request, reply) => {
      // TODO: Add admin auth middleware
      try {
        const payment = await paymentService.tryMint(request.params.paymentId);
        return reply.send({
          id: payment.id,
          status: payment.status,
          credentialId: payment.credential_id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return reply.status(400).send({ error: msg });
      }
    },
  });
}
