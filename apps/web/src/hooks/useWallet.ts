"use client";

import { useState, useCallback } from "react";

export type WalletName = "lace" | "nami" | "eternl" | "flint" | "typhon";

export interface WalletState {
  connected: boolean;
  connecting: boolean;
  walletName: WalletName | null;
  address: string | null;
  error: string | null;
}

/**
 * Hook for connecting to a CIP-30 Cardano browser wallet.
 *
 * Uses the MeshJS BrowserWallet under the hood.
 * Falls back gracefully if the wallet extension is not installed.
 */
export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    connecting: false,
    walletName: null,
    address: null,
    error: null,
  });

  const connect = useCallback(async (walletName: WalletName) => {
    setState((s) => ({ ...s, connecting: true, error: null }));

    try {
      // Dynamic import — only loads MeshJS when actually connecting
      const { BrowserWallet } = await import("@meshsdk/core");
      const wallet = await BrowserWallet.enable(walletName);
      const addresses = await wallet.getUsedAddresses();

      if (addresses.length === 0) {
        throw new Error(
          "No addresses found. Make sure the wallet has been set up."
        );
      }

      setState({
        connected: true,
        connecting: false,
        walletName,
        address: addresses[0]!,
        error: null,
      });

      return { wallet, address: addresses[0]! };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect wallet";
      setState((s) => ({
        ...s,
        connecting: false,
        error: message,
      }));
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      connected: false,
      connecting: false,
      walletName: null,
      address: null,
      error: null,
    });
  }, []);

  return { ...state, connect, disconnect };
}
