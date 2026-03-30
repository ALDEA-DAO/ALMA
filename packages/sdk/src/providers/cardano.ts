/**
 * TASK-020 — Cardano wallet provider (MeshJS)
 *
 * Handles Cardano-side operations for the Soulbound Protocol:
 *   - Wallet connection (Lace, Nami, Eternal, Flint, etc.)
 *   - Transaction signing for SoulboundRegistry interactions
 *   - Issuer registration, schema registration, revocation publishing
 *
 * This provider does NOT handle credential state or ZK proofs — that's
 * the MidnightProvider's job. CardanoProvider handles the public registry
 * layer only.
 *
 * Requires @meshsdk/core as a peer dependency.
 *
 * @example
 *   import { CardanoProvider } from "@adasouls/soulbound-sdk/providers/cardano";
 *
 *   const cardano = new CardanoProvider({
 *     networkId: 0, // 0 = testnet/preprod, 1 = mainnet
 *     registryScriptHash: "abc123...",
 *     blockfrostUrl: "https://cardano-preprod.blockfrost.io/api/v0",
 *     blockfrostProjectId: "preprod_xxx",
 *   });
 *
 *   // Connect user's wallet
 *   await cardano.connect("lace");
 *
 *   // Register an issuer on-chain
 *   const txHash = await cardano.registerIssuer({
 *     orgName: "ALDEA DAO",
 *     orgType: "DAO",
 *     schemas: ["soulbound:v1:access", "soulbound:v1:membership"],
 *   });
 */

import { createHash } from "node:crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Supported wallet names for CIP-30 browser extension wallets. */
export type WalletName = "lace" | "nami" | "eternl" | "flint" | "typhon" | "gerowallet" | string;

export interface CardanoProviderConfig {
  /** Cardano network ID: 0 = testnet/preprod, 1 = mainnet */
  networkId: 0 | 1;
  /** Script hash of the deployed SoulboundRegistry validator */
  registryScriptHash: string;
  /** Blockfrost API base URL */
  blockfrostUrl: string;
  /** Blockfrost project ID */
  blockfrostProjectId: string;
}

export interface RegisterIssuerParams {
  orgName: string;
  orgType: string;
  schemas: string[];
}

export interface RegisterSchemaParams {
  schemaId: string;
  requiredFields: string[];
  optionalFields?: string[];
  disclosableFields?: string[];
}

export interface PublishRevocationParams {
  credentialHash: string;
  revocationAnchor: string;
}

export interface CardanoTxResult {
  txHash: string;
  confirmed: boolean;
}

// ─── MeshJS type stubs ───────────────────────────────────────────────────────
// These mirror the MeshJS API. The actual types come from @meshsdk/core
// at runtime. We define minimal interfaces here to avoid requiring MeshJS
// as a compile-time dependency for the entire SDK.

interface MeshBrowserWallet {
  getUsedAddresses(): Promise<string[]>;
  getChangeAddress(): Promise<string>;
  signTx(unsignedTx: string, partialSign?: boolean): Promise<string>;
  submitTx(signedTx: string): Promise<string>;
}

interface MeshTxBuilder {
  txOut(address: string, amount: { unit: string; quantity: string }[]): MeshTxBuilder;
  txOutInlineDatumValue(datum: string): MeshTxBuilder;
  changeAddress(address: string): MeshTxBuilder;
  requiredSignerHash(hash: string): MeshTxBuilder;
  complete(): Promise<string>;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class CardanoProvider {
  private config: CardanoProviderConfig;
  private wallet: MeshBrowserWallet | null = null;
  private walletAddress: string | null = null;
  private walletKeyHash: string | null = null;

  constructor(config: CardanoProviderConfig) {
    this.config = config;
  }

  // ─── Wallet connection ───────────────────────────────────────────────

  /**
   * Connect to a CIP-30 browser extension wallet.
   *
   * @param walletName - Wallet provider name (e.g., "lace", "nami", "eternl")
   * @throws If the wallet extension is not installed or the user rejects
   *
   * @example
   *   await cardano.connect("lace");
   *   console.log(cardano.getAddress()); // "addr_test1..."
   */
  async connect(walletName: WalletName): Promise<void> {
    // Dynamic import to avoid requiring MeshJS at module load time.
    // Users who only use MockProvider don't need MeshJS installed.
    const { BrowserWallet } = await import("@meshsdk/core");
    const wallet = await BrowserWallet.enable(walletName);

    const addresses = await wallet.getUsedAddresses();
    if (addresses.length === 0) {
      throw new Error(
        `No used addresses found in ${walletName} wallet. ` +
        "Make sure the wallet has been initialized and has received funds."
      );
    }

    this.wallet = wallet as unknown as MeshBrowserWallet;
    this.walletAddress = addresses[0]!;
    this.walletKeyHash = this.addressToKeyHash(this.walletAddress);
  }

  /**
   * Connect with a pre-built wallet instance (for server-side or testing).
   */
  connectWithWallet(wallet: MeshBrowserWallet, address: string): void {
    this.wallet = wallet;
    this.walletAddress = address;
    this.walletKeyHash = this.addressToKeyHash(address);
  }

  /** Returns true if a wallet is currently connected. */
  isConnected(): boolean {
    return this.wallet !== null;
  }

  /** Returns the connected wallet's primary address, or null. */
  getAddress(): string | null {
    return this.walletAddress;
  }

  /** Returns the key hash of the connected wallet, or null. */
  getKeyHash(): string | null {
    return this.walletKeyHash;
  }

  // ─── Registry operations ─────────────────────────────────────────────

  /**
   * Register a new issuer organization in the SoulboundRegistry.
   *
   * Creates a UTxO at the registry script address with an IssuerDatum
   * containing the org info. The connected wallet's key hash becomes
   * the admin_vkh.
   *
   * @returns Transaction hash of the registration tx
   */
  async registerIssuer(params: RegisterIssuerParams): Promise<CardanoTxResult> {
    this.ensureConnected();

    const { MeshTxBuilder, serializePlutusScript } = await import("@meshsdk/core");

    const datum = this.buildIssuerDatum(params);
    const registryAddress = this.getRegistryAddress();

    const txBuilder: MeshTxBuilder = new MeshTxBuilder();
    const unsignedTx = await txBuilder
      .txOut(registryAddress, [{ unit: "lovelace", quantity: "2000000" }])
      .txOutInlineDatumValue(datum)
      .changeAddress(this.walletAddress!)
      .requiredSignerHash(this.walletKeyHash!)
      .complete();

    return this.signAndSubmit(unsignedTx);
  }

  /**
   * Register a new credential schema in the SoulboundRegistry.
   *
   * @returns Transaction hash of the registration tx
   */
  async registerSchema(params: RegisterSchemaParams): Promise<CardanoTxResult> {
    this.ensureConnected();

    const { MeshTxBuilder } = await import("@meshsdk/core");

    const datum = this.buildSchemaDatum(params);
    const registryAddress = this.getRegistryAddress();

    const txBuilder: MeshTxBuilder = new MeshTxBuilder();
    const unsignedTx = await txBuilder
      .txOut(registryAddress, [{ unit: "lovelace", quantity: "2000000" }])
      .txOutInlineDatumValue(datum)
      .changeAddress(this.walletAddress!)
      .requiredSignerHash(this.walletKeyHash!)
      .complete();

    return this.signAndSubmit(unsignedTx);
  }

  /**
   * Publish a revocation anchor from Midnight onto Cardano.
   *
   * TASK-012 bridge: when a credential is revoked in the Midnight contract,
   * the issuer publishes an opaque revocation anchor on Cardano so anyone
   * can verify the revocation without learning the holder's identity.
   *
   * @returns Transaction hash of the revocation publish tx
   */
  async publishRevocation(params: PublishRevocationParams): Promise<CardanoTxResult> {
    this.ensureConnected();

    const { MeshTxBuilder } = await import("@meshsdk/core");

    const datum = this.buildRevocationDatum(params);
    const registryAddress = this.getRegistryAddress();

    const txBuilder: MeshTxBuilder = new MeshTxBuilder();
    const unsignedTx = await txBuilder
      .txOut(registryAddress, [{ unit: "lovelace", quantity: "2000000" }])
      .txOutInlineDatumValue(datum)
      .changeAddress(this.walletAddress!)
      .requiredSignerHash(this.walletKeyHash!)
      .complete();

    return this.signAndSubmit(unsignedTx);
  }

  // ─── Query operations ────────────────────────────────────────────────

  /**
   * Check if an address is a registered issuer by querying UTxOs
   * at the registry script address.
   */
  async isValidIssuer(adminKeyHash: string): Promise<boolean> {
    const utxos = await this.queryRegistryUtxos();
    return utxos.some(
      (utxo) => utxo.type === "issuer" && utxo.adminVkh === adminKeyHash && utxo.isActive
    );
  }

  /**
   * Check if a schema ID is registered.
   */
  async isValidSchema(schemaId: string): Promise<boolean> {
    const utxos = await this.queryRegistryUtxos();
    return utxos.some(
      (utxo) => utxo.type === "schema" && utxo.schemaId === schemaId
    );
  }

  // ─── Internal helpers ────────────────────────────────────────────────

  private ensureConnected(): asserts this is { wallet: MeshBrowserWallet; walletAddress: string; walletKeyHash: string } {
    if (!this.wallet || !this.walletAddress || !this.walletKeyHash) {
      throw new Error(
        "No wallet connected. Call cardano.connect('lace') first."
      );
    }
  }

  private async signAndSubmit(unsignedTx: string): Promise<CardanoTxResult> {
    const signedTx = await this.wallet!.signTx(unsignedTx, true);
    const txHash = await this.wallet!.submitTx(signedTx);
    return { txHash, confirmed: false };
  }

  private getRegistryAddress(): string {
    // In a real deployment, derive the script address from the script hash
    // and the network ID. For now, return a placeholder that will be
    // replaced when integrated with the deployed registry.
    const networkPrefix = this.config.networkId === 0 ? "addr_test1" : "addr1";
    return `${networkPrefix}:registry:${this.config.registryScriptHash}`;
  }

  private addressToKeyHash(address: string): string {
    // Derive a verification key hash from the address.
    // In production, this extracts the payment key hash from the bech32 address.
    // For now, use a deterministic hash.
    return createHash("sha256").update(address).digest("hex").slice(0, 56);
  }

  private buildIssuerDatum(params: RegisterIssuerParams): string {
    // Serialize as a Plutus datum (CBOR).
    // In production, use MeshJS's data serialization utilities.
    // For now, return a JSON-encoded representation that will be
    // replaced with proper CBOR when MeshJS datum builders are integrated.
    return JSON.stringify({
      constructor: 0,
      fields: [
        { bytes: Buffer.from(params.orgName).toString("hex") },
        { constructor: orgTypeIndex(params.orgType), fields: [] },
        { bytes: this.walletKeyHash },
        { list: params.schemas.map((s) => ({ bytes: Buffer.from(s).toString("hex") })) },
        { constructor: 1, fields: [] }, // is_active = True
      ],
    });
  }

  private buildSchemaDatum(params: RegisterSchemaParams): string {
    return JSON.stringify({
      constructor: 0,
      fields: [
        { bytes: Buffer.from(params.schemaId).toString("hex") },
        { bytes: this.walletKeyHash },
        { list: (params.requiredFields).map((f) => ({ bytes: Buffer.from(f).toString("hex") })) },
        { list: (params.optionalFields ?? []).map((f) => ({ bytes: Buffer.from(f).toString("hex") })) },
        { list: (params.disclosableFields ?? []).map((f) => ({ bytes: Buffer.from(f).toString("hex") })) },
      ],
    });
  }

  private buildRevocationDatum(params: PublishRevocationParams): string {
    const nowSlot = Math.floor(Date.now() / 1000); // approximate
    return JSON.stringify({
      constructor: 0,
      fields: [
        { bytes: params.credentialHash },
        { bytes: params.revocationAnchor },
        { bytes: this.walletKeyHash },
        { int: nowSlot },
      ],
    });
  }

  private async queryRegistryUtxos(): Promise<RegistryUtxo[]> {
    const url = `${this.config.blockfrostUrl}/addresses/${this.getRegistryAddress()}/utxos`;
    const res = await fetch(url, {
      headers: { project_id: this.config.blockfrostProjectId },
    });

    if (!res.ok) {
      if (res.status === 404) return []; // No UTxOs at this address
      throw new Error(`Blockfrost query failed: ${res.status} ${res.statusText}`);
    }

    const utxos = (await res.json()) as BlockfrostUtxo[];
    return utxos
      .map((u) => this.parseRegistryUtxo(u))
      .filter((u): u is RegistryUtxo => u !== null);
  }

  private parseRegistryUtxo(utxo: BlockfrostUtxo): RegistryUtxo | null {
    if (!utxo.inline_datum) return null;

    try {
      const datum = JSON.parse(utxo.inline_datum);
      // Differentiate by number of fields
      if (datum.fields?.length === 5 && typeof datum.fields[2]?.bytes === "string") {
        // Could be IssuerDatum or SchemaDatum
        if (datum.fields[4]?.constructor !== undefined) {
          // IssuerDatum has is_active as last field (constructor 0=False, 1=True)
          return {
            type: "issuer",
            adminVkh: datum.fields[2].bytes,
            isActive: datum.fields[4].constructor === 1,
          };
        }
        // SchemaDatum
        const schemaBytes = datum.fields[0]?.bytes;
        return {
          type: "schema",
          schemaId: schemaBytes ? Buffer.from(schemaBytes, "hex").toString() : "",
        };
      }
      if (datum.fields?.length === 4) {
        // RevocationDatum
        return {
          type: "revocation",
          credentialHash: datum.fields[0]?.bytes ?? "",
        };
      }
    } catch {
      // Unparseable datum — skip
    }
    return null;
  }
}

// ─── Internal types ──────────────────────────────────────────────────────────

type RegistryUtxo =
  | { type: "issuer"; adminVkh: string; isActive: boolean }
  | { type: "schema"; schemaId: string }
  | { type: "revocation"; credentialHash: string };

interface BlockfrostUtxo {
  tx_hash: string;
  output_index: number;
  amount: { unit: string; quantity: string }[];
  inline_datum: string | null;
}

function orgTypeIndex(orgType: string): number {
  const types: Record<string, number> = {
    DAO: 0, Club: 1, Hospital: 2, University: 3,
    Corp: 4, Cooperative: 5, Government: 6, Other: 7,
  };
  return types[orgType] ?? 7;
}
