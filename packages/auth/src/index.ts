// @aldea/auth — Account abstraction and authentication for ALMA

// Types
export type {
  AuthProvider,
  AuthStatus,
  WalletType,
  AuthUser,
  AuthSession,
  AbstractWallet,
  WalletAdapter,
  AuthConfig,
} from "./types.js";

// Hooks
export { useAuth } from "./hooks/useAuth.js";
export type { UseAuthOptions, UseAuthResult } from "./hooks/useAuth.js";

// Components
export { LoginPage } from "./components/LoginPage.js";
export type { LoginPageProps } from "./components/LoginPage.js";
export { UserProfile } from "./components/UserProfile.js";
export type { UserProfileProps } from "./components/UserProfile.js";

// Providers (for advanced usage)
export { Web3AuthCardanoAdapter } from "./providers/web3auth-cardano.js";
export { ExternalWalletAdapter } from "./providers/external-wallet.js";
export type { ExternalWalletName } from "./providers/external-wallet.js";
export { deriveMidnightAccount } from "./providers/midnight-account.js";
export type { MidnightAccount, MidnightAccountConfig } from "./providers/midnight-account.js";
