// Auth routes — login, session management, profile

import type { FastifyInstance } from "fastify";
import type { AuthService } from "../services/auth.js";
import type { UsernameService } from "../services/username.js";

export function registerAuthRoutes(
  app: FastifyInstance,
  authService: AuthService,
  usernameService: UsernameService,
) {
  // ─── Login / Register ───────────────────────────────────────────────────
  //
  // Called after the frontend authenticates via Web3Auth or wallet connection.
  // The frontend sends the wallet hash and user info; the backend creates
  // or retrieves the user and returns session tokens.

  app.post<{
    Body: {
      walletHash: string;
      username: string;
      email?: string;
      authProvider: "google" | "email" | "apple" | "wallet";
    };
  }>("/auth/login", {
    schema: {
      body: {
        type: "object",
        required: ["walletHash", "username", "authProvider"],
        properties: {
          walletHash: { type: "string", minLength: 1 },
          username: { type: "string", minLength: 3, maxLength: 30 },
          email: { type: "string" },
          authProvider: { type: "string", enum: ["google", "email", "apple", "wallet"] },
        },
      },
    },
    handler: async (request, reply) => {
      const { walletHash, username, email, authProvider } = request.body;
      const normalizedUsername = username.toLowerCase();

      // Check if user already exists by wallet hash
      let user = await usernameService.getByWalletHash(walletHash);

      if (!user) {
        // New user — register
        try {
          user = await usernameService.register(normalizedUsername, walletHash, email, authProvider);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Registration failed";
          return reply.status(400).send({ error: msg });
        }
      }

      // Create session
      const tokens = authService.createSession(user);

      return reply.send({
        user: {
          id: user.id,
          username: user.username,
          displayName: `${user.username}@aldea.world`,
          email: user.email,
          walletHash: user.wallet_hash,
          authProvider: user.auth_provider,
        },
        ...tokens,
      });
    },
  });

  // ─── Refresh Token ──────────────────────────────────────────────────────

  app.post<{
    Body: { refreshToken: string };
  }>("/auth/refresh", {
    schema: {
      body: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: { type: "string", minLength: 1 },
        },
      },
    },
    handler: async (request, reply) => {
      const tokens = await authService.refreshSession(request.body.refreshToken);
      if (!tokens) {
        return reply.status(401).send({ error: "Invalid or expired refresh token" });
      }
      return reply.send(tokens);
    },
  });

  // ─── Get Current User (Profile) ────────────────────────────────────────

  app.get("/auth/me", {
    handler: async (request, reply) => {
      const user = await authService.getUserFromHeader(request.headers.authorization);
      if (!user) {
        return reply.status(401).send({ error: "Not authenticated" });
      }

      return reply.send({
        id: user.id,
        username: user.username,
        displayName: `${user.username}@aldea.world`,
        email: user.email,
        walletHash: user.wallet_hash,
        authProvider: user.auth_provider,
        createdAt: user.created_at,
      });
    },
  });

  // ─── Verify Token (for frontend session check) ─────────────────────────

  app.get("/auth/verify", {
    handler: async (request, reply) => {
      const user = await authService.getUserFromHeader(request.headers.authorization);
      return reply.send({ authenticated: user !== null });
    },
  });
}
