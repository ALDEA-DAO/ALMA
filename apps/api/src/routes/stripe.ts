// Stripe payment routes — checkout session creation and webhook handling

import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import type { Env } from "../env.js";
import type { PaymentService } from "../services/payment.js";

export function registerStripeRoutes(
  app: FastifyInstance,
  env: Env,
  paymentService: PaymentService,
) {
  if (!env.STRIPE_SECRET_KEY) {
    app.log.warn("STRIPE_SECRET_KEY not set — Stripe routes disabled");
    return;
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  // ─── Create Checkout Session ────────────────────────────────────────────

  app.post<{
    Body: { walletHash: string; username?: string };
  }>("/payments/stripe/checkout", {
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

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "ALMA Credential",
                description: "Soulbound membership credential for ALDEA DAO",
              },
              unit_amount: env.STRIPE_PRICE_CENTS,
            },
            quantity: 1,
          },
        ],
        metadata: {
          wallet_hash: walletHash,
          username: username ?? "",
        },
        success_url: `${env.FRONTEND_URL}/mint/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.FRONTEND_URL}/mint?cancelled=true`,
      });

      // Create payment record
      await paymentService.createPayment({
        method: "stripe",
        externalId: session.id,
        walletHash,
        username,
        amount: String(env.STRIPE_PRICE_CENTS),
        currency: "usd",
      });

      return reply.send({ sessionId: session.id, url: session.url });
    },
  });

  // ─── Webhook ────────────────────────────────────────────────────────────

  app.post("/webhooks/stripe", {
    config: {
      // Raw body needed for signature verification
      rawBody: true,
    },
    handler: async (request, reply) => {
      const signature = request.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        return reply.status(400).send({ error: "Missing stripe-signature header" });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          (request as unknown as { rawBody: string }).rawBody,
          signature,
          env.STRIPE_WEBHOOK_SECRET,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        app.log.error(`Stripe webhook signature verification failed: ${msg}`);
        return reply.status(400).send({ error: "Invalid signature" });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const walletHash = session.metadata?.wallet_hash;

        if (!walletHash) {
          app.log.error(`Stripe webhook: missing wallet_hash in session ${session.id}`);
          return reply.status(400).send({ error: "Missing wallet_hash metadata" });
        }

        try {
          await paymentService.confirmByExternalId(session.id, "stripe");
          app.log.info(`Stripe payment confirmed and credential minted for session ${session.id}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          app.log.error(`Failed to process Stripe payment ${session.id}: ${msg}`);
          // Return 200 so Stripe doesn't retry — reconciliation will pick it up
        }
      }

      return reply.status(200).send({ received: true });
    },
  });

  // ─── Check session status ───────────────────────────────────────────────

  app.get<{
    Params: { sessionId: string };
  }>("/payments/stripe/session/:sessionId", {
    handler: async (request, reply) => {
      const { sessionId } = request.params;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      return reply.send({
        status: session.payment_status,
        walletHash: session.metadata?.wallet_hash,
      });
    },
  });
}
