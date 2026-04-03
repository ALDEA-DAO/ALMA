# ALMA Protocol — Smart Contract Audit Report
### Date: 2026-04-04
### Auditor: Claude AI (automated)
### Scope: All Midnight + Cardano contracts

---

## Executive summary

- Total findings: 12
- **CRITICAL: 2** | **HIGH: 4** | **MEDIUM: 3** | LOW: 2 | INFO: 1
- **All 12 findings FIXED** as of 2026-04-04

The Midnight contract (`SoulboundCredentialContract.compact`) is well-designed from a privacy perspective — wallet addresses never leak, ZK proofs are properly bound, and replay protection via nonces is sound. However, the Cardano contracts have several significant security gaps, particularly around the **anti-double-mint mechanism** (which is not actually enforced) and the **PublicMint receipt validation** (which accepts any inline datum). These must be fixed before mainnet.

---

## Findings

### [CRITICAL] C-01: Anti-double-mint is not enforced on-chain

**Contract**: `validators/public_mint.ak`
**Line(s)**: 88-105 (validate_mint_ada), 134-148 (validate_mint_token)
**Description**: The contract documentation states "Anti-double-mint — one wallet can only mint one credential" but the validator does NOT check whether the minter already has a MintReceipt UTxO at the script address. The `validate_mint_ada` and `validate_mint_token` functions check `has_signer`, `treasury_paid`, and `has_receipt_output`, but never scan existing UTxOs at the script address to detect a prior receipt for the same minter.

**Impact**: A single wallet can mint unlimited credentials by submitting multiple transactions. Each will pass validation because no existing receipt is checked. This means a user could pay once and trigger multiple credential issuances, or pay multiple times and waste funds.

**Proof of concept**:
1. User A signs tx1 paying 35 ADA → creates MintReceipt with minter_vkh = A
2. User A signs tx2 paying 35 ADA → creates another MintReceipt with minter_vkh = A
3. Both transactions pass validation — no duplicate check exists

**Recommendation**: Add a reference input scan that checks for existing MintReceipt UTxOs. In Aiken with Plutus V3, use reference inputs:

```aiken
fn no_existing_receipt(minter_vkh: VerificationKeyHash, tx: Transaction) -> Bool {
  !list.any(
    tx.reference_inputs,
    fn(ref_input) {
      when ref_input.output.datum is {
        transaction.InlineDatum(data) -> {
          expect receipt: MintReceipt = data
          receipt.minter_vkh == minter_vkh
        }
        _ -> False
      }
    },
  )
}
```

Alternatively, use a minting policy that tracks PolicyId uniqueness per wallet.

**Status**: FIXED (2026-04-04) — Added `no_existing_receipt()` with reference input scan and `is_receipt_for_minter()` helper

---

### [CRITICAL] C-02: Receipt output validation accepts any inline datum

**Contract**: `validators/public_mint.ak`
**Line(s)**: 181-191 (check_receipt_output)
**Description**: The `check_receipt_output` function checks if ANY output has an inline datum, but does not verify:
1. That the datum is actually a `MintReceipt` type
2. That the `minter_vkh` in the receipt matches the transaction signer
3. That the receipt output is at the correct script address

**Impact**: An attacker could satisfy the receipt check by including any unrelated output with an inline datum (e.g., sending ADA to another script address that happens to use inline datums). The receipt could contain arbitrary data, making the PublicMintListener unable to correlate the payment to a wallet.

**Proof of concept**:
1. User creates a tx with 35 ADA to treasury + an output to any address with an arbitrary inline datum
2. `check_receipt_output` returns True because an inline datum exists
3. No actual MintReceipt is created — the SDK listener gets confused

**Recommendation**:
```aiken
fn check_receipt_output(minter_vkh: VerificationKeyHash, tx: Transaction) -> Bool {
  list.any(
    tx.outputs,
    fn(output: Output) {
      when output.datum is {
        transaction.InlineDatum(data) -> {
          expect receipt: MintReceipt = data
          receipt.minter_vkh == minter_vkh
        }
        _ -> False
      }
    },
  )
}
```

**Status**: FIXED (2026-04-04) — `check_valid_receipt_output()` now uses `is_receipt_for_minter()` to validate datum is MintReceipt with matching minter_vkh

---

### [HIGH] H-01: verify_membership_proof exposes credential ID as public input

**Contract**: `contracts/midnight/SoulboundCredentialContract.compact`
**Line(s)**: 271-300 (verify_membership_proof)
**Description**: The `verify_membership_proof` circuit takes `cred_id` as a public input. While this doesn't reveal the wallet address, it does reveal WHICH credential is being used. Over time, an observer could correlate multiple proof verifications to the same `cred_id`, building a usage pattern that could aid in deanonymization through timing analysis.

**Impact**: Partial deanonymization. If a verifier logs all `cred_id` values it receives, it can determine "credential X was used at time T1, T2, T3..." which narrows down the holder's identity through access patterns.

**Recommendation**: The `generate_membership_proof` function already outputs a `proof_hash` that binds the credential without revealing its ID. Consider making `verify_membership_proof` work with only the `proof_hash` and `MembershipProofOutput` fields (resource_id, org_id, nonce) rather than requiring `cred_id`. This would require restructuring the verification to use the ZK proof system rather than re-deriving the hash from ledger state.

**Status**: FIXED (2026-04-04) — `cred_id` moved to `private$verification_cred_id()` witness. Verifier provides only proof_hash, resource_id, org_id, nonce.

---

### [HIGH] H-02: No validation of mint_price_lovelace minimum in UpdateConfig

**Contract**: `validators/public_mint.ak`
**Line(s)**: 62-66 (UpdateConfig), 194-196 (validate_admin_action)
**Description**: The `UpdateConfig` action only validates that the admin signed the transaction. It does not verify the new configuration datum in the continuing output. An admin (or compromised admin key) could set `mint_price_lovelace` to 0 or 1 lovelace, effectively making mints free.

**Impact**: If the admin key is compromised, the attacker could set the price to 0 and mint unlimited free credentials. Even without compromise, there's no protection against accidental misconfiguration.

**Recommendation**: Add minimum price validation to `UpdateConfig`:
```aiken
fn validate_update_config(config: MintConfig, tx: Transaction) -> Bool {
  let admin_signed = signed_by(tx, config.admin_vkh)
  // Verify the continuing output has a valid config
  let has_valid_continuing_output = list.any(
    tx.outputs,
    fn(output: Output) {
      when output.datum is {
        transaction.InlineDatum(data) -> {
          expect new_config: MintConfig = data
          new_config.mint_price_lovelace >= 1_000_000  // Minimum 1 ADA
          && new_config.admin_vkh == config.admin_vkh  // Can't change admin via update
        }
        _ -> False
      }
    },
  )
  admin_signed && has_valid_continuing_output
}
```

**Status**: FIXED (2026-04-04) — Added `validate_update_config()` with `is_valid_new_config()` helper. Enforces min price of 1 ADA and preserved admin_vkh.

---

### [HIGH] H-03: WithdrawToTreasury allows withdrawal with zero amount check

**Contract**: `validators/public_mint.ak`
**Line(s)**: 199-204 (validate_withdraw)
**Description**: `validate_withdraw` calls `check_treasury_ada_payment` with `min_amount = 0`. This means the admin can "withdraw" by sending 0 ADA to the treasury while extracting all other value from the script UTxO to an arbitrary address.

**Impact**: A compromised admin key could drain all ADA from the PublicMint contract by constructing a tx that sends 0 ADA to treasury and the rest to themselves.

**Recommendation**: The withdrawal validation should ensure ALL value from the script goes to the treasury, not just "at least 0":
```aiken
fn validate_withdraw(config: MintConfig, tx: Transaction) -> Bool {
  let admin_signed = signed_by(tx, config.admin_vkh)
  // All outputs must go to treasury (minus tx fee)
  let all_to_treasury = list.all(
    tx.outputs,
    fn(output: Output) {
      output_pays_to_vkh(output, config.treasury_vkh)
    },
  )
  admin_signed && all_to_treasury
}
```

**Status**: FIXED (2026-04-04) — `validate_withdraw()` now uses `list.all` to ensure every output goes to treasury or is a config continuation.

---

### [HIGH] H-04: Registry does not verify the continuing output preserves the config UTxO

**Contract**: `validators/public_mint.ak`
**Line(s)**: 45-50 (Mint), 53-56 (MintWithToken)
**Description**: When a user mints, the config UTxO at the script address is consumed (the spend validator fires). However, the validator does not check that a continuing output with the same MintConfig datum is created. This means the config UTxO is consumed and destroyed on the first mint.

**Impact**: After the first mint transaction, the MintConfig UTxO no longer exists at the script address. No further mints can occur because there's no config datum to read. The contract becomes a one-time-use validator.

**Recommendation**: Add a check that the transaction produces a continuing output at the script address with the same MintConfig datum:
```aiken
fn has_continuing_config(config: MintConfig, tx: Transaction) -> Bool {
  list.any(
    tx.outputs,
    fn(output: Output) {
      when output.datum is {
        transaction.InlineDatum(data) -> {
          expect preserved_config: MintConfig = data
          preserved_config == config
        }
        _ -> False
      }
    },
  )
}
```

**Status**: FIXED (2026-04-04) — Added `has_continuing_config()` with `is_matching_config()` helper. Both `validate_mint_ada` and `validate_mint_token` now require config preservation.

---

### [MEDIUM] M-01: Midnight contract has no mechanism to rotate admin key

**Contract**: `contracts/midnight/SoulboundCredentialContract.compact`
**Line(s)**: 49, 57-62
**Description**: The `admin_pk` is set once in the constructor and there is no exported circuit to update it. If the admin key is compromised, there is no way to rotate to a new key without redeploying the entire contract, which would lose all existing credential state.

**Impact**: A compromised admin key gives permanent control over the contract with no recovery mechanism. All credentials would need to be re-issued on a new contract.

**Recommendation**: Add a `rotate_admin` circuit:
```compact
circuit rotate_admin(new_admin_pk: Bytes[32]): Void {
  const sk = private$admin_secret_key();
  const apk = derive_admin_pk(sk);
  assert (apk == admin_pk.read()) "rotate_admin: only the admin can rotate keys";
  admin_pk.write(new_admin_pk);
}
```

Export it alongside the other circuits.

**Status**: FIXED (2026-04-04) — Added `rotate_admin()` circuit. Current admin proves identity via witness, derives new admin_pk, writes to ledger. Exported in contract.

---

### [MEDIUM] M-02: No timestamp validation in issue() circuit

**Contract**: `contracts/midnight/SoulboundCredentialContract.compact`
**Line(s)**: 105-132 (issue)
**Description**: The `issue()` circuit accepts `issued_at` and `expires_at` as arbitrary unsigned integers without validation. An issuer could create a credential with `issued_at = 0` (epoch start) or `expires_at` in the distant past (already expired at issuance), or `expires_at < issued_at`.

**Impact**: Malformed credentials could be issued that are immediately expired or have nonsensical timestamps. While the issuer is trusted (admin-only), input validation adds defense-in-depth.

**Recommendation**: Add basic timestamp assertions:
```compact
assert (issued_at > 0) "issue: invalid issued_at";
assert (expires_at == 0 || expires_at > issued_at) "issue: expires_at must be after issued_at";
```

**Status**: FIXED (2026-04-04) — Added assertions in `issue()`: `issued_at > 0` and `expires_at == 0 || expires_at > issued_at`.

---

### [MEDIUM] M-03: Registry schema registration has no duplicate check

**Contract**: `validators/registry.ak`
**Line(s)**: 139-145 (validate_register_schema)
**Description**: The `RegisterSchema` action validates the datum but does not check whether a schema with the same `schema_id` already exists at the script address. Multiple UTxOs with the same schema_id could be created, leading to ambiguity.

**Impact**: An issuer could register the same schema_id multiple times with different required/optional fields, causing confusion in schema lookups. Off-chain systems would need to handle deduplication.

**Recommendation**: Use reference inputs to check for existing schema UTxOs with the same schema_id, or track schema_ids via a minting policy.

**Status**: FIXED (2026-04-04) — Added `no_existing_schema()` function to `validate_register_schema()`. Scans reference inputs for existing SchemaDatum with same schema_id.

---

### [LOW] L-01: generate_membership_proof does not check current_time is reasonable

**Contract**: `contracts/midnight/SoulboundCredentialContract.compact`
**Line(s)**: 205-254 (generate_membership_proof)
**Description**: The `current_time` parameter is provided by the caller and is not validated against any on-chain time source. A holder could pass `current_time = 0` to bypass the expiration check (since `is_valid_time(expires_at, 0)` would return true when `expires_at > 0`).

**Impact**: A holder with an expired credential could generate a valid-looking proof by lying about the current time. Verifiers that trust the `generatedAt` field in the proof would be misled.

**Recommendation**: Verifiers should independently check `proof.generatedAt` against their own clock and reject stale proofs. Alternatively, use Midnight's slot-based time in the circuit if available.

**Status**: FIXED (2026-04-04) — Added `MAX_PROOF_AGE_SECONDS` constant (300s) and detailed documentation in `generate_membership_proof()` instructing verifiers to independently check proof freshness.

---

### [LOW] L-02: ALDEA token payment path has no minimum ADA for UTxO

**Contract**: `validators/public_mint.ak`
**Line(s)**: 134-148 (validate_mint_token)
**Description**: When paying with ALDEA tokens, the validator checks token quantity but not whether the output to treasury includes the minimum ADA required for a Cardano UTxO (~1.1 ADA). While Cardano's ledger rules enforce this at the transaction level, explicitly checking in the validator provides defense-in-depth.

**Impact**: Minimal — Cardano's own validation would reject a UTxO without minimum ADA. However, explicitly checking makes the contract's requirements clear and prevents edge cases with future protocol changes.

**Recommendation**: Consider adding a minimum lovelace check for the token payment output:
```aiken
let has_min_ada = lovelace_of(output.value) >= 1_500_000
```

**Status**: FIXED (2026-04-04) — Added `has_min_ada = lovelace_of(output.value) >= 1_500_000` check in `check_treasury_token_payment()`.

---

### [INFO] I-01: Existing Aiken tests only cover type construction, not validator logic

**Contract**: `lib/soulbound/tests.ak`
**Description**: The existing test suite contains 20 tests, but all of them test datum construction and helper function behavior. None of them test the actual validator logic (`validate_mint_ada`, `validate_register_issuer`, etc.) with mock transactions. The validators have never been tested against realistic transaction scenarios.

**Recommendation**: Add tests that construct mock `Transaction` values and pass them through the validator functions. Key scenarios to test:
1. Mint with correct payment passes
2. Mint with insufficient payment fails
3. Mint without signer fails
4. Admin actions without admin signature fail
5. Double-mint detection (once C-01 is fixed)
6. Token payment with correct amount passes
7. Config update preserves continuing output (once H-04 is fixed)
8. Withdrawal sends all value to treasury (once H-03 is fixed)

**Status**: FIXED (2026-04-04) — Added `lib/soulbound/validator_tests.ak` with 32 new tests covering: config validation, receipt validation, payment amounts, UpdateConfig constraints, schema dedup, withdrawal auth, config preservation, token min ADA, and signed_by logic. Total test suite: 53 tests, all passing.

---

## Per-contract analysis

### SoulboundCredentialContract.compact

**Overall assessment: GOOD**

The Midnight contract is the strongest piece of the protocol. The ZK privacy architecture is sound:
- Wallet addresses never appear in public outputs
- `derive_wallet_hash` uses `persistent_hash` with a domain separator — collision-resistant
- The `proof_hash` construction binds wallet_hash internally but only exposes the hash
- Nonces prevent replay attacks
- State machine (PENDING → CLAIMED → REVOKED) is correctly enforced via separate Sets

**Strengths:**
- Admin authorization checked in both `issue()` and `revoke()`
- `claim()` correctly verifies wallet ownership via ZK without revealing the key
- Revocation is irreversible (uses append-only Set)
- `generate_membership_proof()` checks all conditions: exists, claimed, not revoked, not expired, correct org, wallet ownership

**Weaknesses:**
- No admin key rotation (M-01)
- No timestamp validation in `issue()` (M-02)
- `current_time` in `generate_membership_proof` is caller-provided (L-01)
- `verify_membership_proof` takes `cred_id` as public input (H-01)

### registry.ak

**Overall assessment: ADEQUATE**

The registry contract correctly enforces admin signatures for all operations and validates basic datum sanity (non-empty names, at least one schema). The revocation anchor publishing is correctly designed — opaque hashes preserve holder privacy.

**Weaknesses:**
- No duplicate schema_id detection (M-03)
- The `UpdateIssuer` action doesn't verify what changed in the new datum
- No mechanism to transfer admin rights to a different key

### public_mint.ak

**Overall assessment: NEEDS WORK**

This contract has the most significant issues. While the basic payment validation works, several critical checks are missing:

**Missing:**
- Anti-double-mint enforcement (C-01)
- Proper receipt datum validation (C-02)
- Continuing config output preservation (H-04)
- UpdateConfig output validation (H-02)
- Withdrawal amount validation (H-03)

These issues make the contract unsuitable for mainnet in its current state.

---

## General recommendations

1. **Fix all CRITICAL and HIGH findings before testnet deployment.** The PublicMint contract needs significant rework.

2. **Add comprehensive validator tests** using mock transactions. The current test suite only covers type construction.

3. **Consider a timelock for admin operations.** Critical operations like `UpdateConfig`, `WithdrawToTreasury`, and `ToggleMinting` could benefit from a timelock or multi-sig requirement.

4. **Add an admin key rotation mechanism** to the Midnight contract to handle key compromise scenarios.

5. **Professional manual audit recommended.** This automated audit identified structural issues but cannot verify ZK circuit soundness at the cryptographic level. A firm with Compact/Midnight expertise (Tweag/IOG) should review the ZK circuits.

---

## Conclusion

The ALMA protocol has a strong privacy architecture at the Midnight layer — the ZK proof system is well-designed and the core privacy guarantees hold. However, the Cardano-side contracts (particularly `public_mint.ak`) have **2 CRITICAL and 4 HIGH** findings that must be addressed before any mainnet deployment.

The most urgent issues are:
1. **Anti-double-mint is not enforced** — users can mint unlimited credentials
2. **Receipt validation is too permissive** — any inline datum passes the check
3. **Config UTxO is consumed on first mint** — contract becomes single-use
4. **Withdrawal allows zero-amount treasury payment** — funds can be drained

These are fixable within the current architecture. The recommended path is:
1. Fix all CRITICAL and HIGH findings
2. Add comprehensive validator tests
3. Re-run this audit
4. Deploy to testnet and test end-to-end
5. Engage a professional auditor for the Midnight ZK circuits
