// ALMA Protocol — Backend API
//
// Handles fiat payments (Stripe, Mercado Pago), credential minting,
// user registration, and payment reconciliation.
//
// Usage:
//   Development: npm run dev
//   Production:  npm run build && npm start

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

import { loadEnv } from "./env.js";
import { createPool, initDatabase, createQueries } from "./db/schema.js";
import { PaymentService } from "./services/payment.js";
import { createMintService } from "./services/mint.js";
import { UsernameService } from "./services/username.js";
import { ReconciliationService } from "./services/reconciliation.js";
import { createCardanoReceiptService } from "./services/cardano-receipt.js";
import { registerStripeRoutes } from "./routes/stripe.js";
import { registerMercadoPagoRoutes } from "./routes/mercadopago.js";
import { registerAldeaTokenRoutes } from "./routes/aldea-token.js";
import { registerPaymentRoutes } from "./routes/payments.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { AuthService } from "./services/auth.js";

async function main() {
  const env = loadEnv();

  // ─── Fastify instance ──────────────────────────────────────────────────

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "debug" : "info",
    },
  });

  // Raw body for Stripe webhook signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => {
      try {
        const json = JSON.parse(body.toString());
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // Attach raw body to request
  app.addHook("preHandler", (request, _reply, done) => {
    if (request.headers["content-type"]?.includes("application/json")) {
      // The raw body is already available via the buffer parser
      (request as unknown as { rawBody: string }).rawBody = JSON.stringify(request.body);
    }
    done();
  });

  // ─── Plugins ────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: [env.FRONTEND_URL, "http://localhost:3000", "http://localhost:3002"],
    methods: ["GET", "POST"],
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // ─── Database ───────────────────────────────────────────────────────────

  const pool = createPool(env.DATABASE_URL);
  await initDatabase(pool);

  const queries = createQueries(pool);

  // ─── Services ───────────────────────────────────────────────────────────

  const mintService = createMintService(env);
  const receiptService = createCardanoReceiptService(env);
  const paymentService = new PaymentService(queries, mintService, receiptService);
  const usernameService = new UsernameService(queries);
  const authService = new AuthService(queries, env);
  const reconciliation = new ReconciliationService(paymentService, app.log);

  // ─── Routes ─────────────────────────────────────────────────────────────

  app.get("/health", async () => ({
    status: "ok",
    service: "alma-api",
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }));

  registerAuthRoutes(app, authService, usernameService);
  registerStripeRoutes(app, env, paymentService);
  registerMercadoPagoRoutes(app, env, paymentService);
  registerAldeaTokenRoutes(app, env, paymentService);
  registerPaymentRoutes(app, paymentService);
  registerUserRoutes(app, usernameService);

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  app.addHook("onClose", async () => {
    reconciliation.stop();
    await pool.end();
  });

  // ─── Start ──────────────────────────────────────────────────────────────

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    reconciliation.start();
    app.log.info(`ALMA API running on port ${env.PORT} (${env.NODE_ENV})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      await app.close();
      process.exit(0);
    });
  }
}

main();
