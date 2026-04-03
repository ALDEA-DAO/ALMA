// User routes — registration, username lookup, availability check

import type { FastifyInstance } from "fastify";
import type { UsernameService } from "../services/username.js";

export function registerUserRoutes(
  app: FastifyInstance,
  usernameService: UsernameService,
) {
  // ─── Check username availability ────────────────────────────────────────

  app.get<{
    Params: { username: string };
  }>("/users/check/:username", {
    handler: async (request, reply) => {
      const username = request.params.username.toLowerCase();
      const validation = usernameService.validate(username);

      if (!validation.valid) {
        return reply.send({ available: false, error: validation.error });
      }

      const available = usernameService.isAvailable(username);
      return reply.send({ available, formatted: `${username}@aldea.world` });
    },
  });

  // ─── Register username ──────────────────────────────────────────────────

  app.post<{
    Body: { username: string; walletHash: string; email?: string; authProvider?: string };
  }>("/users/register", {
    schema: {
      body: {
        type: "object",
        required: ["username", "walletHash"],
        properties: {
          username: { type: "string", minLength: 3, maxLength: 30 },
          walletHash: { type: "string", minLength: 1 },
          email: { type: "string" },
          authProvider: { type: "string" },
        },
      },
    },
    handler: async (request, reply) => {
      const { username, walletHash, email, authProvider } = request.body;

      try {
        const user = usernameService.register(
          username.toLowerCase(),
          walletHash,
          email,
          authProvider ?? "wallet",
        );
        return reply.status(201).send({
          id: user.id,
          username: user.username,
          displayName: `${user.username}@aldea.world`,
          walletHash: user.wallet_hash,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return reply.status(400).send({ error: msg });
      }
    },
  });

  // ─── Get user by username ───────────────────────────────────────────────

  app.get<{
    Params: { username: string };
  }>("/users/:username", {
    handler: async (request, reply) => {
      const user = usernameService.getByUsername(request.params.username.toLowerCase());
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return reply.send({
        username: user.username,
        displayName: `${user.username}@aldea.world`,
        createdAt: user.created_at,
      });
    },
  });

  // ─── Get user by wallet hash ────────────────────────────────────────────

  app.get<{
    Params: { walletHash: string };
  }>("/users/wallet/:walletHash", {
    handler: async (request, reply) => {
      const user = usernameService.getByWalletHash(request.params.walletHash);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return reply.send({
        username: user.username,
        displayName: `${user.username}@aldea.world`,
        createdAt: user.created_at,
      });
    },
  });
}
