"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  AuthUser,
  AuthStatus,
  AuthConfig,
  AuthProvider,
  AuthSession,
  AbstractWallet,
} from "../types.js";
import { Web3AuthCardanoAdapter } from "../providers/web3auth-cardano.js";
import { ExternalWalletAdapter, type ExternalWalletName } from "../providers/external-wallet.js";
import { deriveMidnightAccount } from "../providers/midnight-account.js";

export interface UseAuthOptions {
  config: AuthConfig;
  onLogin?: (user: AuthUser) => void;
  onLogout?: () => void;
}

export interface UseAuthResult {
  /** Current auth status */
  status: AuthStatus;
  /** Authenticated user (null if not logged in) */
  user: AuthUser | null;
  /** The abstract or external wallet */
  wallet: AbstractWallet | null;
  /** Error message if login failed */
  error: string | null;
  /** Login with social provider (Google, email, Apple) */
  loginWithSocial: (provider: AuthProvider) => Promise<void>;
  /** Login with browser wallet (Lace, Nami, etc.) */
  loginWithWallet: (walletName: ExternalWalletName) => Promise<void>;
  /** Logout and clear session */
  logout: () => Promise<void>;
  /** Session tokens (for API calls) */
  session: AuthSession | null;
}

/**
 * useAuth — Unified authentication hook for ALMA.
 *
 * Supports two login methods:
 *   1. Social/email login via Web3Auth (generates abstract Cardano wallet)
 *   2. Browser wallet connection (Lace, Nami, etc.)
 *
 * Both methods produce the same AuthUser with a wallet address and key hash,
 * plus a derived Midnight shielded account.
 */
export function useAuth(options: UseAuthOptions): UseAuthResult {
  const { config, onLogin, onLogout } = options;

  const [status, setStatus] = useState<AuthStatus>("disconnected");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [wallet, setWallet] = useState<AbstractWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  const web3authRef = useRef<Web3AuthCardanoAdapter | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = globalThis.localStorage?.getItem("alma-session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthSession;
        if (parsed.expiresAt > Date.now() / 1000) {
          setSession(parsed);
          setUser(parsed.user);
          setStatus("connected");
        } else {
          globalThis.localStorage?.removeItem("alma-session");
        }
      } catch {
        globalThis.localStorage?.removeItem("alma-session");
      }
    }
  }, []);

  const registerWithBackend = useCallback(async (
    walletAddress: string,
    keyHash: string,
    walletType: "abstract" | "external",
    authProvider: AuthProvider,
    email: string | null,
    suggestedUsername: string,
  ): Promise<AuthUser> => {
    // Derive Midnight shielded account
    const midnightAccount = await deriveMidnightAccount(keyHash, null);

    // Register/login with backend
    const res = await fetch(`${config.apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletHash: keyHash,
        username: suggestedUsername,
        email,
        authProvider,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error((err as { error: string }).error);
    }

    const data = await res.json() as {
      user: { id: string; username: string; displayName: string; email: string | null; walletHash: string; authProvider: string };
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    };

    const authUser: AuthUser = {
      id: data.user.id,
      displayName: data.user.displayName,
      username: data.user.username,
      email: data.user.email,
      authProvider,
      walletAddress,
      walletHash: keyHash,
      walletType,
      midnightAccountId: midnightAccount.accountId,
    };

    const newSession: AuthSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      user: authUser,
    };

    // Persist session
    globalThis.localStorage?.setItem("alma-session", JSON.stringify(newSession));
    setSession(newSession);

    return authUser;
  }, [config.apiUrl]);

  const loginWithSocial = useCallback(async (provider: AuthProvider) => {
    setStatus("connecting");
    setError(null);

    try {
      if (!web3authRef.current) {
        web3authRef.current = new Web3AuthCardanoAdapter(config);
        await web3authRef.current.init();
      }

      const abstractWallet = await web3authRef.current.loginWithProvider(provider);
      setWallet(abstractWallet);

      // Get user info from Web3Auth
      const userInfo = await web3authRef.current.getUserInfo();
      const email = userInfo["email"] ?? null;
      const name = userInfo["name"] ?? "";

      // Generate username suggestion from email or name
      const suggestedUsername = generateUsername(email ?? name);

      const authUser = await registerWithBackend(
        abstractWallet.address,
        abstractWallet.keyHash,
        "abstract",
        provider,
        email,
        suggestedUsername,
      );

      setUser(authUser);
      setStatus("connected");
      onLogin?.(authUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      setStatus("error");
    }
  }, [config, onLogin, registerWithBackend]);

  const loginWithWallet = useCallback(async (walletName: ExternalWalletName) => {
    setStatus("connecting");
    setError(null);

    try {
      const adapter = new ExternalWalletAdapter(walletName);
      const externalWallet = await adapter.connect();
      setWallet(externalWallet);

      // For external wallets, use a truncated address hash as initial username
      const suggestedUsername = `user-${externalWallet.keyHash.slice(0, 8)}`;

      const authUser = await registerWithBackend(
        externalWallet.address,
        externalWallet.keyHash,
        "external",
        "wallet",
        null,
        suggestedUsername,
      );

      setUser(authUser);
      setStatus("connected");
      onLogin?.(authUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet connection failed";
      setError(msg);
      setStatus("error");
    }
  }, [onLogin, registerWithBackend]);

  const logout = useCallback(async () => {
    if (web3authRef.current?.isConnected()) {
      await web3authRef.current.disconnect();
    }
    setUser(null);
    setWallet(null);
    setSession(null);
    setStatus("disconnected");
    setError(null);
    globalThis.localStorage?.removeItem("alma-session");
    onLogout?.();
  }, [onLogout]);

  return {
    status,
    user,
    wallet,
    error,
    loginWithSocial,
    loginWithWallet,
    logout,
    session,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function generateUsername(input: string): string {
  // Extract a username from email or name
  const base = input.includes("@")
    ? input.split("@")[0]!
    : input;

  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || `user-${Math.random().toString(36).slice(2, 8)}`;
}
