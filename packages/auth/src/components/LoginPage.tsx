"use client";

import { useState } from "react";
import type { AuthProvider } from "../types.js";
import type { ExternalWalletName } from "../providers/external-wallet.js";
import type { UseAuthResult } from "../hooks/useAuth.js";

export interface LoginPageProps {
  auth: UseAuthResult;
  /** App name shown in the login page */
  appName?: string;
  /** Description text */
  description?: string;
  /** Whether to show the wallet connection option */
  showWalletOption?: boolean;
}

const SOCIAL_PROVIDERS: { provider: AuthProvider; label: string; icon: string }[] = [
  { provider: "google", label: "Continue with Google", icon: "G" },
  { provider: "email", label: "Continue with Email", icon: "@" },
  { provider: "apple", label: "Continue with Apple", icon: "" },
];

const WALLETS: { name: ExternalWalletName; label: string }[] = [
  { name: "lace", label: "Lace" },
  { name: "nami", label: "Nami" },
  { name: "eternl", label: "Eternl" },
  { name: "flint", label: "Flint" },
  { name: "typhon", label: "Typhon" },
];

/**
 * LoginPage — Pre-built login component for ALMA apps.
 *
 * Shows social login options (Google, email, Apple) and an optional
 * "Connect Wallet" section for crypto-native users.
 *
 * Usage:
 *   const auth = useAuth({ config });
 *   <LoginPage auth={auth} appName="ALDEA World" />
 */
export function LoginPage({
  auth,
  appName = "ALMA",
  description = "Sign in to access your credentials",
  showWalletOption = true,
}: LoginPageProps) {
  const [showWallets, setShowWallets] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const isConnecting = auth.status === "connecting";

  const handleSocialLogin = async (provider: AuthProvider) => {
    setConnectingProvider(provider);
    await auth.loginWithSocial(provider);
    setConnectingProvider(null);
  };

  const handleWalletLogin = async (walletName: ExternalWalletName) => {
    setConnectingProvider(walletName);
    await auth.loginWithWallet(walletName);
    setConnectingProvider(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{appName}</h1>
          <p className="text-sm text-gray-500">{description}</p>
        </div>

        {/* Social Login */}
        <div className="space-y-3">
          {SOCIAL_PROVIDERS.map(({ provider, label, icon }) => (
            <button
              key={provider}
              onClick={() => handleSocialLogin(provider)}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="w-5 h-5 flex items-center justify-center text-sm font-bold">
                {icon}
              </span>
              <span className="font-medium">
                {isConnecting && connectingProvider === provider
                  ? "Connecting..."
                  : label}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        {showWalletOption && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-gray-400">
                  or connect a wallet
                </span>
              </div>
            </div>

            {/* Wallet Toggle */}
            {!showWallets ? (
              <button
                onClick={() => setShowWallets(true)}
                disabled={isConnecting}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors text-sm text-gray-600 disabled:opacity-50"
              >
                I have a Cardano wallet
              </button>
            ) : (
              <div className="space-y-2">
                {WALLETS.map(({ name, label }) => (
                  <button
                    key={name}
                    onClick={() => handleWalletLogin(name)}
                    disabled={isConnecting}
                    className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-50"
                  >
                    <span className="font-medium">{label}</span>
                    {isConnecting && connectingProvider === name ? (
                      <span className="text-xs text-gray-400">Connecting...</span>
                    ) : (
                      <span className="text-xs text-gray-400">Connect</span>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => setShowWallets(false)}
                  className="w-full text-xs text-gray-400 py-1 hover:text-gray-600"
                >
                  Back to social login
                </button>
              </div>
            )}
          </>
        )}

        {/* Error */}
        {auth.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {auth.error}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          No crypto needed. Your wallet is created automatically.
        </p>
      </div>
    </div>
  );
}
