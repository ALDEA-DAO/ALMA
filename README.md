# ALMA

Soulbound credentials for [ALDEA World](https://aldea.world), powered by [Umbra Protocol](https://github.com/adasouls-labs/umbra-protocol).

ALMA is ALDEA DAO's deployment of the Umbra soulbound credential system. It enables private, zero-knowledge membership verification for the ALDEA World ecosystem — members prove they belong without revealing who they are.

## How it works

1. **ALDEA issues** an ALMA credential to each member (or members mint their own by paying in ADA, fiat via Stripe/MercadoPago, or ALDEA tokens)
2. **Members claim** their credential by connecting their wallet
3. **ALDEA World verifies** access via ZK proof — confirms membership without seeing the wallet address

```
Member connects wallet
        │
        ▼
  Has ALMA credential? ──── No ──→ alma.aldea.world/mint
        │
       Yes
        │
        ▼
  Generate ZK Proof (private)
        │
        ▼
  Verify proof ──── Invalid ──→ Access denied
        │
      Valid
        │
        ▼
  Welcome to ALDEA World
```

## Project Structure

```
alma/
├── apps/
│   ├── web/                 # alma.aldea.world — landing, mint, claim flows
│   ├── api/                 # Backend API — payments, auth, minting, reconciliation
│   └── aldea-world-demo/    # ALDEA World interactive demo
├── packages/
│   ├── core/                # @adasouls/soulbound-core — type definitions and schema validators
│   ├── sdk/                 # @adasouls/soulbound-sdk — issuers, holders, verifiers
│   ├── auth/                # @aldea/auth — wallet-based authentication
│   └── react/               # @adasouls/soulbound-react — React components and hooks
├── contracts/
│   ├── cardano/             # Aiken smart contract for public minting (ADA payments)
│   └── midnight/            # Midnight ZK credential contract
├── scripts/
│   ├── genesis-airdrop.ts   # One-shot airdrop to founding members
│   ├── deploy-testnet.ts    # Deploy contracts to testnet
│   └── deploy-devnet.ts     # Deploy contracts to devnet
├── config/
│   └── aldea.ts             # ALDEA-specific configuration (org, resources, pricing)
├── docs/                    # Architecture, protocol, and deployment docs
├── e2e/                     # End-to-end tests (Playwright)
├── research/                # Security audit reports
└── render.yaml              # Render deployment blueprint
```

## Setup

```bash
git clone https://github.com/aldea-dao/alma.git
cd alma
pnpm install
```

### Run the API locally

```bash
cp apps/api/.env.example apps/api/.env
# Fill in the environment variables
pnpm api:dev
```

### Run the web app

```bash
pnpm web:dev
```

## Genesis Airdrop

Issue credentials to all existing ALDEA members:

```bash
# Preview what would happen
npm run airdrop:genesis:dry-run

# Execute the airdrop
npm run airdrop:genesis
```

Input: a `members.csv` file with one wallet address per line:

```csv
addr1_founding_member_1
addr1_founding_member_2,ALDEA-003
addr1_founding_member_3
```

## Configuration

All ALDEA-specific settings live in `config/aldea.ts`:

- **Organization**: ALDEA DAO PolicyId, name, public key
- **Resources**: `aldea-world:main-gate`, `aldea-world:docs`, `aldea-world:governance`
- **Mint price**: 35 ADA (configurable)
- **Access levels**: `MEMBER`, `TRIAL`, `FOUNDING_MEMBER`

Copy `.env.example` to `.env` and fill in the real values.

## Deployment

The API deploys to [Render](https://render.com) using the `render.yaml` blueprint. Environment variables (database URL, Blockfrost key, wallet seed, etc.) are configured in the Render dashboard.

## Built on Umbra Protocol

ALMA does not implement credential logic itself — it uses the [Umbra Protocol SDK](https://github.com/adasouls-labs/umbra-protocol):

```typescript
import { SoulboundIssuer, SoulboundVerifier } from "@adasouls/soulbound-sdk";
import { ALDEA_ORG, RESOURCES } from "./config/aldea";

const issuer = new SoulboundIssuer(ALDEA_ORG, provider);
await issuer.emit({
  schema: "soulbound:v1:access",
  subject: {
    walletAddress: memberWallet,
    resourceId: RESOURCES.MAIN_GATE,
    accessLevel: "MEMBER",
  },
});
```

Any organization can deploy their own version of this by following the [Umbra Protocol documentation](https://github.com/adasouls-labs/umbra-protocol#how-to-create-credentials-for-your-project).

## License

Apache-2.0
