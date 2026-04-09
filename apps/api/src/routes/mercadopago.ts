// Mercado Pago payment routes — Checkout Pro and IPN webhook

import type { FastifyInstance } from "fastify";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import type { Env } from "../env.js";
import type { PaymentService } from "../services/payment.js";

export function registerMercadoPagoRoutes(
  app: FastifyInstance,
  env: Env,
  paymentService: PaymentService,
) {
  if (!env.MP_ACCESS_TOKEN) {
    app.log.warn("MP_ACCESS_TOKEN not set — Mercado Pago routes disabled");
    return;
  }

  const mpConfig = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });
  const preferenceClient = new Preference(mpConfig);
  const paymentClient = new Payment(mpConfig);

  // ─── Create Checkout Pro preference ─────────────────────────────────────

  app.post<{
    Body: { walletHash: string; username?: string };
  }>("/payments/mercadopago/checkout", {
    schema: {
      body: {
        type: "object",
        required: ["walletHash"],
        properties: {
          walletHash: { type: "string", minLength: 1 },
          username: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      const { walletHash, username } = request.body;

      const preference = await preferenceClient.create({
        body: {
          items: [
            {
              id: "alma-credential",
              title: "ALMA Credential — ALDEA DAO",
              description: "Soulbound membership credential for ALDEA DAO",
              quantity: 1,
              unit_price: env.MP_PRICE_ARS,
              currency_id: "ARS",
            },
          ],
          metadata: {
            wallet_hash: walletHash,
            username: username ?? "",
          },
          back_urls: {
            success: `${env.FRONTEND_URL}/mint/success`,
            failure: `${env.FRONTEND_URL}/mint?failed=true`,
            pending: `${env.FRONTEND_URL}/mint?pending=true`,
          },
          auto_return: "approved",
          notification_url: `${env.API_URL}/webhooks/mercadopago`,
        },
      });

      // Create payment record
      await paymentService.createPayment({
        method: "mercadopago",
        externalId: preference.id!,
        walletHash,
        username,
        amount: String(env.MP_PRICE_ARS),
        currency: "ars",
      });

      return reply.send({
        preferenceId: preference.id,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
      });
    },
  });

  // ─── IPN Webhook ────────────────────────────────────────────────────────

  app.post<{
    Body: { action: string; data: { id: string }; type: string };
    Querystring: { "data.id"?: string; type?: string };
  }>("/webhooks/mercadopago", {
    handler: async (request, reply) => {
      // MP sends notifications in two formats: body or query params
      const paymentId = request.body?.data?.id ?? request.query["data.id"];
      const notificationType = request.body?.type ?? request.query.type;

      if (notificationType !== "payment" || !paymentId) {
        return reply.status(200).send({ ignored: true });
      }

      try {
        const mpPayment = await paymentClient.get({ id: paymentId });

        if (mpPayment.status !== "approved") {
          app.log.info(`MP payment ${paymentId} status: ${mpPayment.status} — ignoring`);
          return reply.status(200).send({ received: true });
        }

        const walletHash = (mpPayment.metadata as Record<string, string>)?.wallet_hash;
        if (!walletHash) {
          app.log.error(`MP webhook: missing wallet_hash in payment ${paymentId}`);
          return reply.status(200).send({ received: true });
        }

        // The preference ID links to our payment record
        const preferenceId = (mpPayment as unknown as { preference_id?: string }).preference_id;
        if (preferenceId) {
          await paymentService.confirmByExternalId(preferenceId, "mercadopago");
          app.log.info(`MP payment confirmed and credential minted for preference ${preferenceId}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        app.log.error(`Failed to process MP payment ${paymentId}: ${msg}`);
        // Return 200 so MP doesn't retry excessively — reconciliation handles it
      }

      return reply.status(200).send({ received: true });
    },
  });
}
