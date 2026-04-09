// Auth service — JWT session management for abstract and external wallets

import { randomUUID, createHmac } from "node:crypto";
import type { Queries, UserRecord } from "../db/schema.js";
import type { Env } from "../env.js";

export interface TokenPayload {
  sub: string;       // user ID
  username: string;
  walletHash: string;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Minimal JWT implementation using HMAC-SHA256.
 *
 * For production, consider using a proper JWT library (jose)
 * or delegating to an auth provider. This is intentionally simple
 * to avoid unnecessary dependencies at this stage.
 */
export class AuthService {
  private secret: string;
  private accessTokenTtl = 60 * 60; // 1 hour
  private refreshTokenTtl = 60 * 60 * 24 * 30; // 30 days

  constructor(
    private queries: Queries,
    env: Env,
  ) {
    // Use a deterministic secret in development, require a real one in production
    this.secret = process.env["AUTH_SECRET"] ?? (
      env.NODE_ENV === "development"
        ? "dev-secret-do-not-use-in-production"
        : (() => { throw new Error("AUTH_SECRET is required in production"); })()
    );
  }

  /**
   * Create session tokens for an authenticated user.
   * Called after Web3Auth login or wallet connection is verified.
   */
  createSession(user: UserRecord): AuthTokens {
    const now = Math.floor(Date.now() / 1000);

    const accessPayload: TokenPayload = {
      sub: user.id,
      username: user.username,
      walletHash: user.wallet_hash,
      iat: now,
      exp: now + this.accessTokenTtl,
    };

    const refreshPayload: TokenPayload = {
      sub: user.id,
      username: user.username,
      walletHash: user.wallet_hash,
      iat: now,
      exp: now + this.refreshTokenTtl,
    };

    return {
      accessToken: this.signToken(accessPayload),
      refreshToken: this.signToken(refreshPayload),
      expiresAt: accessPayload.exp,
    };
  }

  /**
   * Verify and decode an access token.
   * Returns the payload or null if invalid/expired.
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      const [headerB64, payloadB64, signatureB64] = token.split(".");
      if (!headerB64 || !payloadB64 || !signatureB64) return null;

      // Verify signature
      const expected = this.hmacSign(`${headerB64}.${payloadB64}`);
      if (expected !== signatureB64) return null;

      // Decode payload
      const payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString()
      ) as TokenPayload;

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) return null;

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Refresh an access token using a valid refresh token.
   */
  async refreshSession(refreshToken: string): Promise<AuthTokens | null> {
    const payload = this.verifyToken(refreshToken);
    if (!payload) return null;

    const user = await this.queries.getUserByUsername(payload.username);
    if (!user) return null;

    return this.createSession(user);
  }

  /**
   * Get user from an authorization header value.
   */
  async getUserFromHeader(authHeader: string | undefined): Promise<UserRecord | null> {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const payload = this.verifyToken(token);
    if (!payload) return null;
    return (await this.queries.getUserByUsername(payload.username)) ?? null;
  }

  private signToken(payload: TokenPayload): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.hmacSign(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
  }

  private hmacSign(data: string): string {
    return createHmac("sha256", this.secret).update(data).digest("base64url");
  }
}
