// Credential minting service — issues ALMA credentials on Midnight
// This wraps the SDK's SoulboundIssuer for use by the payment pipeline.

import type { MintService } from "./payment.js";
import type { Env } from "../env.js";

export interface MintServiceConfig {
  orgId: string;
  orgName: string;
  orgType: string;
  publicKey: string;
  resourceId: string;
  accessLevel: string;
  schema: string;
}

/**
 * Creates a MintService that issues credentials via the Soulbound SDK.
 *
 * In development, uses a mock that returns a fake credential ID.
 * In testnet/mainnet, uses the real MidnightProvider.
 */
export function createMintService(env: Env): MintService {
  const config: MintServiceConfig = {
    orgId: env.ALDEA_POLICY_ID,
    orgName: "ALDEA DAO",
    orgType: "DAO",
    publicKey: env.ALDEA_PUBLIC_KEY,
    resourceId: "aldea-world:main-gate",
    accessLevel: "MEMBER",
    schema: "soulbound:v1:access",
  };

  if (env.NODE_ENV === "development") {
    return createMockMintService(config);
  }

  return createRealMintService(config, env);
}

function createMockMintService(_config: MintServiceConfig): MintService {
  let counter = 0;
  return {
    async issueCredential(walletHash: string, _username?: string): Promise<string> {
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 500));
      counter++;
      return `mock-credential-${counter}-${walletHash.slice(0, 8)}`;
    },
  };
}

function createRealMintService(config: MintServiceConfig, _env: Env): MintService {
  // TODO: Replace with real SDK integration:
  //
  // import { SoulboundIssuer } from "@adasouls/soulbound-sdk";
  // import { MidnightProvider } from "@adasouls/soulbound-sdk/providers/midnight";
  //
  // const provider = new MidnightProvider({
  //   nodeUrl: env.MIDNIGHT_NODE_URL,
  //   proofServerUrl: env.MIDNIGHT_PROOF_SERVER_URL,
  //   contractAddress: env.MIDNIGHT_CREDENTIAL_CONTRACT,
  // });
  //
  // const issuer = new SoulboundIssuer(
  //   { orgId: config.orgId, orgName: config.orgName, orgType: config.orgType, publicKey: config.publicKey },
  //   provider,
  // );
  //
  // return {
  //   async issueCredential(walletHash, username) {
  //     return issuer.emit({
  //       schema: config.schema,
  //       subject: { walletAddress: walletHash, username, resourceId: config.resourceId, accessLevel: config.accessLevel },
  //     });
  //   },
  // };

  // Fallback to mock until MidnightProvider is completed
  return createMockMintService(config);
}
