// Account abstraction types — shared across providers, hooks, and components

export type AuthProvider = "google" | "email" | "apple" | "wallet";

export type AuthStatus = "disconnected" | "connecting" | "connected" | "error";

export type WalletType = "abstract" | "external";

export interface AuthUser {
  /** Unique user ID */
  id: string;
  /** Display name (username@aldea.world) */
  displayName: string;
  /** Username (lowercase, unique) */
  username: string;
  /** Email address (if social/email login) */
  email: string | null;
  /** Auth method used */
  authProvider: AuthProvider;
  /** Cardano wallet address (derived or external) */
  walletAddress: string;
  /** Wallet key hash (for credential binding) */
  walletHash: string;
  /** Whether this is an abstract (generated) or external (browser) wallet */
  walletType: WalletType;
  /** Midnight shielded account ID (derived from Cardano identity) */
  midnightAccountId: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export interface AbstractWallet {
  /** Cardano wallet address (bech32) */
  address: string;
  /** Wallet key hash */
  keyHash: string;
  /** Sign a transaction (delegates to Web3Auth private key) */
  signTx(unsignedTx: string): Promise<string>;
  /** Get the public key */
  getPublicKey(): string;
}

export interface WalletAdapter {
  /** Connect and return an abstract wallet */
  connect(): Promise<AbstractWallet>;
  /** Disconnect and clean up */
  disconnect(): Promise<void>;
  /** Whether the adapter is currently connected */
  isConnected(): boolean;
  /** Get the underlying provider name */
  providerName: string;
}

export interface AuthConfig {
  /** Backend API URL */
  apiUrl: string;
  /** Web3Auth client ID (from dashboard.web3auth.io) */
  web3AuthClientId: string;
  /** Web3Auth network: "sapphire_devnet" | "sapphire_mainnet" */
  web3AuthNetwork: "sapphire_devnet" | "sapphire_mainnet";
  /** Cardano network ID: 0 = testnet, 1 = mainnet */
  cardanoNetworkId: 0 | 1;
}
