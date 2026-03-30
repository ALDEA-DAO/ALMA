# Umbra Protocol

Privacy-first soulbound credentials for Cardano + Midnight. Issue, claim, and verify non-transferable credentials with zero-knowledge proofs — proving membership without revealing identity.

By [AdaSouls Labs](https://github.com/adasouls-labs).

---

## What is Umbra?

Umbra is an open protocol for **soulbound credentials** — non-transferable digital credentials that prove membership, certification, or access rights without exposing the holder's identity.

It runs on two blockchain layers:

- **Midnight** (private) — Credential state, ZK proof generation, selective disclosure. The holder's wallet address never leaves the contract.
- **Cardano** (public) — Organization registry, schema registry, revocation anchors. Everything that needs to be publicly verifiable.

Any organization can use Umbra to issue credentials to their members. A DAO, a university, a hospital, a club — each deploys their own instance using the SDK.

## Quick Start

### Install

```bash
npm install @adasouls/soulbound-sdk
```

### Issue a credential

```typescript
import { SoulboundIssuer, MockProvider } from "@adasouls/soulbound-sdk";

// Define your organization
const myOrg = {
  orgId: "your-cardano-policy-id",
  orgName: "My DAO",
  orgType: "DAO",
  publicKey: "ed25519-pubkey",
};

// Create an issuer (use MockProvider for development, MidnightProvider for production)
const provider = new MockProvider();
const issuer = new SoulboundIssuer(myOrg, provider);

// Issue an access credential to a member
const credentialId = await issuer.emit({
  schema: "soulbound:v1:access",
  subject: {
    walletAddress: "addr1_member_wallet...",
    resourceId: "my-app:main-gate",
    accessLevel: "MEMBER",
  },
});
```

### Claim a credential (holder side)

```typescript
import { SoulboundHolder } from "@adasouls/soulbound-sdk";

const holder = new SoulboundHolder(walletAddress, provider);

// See what's waiting for me
const pending = await holder.listPending();

// Claim all pending credentials
await holder.claimAll();

// Generate a ZK proof to access a resource (without revealing my identity)
const proof = await holder.generateProof(credentialId, "my-app:main-gate");
```

### Verify access (application side)

```typescript
import { SoulboundVerifier } from "@adasouls/soulbound-sdk";

const verifier = new SoulboundVerifier(provider);

// Option 1: Check access directly (when you control the session)
const { hasAccess, isTrial, accessLevel } = await verifier.checkAccess(
  walletAddress,
  { resourceId: "my-app:main-gate" }
);

// Option 2: Verify a ZK proof (when the holder presents a proof)
const result = await verifier.verifyProof(proof);
if (result.isValid) allowEntry();
```

## How to create credentials for your project

Umbra is a protocol, not a product. You use the SDK to build your own credential system. Here's how:

### 1. Define your organization

Every issuer is an organization registered on-chain with a unique PolicyId.

```typescript
const myOrg = {
  orgId: "your-unique-policy-id",
  orgName: "University of Buenos Aires",
  orgType: "UNIVERSITY",   // DAO | CLUB | HOSPITAL | UNIVERSITY | CORP | COOPERATIVE | GOVERNMENT | OTHER
  publicKey: "your-ed25519-public-key",
};
```

### 2. Choose a schema

Umbra ships with 4 standard schemas:

| Schema | Use case | Required fields |
|--------|----------|----------------|
| `soulbound:v1:membership` | Club/DAO membership | walletAddress |
| `soulbound:v1:certificate` | Diplomas, achievements | walletAddress, achievementName |
| `soulbound:v1:professional` | Licenses, certifications | walletAddress, professionCode, licenseNumber |
| `soulbound:v1:access` | Platform/service access | walletAddress, resourceId |

### 3. Issue credentials to your members

```typescript
// Membership credential (never expires)
await issuer.emit({
  schema: "soulbound:v1:membership",
  subject: { walletAddress: memberWallet, tier: "FOUNDING_MEMBER" },
});

// Professional credential
await issuer.emit({
  schema: "soulbound:v1:professional",
  subject: {
    walletAddress: doctorWallet,
    professionCode: "MD",
    licenseNumber: "LIC-2024-0001",
    specialty: "Cardiology",
  },
});

// Time-limited trial access
await issuer.emitTrial(playerWallet, "my-game:main", 7); // 7-day trial
```

### 4. Gate your application

```typescript
const { hasAccess, isTrial, expiresAt } = await verifier.checkAccess(
  walletAddress,
  { resourceId: "my-game:main" }
);

if (!hasAccess) return showSignUpPage();
if (isTrial) showTrialBanner({ daysLeft: daysUntil(expiresAt) });
startApp();
```

### 5. Revoke when needed

```typescript
await issuer.revoke(credentialId);
// The credential is immediately invalid. A revocation anchor is published
// on Cardano — publicly verifiable, but the holder's identity stays hidden.
```

## Privacy Model

This is what makes Umbra different from regular NFTs or tokens:

| What the verifier sees | What stays hidden |
|------------------------|-------------------|
| Valid credential exists for this org | Holder's wallet address |
| Credential is not expired or revoked | Holder's name or identity |
| Fields the holder chose to disclose | Other credentials the holder has |
| | Transaction history |

The holder controls what to reveal via **selective disclosure**:

```typescript
// Reveal only that I belong to this org — nothing else
const proof = await holder.generateProof(credId, "resource", ["orgId"]);

// Reveal my access level too
const proof = await holder.generateProof(credId, "resource", ["orgId", "accessLevel"]);

// Reveal nothing — just prove I have a valid credential
const proof = await holder.generateProof(credId, "resource", []);
```

## Providers

The SDK uses a provider abstraction. Swap providers without changing application code:

| Provider | Use case | Blockchain |
|----------|----------|------------|
| `MockProvider` | Development, testing, demos | None (in-memory) |
| `MidnightProvider` | Production ZK credentials | Midnight |
| `CardanoProvider` | Registry operations | Cardano |

```typescript
// Development
const provider = new MockProvider();

// Production
const provider = new MidnightProvider({
  nodeUrl: "ws://localhost:9944",
  proofServerUrl: "http://localhost:6300",
  contractAddress: "midnight:contract:...",
});
```

## Project Structure

```
umbra-protocol/
├── contracts/
│   ├── midnight/          # ZK contract (Compact)
│   │   └── SoulboundCredentialContract.compact
│   └── cardano/           # Registry contract (Aiken)
│       ├── validators/registry.ak
│       └── lib/soulbound/
├── packages/
│   ├── core/              # @adasouls/soulbound-core — types, schemas, validators
│   └── sdk/               # @adasouls/soulbound-sdk — issuer, holder, verifier
├── scripts/
│   └── deploy-devnet.ts   # Deploy to local devnet
├── docs/                  # Architecture, PRD, roadmap
└── docker-compose.yml     # Midnight node + proof server
```

## Development

### Prerequisites

- Node.js >= 20
- Docker (for Midnight devnet)
- [Aiken](https://aiken-lang.org) v1.1.7+ (for Cardano contracts)

### Setup

```bash
git clone https://github.com/adasouls-labs/umbra-protocol.git
cd umbra-protocol
npm install
```

### Run tests

```bash
# TypeScript tests (SDK + schemas + contract logic)
npm test

# Aiken tests (Cardano registry)
npm run check:cardano
```

### Start local devnet

```bash
npm run start-devenv    # Start Midnight node + proof server
npm run deploy:devnet   # Deploy contracts and save addresses to config/devnet.json
```

### Build

```bash
npm run build                    # Build TypeScript packages
npm run build:cardano            # Build Aiken contracts
npm run compile:contracts        # Compile Compact contracts
```

## Real-world Example: ALMA by ALDEA

[ALMA](https://github.com/aldea-dao/alma) is the first deployment of Umbra Protocol, built for [ALDEA World](https://aldea.world) — a DAO-governed virtual world where access is controlled by soulbound credentials.

ALMA uses Umbra to:
- Issue membership credentials to ALDEA members
- Gate access to ALDEA World via ZK proofs
- Allow public minting of new memberships (paid in ADA)
- Run a genesis airdrop to founding members

If you're building something similar, ALMA is a great reference for how to build on top of Umbra.

## License

Apache-2.0
