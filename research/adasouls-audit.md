# Audit: AdaSouls/Cardano-Soulbound
### Reference: https://github.com/AdaSouls/Cardano-Soulbound
### Date: 2026-03-23

---

## 1. What is built

### On-chain contracts (Aiken)

**`validators/soulbound.ak`** — Two validators:

- **`mint` (parameterized)**: Receives `MintParams` (policy + script). Validates that tokens go to the locking address and that the policy is satisfied. Delegates to `mint_validator` from the library.
- **`redeem` (no parameters)**: Handles two cases via redeemer:
  - `ClaimToken` → verifies that the beneficiary signs the tx and updates the datum from "Issued" to "Claimed"
  - `BurnToken` → verifies that the burn policy is satisfied

**`lib/soulbound/types.ak`** — Core types:

```aiken
DatumData {
  policy_id: PolicyId,
  beneficiary: VerificationKeyHash,  -- wallet hash, not the public address
  status: ByteArray,                 -- "Issued" | "Claimed"
  metadata: Metadata,
}

MintParams {
  policy: Policy,
  script: ScriptType,
  nonce: ByteArray,                  -- ensures unique PolicyId per collection
}

-- Flexible policy system
ScriptType = Sig | All | Any | AtLeast | After | Before
Policy = NativeScript(List<ScriptType>) | ...
```

**`lib/soulbound/functions.ak`** — Validation logic:

- `mint_validator`: Verifies tokens go to the script address, validates policy
- `redeem_validator`: Handles claim and burn, verifies beneficiary signature
- `check_policy`: Evaluates composite policies (All/Any/AtLeast/Sig/After/Before) — the most reusable function in the repo

### Off-chain (TypeScript/Deno + Lucid + Blockfrost)

- **`src/mint.ts`**: Creates a soulbound token with datum `{beneficiary, status: "Issued"}` and deposits it at the script address with 1 ADA.
- **`src/claim.ts`**: The beneficiary signs the tx, the datum is updated to `{status: "Claimed"}`, the token remains at the script address.
- **`src/burn.ts`**: Burns the token when the policy allows it.
- **`generate-credentials.ts`**: Generates wallet keys for testnet.

### Current tech stack
| Component | Technology |
|---|---|
| Contracts | Aiken v1.7.0 (stdlib) |
| Off-chain runtime | Deno |
| Tx building | Lucid (old version) |
| Blockchain API | Blockfrost (Preview testnet) |
| Deployment network | Cardano Preview testnet |

---

## 2. What is reusable for ALMA

### Reuse directly

**`check_policy` (functions.ak)** — The most valuable function in the repo. Evaluates composite policies with All/Any/AtLeast/Sig/After/Before. Can be ported directly to ALMA's `ALMARegistry` contract to validate issuer policies.

**`DatumData` concept** — The idea of storing `{beneficiary_hash, status}` in the UTxO datum is exactly what ALMA needs in the Cardano layer of `ALMARegistry`. The `beneficiary` field as a hash (not public address) already respects privacy.

**Nonce parameterization pattern** — `MintParams.nonce` ensures that two organizations with the same policy generate distinct PolicyIds. ALMA reuses this pattern to guarantee a unique PolicyId per issuing organization.

**Policy type system** — `ScriptType` (Sig/All/Any/AtLeast/After/Before) is a flexible system that ALMA can adopt to define what conditions must be met for an organization to issue valid credentials.

**Mint → claim flow as conceptual base** — The Issued → Claimed cycle in AdaSouls maps directly to ALMA's PENDING → CLAIMED cycle. The logic that "only the beneficiary can claim" is identical.

### Reuse with modifications

**`validators/soulbound.ak`** — The mint validator can be adapted for ALMA's `public-mint.ak` contract (Phase 2.5, TASK-025). Add: ADA payment validation, per-wallet anti-double-mint, and emission to the Midnight contract instead of staying on Cardano.

**Datum structure** — Extend `DatumData` to include `ALMACredential` fields: `schemaId`, `issuerOrgId`, `expiresAt`, `revocationAnchor`. The `metadata` field already exists as a flexible extension.

---

## 3. What must be rewritten for ALMA

### New contract: `ALMARegistry` (Aiken)

AdaSouls has no concept of a registry. ALMA needs a separate Cardano contract that:
- Registers issuing organizations with their unique PolicyId
- Registers credential schemas
- Publishes revocation anchors (without revealing holder identity)
- Exposes `is_valid_issuer()` and `is_valid_schema()` for verification

### New contract: `ALMACredentialContract` (Compact/Midnight)

All shielded credential state, ZK Proof generation, and membership logic live on Midnight. AdaSouls has no equivalent — this is the newest and most complex piece of ALMA.

### New contract: `public-mint.ak` (Aiken, Phase 2.5)

ALMA's public mint requires ADA payment validation. AdaSouls has no such concept — its tokens are issued by the issuer without the holder paying. ALMA needs a new contract that:
- Validates the payment UTxO (correct ADA amount)
- Sends funds to the ALDEA treasury
- Prevents double-mint (1 wallet = 1 credential)

### Runtime and off-chain library

| Component | AdaSouls | ALMA |
|---|---|---|
| Runtime | Deno | Node.js (npm compatibility) |
| Tx building | Lucid (deprecated) | MeshJS (better maintained) |
| API | Blockfrost hardcoded | Abstract provider (Blockfrost / Koios / custom) |
| Distribution | Standalone scripts | npm package `@alma-protocol/sdk` |
| UTxO management | Manual (hardcoded in scripts) | Abstracted in the SDK |

**Lucid is being abandoned** — The AdaSouls repo uses an old version of Lucid. ALMA must use MeshJS from day one to avoid inheriting tech debt.

**Manual UTxO management** — In AdaSouls, claim and burn scripts require manually updating UTxOs from the previous output. ALMA's SDK must fully abstract this process.

### Extended state system

| AdaSouls | ALMA |
|---|---|
| `"Issued"` | `PENDING` |
| `"Claimed"` | `CLAIMED` |
| (does not exist) | `REVOKED` |
| (does not exist) | `EXPIRED` |

### Multi-token and bulk support

AdaSouls operates with 1 token per transaction. ALMA needs bulk operations for the genesis airdrop (TASK-027) and the admin dashboard bulk mint (TASK-035).

---

## 4. Risks and technical notes

**Risk 1 — Lucid deprecated**: Do not inherit the Lucid dependency. Use MeshJS from the SDK's inception.

**Risk 2 — UTxO contention in bulk mint**: When issuing many credentials in parallel, multiple txs may attempt to consume the same UTxOs. The SDK must implement a transaction queue or UTxO locking system.

**Risk 3 — Datum inline vs hash**: AdaSouls uses inline datums (the full datum is in the tx). For ALMA on Cardano this is fine for the Registry, but on Midnight the shielded state cannot be inline. Design the Cardano↔Midnight interface with this in mind.

**Note — CIP-0888**: AdaSouls proposed their own CIP (CIP-0888) for soulbound tokens on Cardano. The ALMA-CIP should review it and decide whether to extend or propose a new one. Given that ALMA adds the Midnight/ZK layer, it is probably a complementary CIP (does not replace CIP-0888, but extends it with privacy).

---

## 5. Conclusion

AdaSouls/Cardano-Soulbound is a solid technical base directly relevant to ALMA. 30-40% of the Cardano contract work is already conceptually solved. The critical new piece is everything involving Midnight (ZK Proofs, shielded state, `ALMACredentialContract`), which has no precedent in AdaSouls.

**Reuse priority:**
1. `check_policy` → port to `ALMARegistry`
2. Datum pattern `{beneficiary_hash, status}` → extend for `ALMACredential`
3. Nonce parameterization pattern → reuse for issuer PolicyIds
4. Mint → claim concept → base for ALMA's PENDING → CLAIMED flow
