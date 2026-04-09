// ALDEA token payment routes — on-chain token payment verification
//
// When a user pays with ALDEA tokens, the frontend builds and submits
// the tx on-chain (via MeshJS). This route verifies the tx was confirmed
// and triggers credential minting.

import type { FastifyInstance } from "fastify";
import type { Env } from "../env.js";
import type { PaymentService } from "../services/payment.js";

export function registerAldeaTokenRoutes(
  app: FastifyInstance,
  env: Env,
  paymentService: PaymentService,
) {
  // ─── Verify on-chain token payment and trigger mint ─────────────────────

  app.post<{
    Body: {
      txHash: string;
      walletHash: string;
      tokenAmount: string;
      username?: string;
    };
  }>("/payments/aldea-token/verify", {
    schema: {
      body: {
        type: "object",
        required: ["txHash", "walletHash", "tokenAmount"],
        properties: {
          txHash: { type: "string", minLength: 64, maxLength: 64 },
          walletHash: { type: "string", minLength: 1 },
          tokenAmount: { type: "string", minLength: 1 },
          username: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      const { txHash, walletHash, tokenAmount, username } = request.body;

      // Verify the transaction exists on-chain via Blockfrost
      const confirmed = await verifyOnChainPayment(
        txHash,
        env.BLOCKFROST_URL,
        env.BLOCKFROST_PROJECT_ID,
      );

      if (!confirmed) {
        return reply.status(400).send({
          error: "Transaction not confirmed on-chain. It may still be pending — try again in a few minutes.",
        });
      }

      // Create payment record and immediately confirm + mint
      const payment = await paymentService.createPayment({
        method: "aldea_token",
        externalId: txHash,
        walletHash,
        username,
        amount: tokenAmount,
        currency: "ALDEA",
      });

      // If idempotency caught a duplicate, return the existing record
      if (payment.status === "COMPLETE") {
        return reply.send({
          paymentId: payment.id,
          status: payment.status,
          credentialId: payment.credential_id,
        });
      }

      try {
        const result = await paymentService.confirmPayment(payment.id);
        return reply.send({
          paymentId: result.id,
          status: result.status,
          credentialId: result.credential_id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        app.log.error(`ALDEA token payment failed for tx ${txHash}: ${msg}`);
        return reply.status(500).send({
          paymentId: payment.id,
          status: "FAILED",
          error: msg,
        });
      }
    },
  });

  // ─── Get current ALDEA token price ──────────────────────────────────────

  app.get("/payments/aldea-token/price", {
    handler: async (_request, reply) => {
      // TODO: Integrate with a DEX price oracle (SundaeSwap, Minswap, etc.)
      // For now, return the configured static price
      return reply.send({
        priceAda: 35,
        priceAldeaTokens: env.MINT_PRICE_LOVELACE,
        source: "static",
        note: "Static price — will be replaced with DEX oracle integration",
      });
    },
  });
}

// ─── On-chain verification ────────────────────────────────────────────────

async function verifyOnChainPayment(
  txHash: string,
  blockfrostUrl: string,
  projectId: string,
): Promise<boolean> {
  if (!projectId) {
    // In development without Blockfrost, assume confirmed
    return true;
  }

  try {
    const res = await fetch(`${blockfrostUrl}/txs/${txHash}`, {
      headers: { project_id: projectId },
    });
    return res.ok;
  } catch {
    return false;
  }
}
