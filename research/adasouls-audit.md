# Audit: AdaSouls/Cardano-Soulbound
### Referencia: https://github.com/AdaSouls/Cardano-Soulbound
### Fecha: 2026-03-23

---

## 1. Qué está construido

### Contratos on-chain (Aiken)

**`validators/soulbound.ak`** — Dos validators:

- **`mint` (parameterizado)**: Recibe `MintParams` (policy + script). Valida que los tokens van a la dirección de locking y que la policy se cumple. Delega en `mint_validator` de la librería.
- **`redeem` (sin parámetros)**: Maneja dos casos via redeemer:
  - `ClaimToken` → verifica que el beneficiario firma la tx y actualiza el datum de "Issued" a "Claimed"
  - `BurnToken` → verifica que la policy de burn se cumple

**`lib/soulbound/types.ak`** — Tipos core:

```aiken
DatumData {
  policy_id: PolicyId,
  beneficiary: VerificationKeyHash,  -- hash del wallet, no la dirección pública
  status: ByteArray,                 -- "Issued" | "Claimed"
  metadata: Metadata,
}

MintParams {
  policy: Policy,
  script: ScriptType,
  nonce: ByteArray,                  -- garantiza PolicyId único por colección
}

-- Sistema de policies flexible
ScriptType = Sig | All | Any | AtLeast | After | Before
Policy = NativeScript(List<ScriptType>) | ...
```

**`lib/soulbound/functions.ak`** — Lógica de validación:

- `mint_validator`: Verifica que tokens van al script address, valida policy
- `redeem_validator`: Maneja claim y burn, verifica firma del beneficiario
- `check_policy`: Evalúa policies compuestas (All/Any/AtLeast/Sig/After/Before) — la función más reutilizable del repo

### Off-chain (TypeScript/Deno + Lucid + Blockfrost)

- **`src/mint.ts`**: Crea un soulbound token con datum `{beneficiary, status: "Issued"}` y lo deposita en el script address con 1 ADA.
- **`src/claim.ts`**: El beneficiario firma la tx, el datum se actualiza a `{status: "Claimed"}`, el token sigue en el script address.
- **`src/burn.ts`**: Quema el token cuando la policy lo permite.
- **`generate-credentials.ts`**: Genera wallet keys para testnet.

### Stack tecnológico actual
| Componente | Tecnología |
|---|---|
| Contratos | Aiken v1.7.0 (stdlib) |
| Off-chain runtime | Deno |
| Tx building | Lucid (versión antigua) |
| Blockchain API | Blockfrost (Preview testnet) |
| Red de despliegue | Cardano Preview testnet |

---

## 2. Qué es reutilizable para ALMA

### Reutilizar directamente

**`check_policy` (functions.ak)** — La función más valiosa del repo. Evalúa policies compuestas con All/Any/AtLeast/Sig/After/Before. Se puede portar directamente al contrato `ALMARegistry` de ALMA para validar policies de issuers.

**Concepto de `DatumData`** — La idea de guardar `{beneficiary_hash, status}` en el datum del UTxO es exactamente lo que ALMA necesita en la capa Cardano del `ALMARegistry`. El campo `beneficiary` como hash (no dirección pública) ya respeta privacidad.

**Patrón de parameterización por nonce** — `MintParams.nonce` garantiza que dos organizaciones con la misma policy generen PolicyIds distintos. ALMA reutiliza este patrón para garantizar un PolicyId único por organización emisora.

**Sistema de types de policy** — `ScriptType` (Sig/All/Any/AtLeast/After/Before) es un sistema flexible que ALMA puede adoptar para definir qué condiciones deben cumplirse para que una organización emita credenciales válidas.

**Flujo mint → claim como base conceptual** — El ciclo Issued → Claimed de AdaSouls mapea directamente al ciclo PENDING → CLAIMED de ALMA. La lógica de que "solo el beneficiario puede claim" es idéntica.

### Reutilizar con modificaciones

**`validators/soulbound.ak`** — El mint validator se puede adaptar para el contrato `public-mint.ak` de ALMA (Fase 2.5, TASK-025). Agregar: validación de pago en ADA, anti-double-mint por wallet, y emisión hacia el contrato Midnight en lugar de quedarse en Cardano.

**Estructura del datum** — Extender `DatumData` para incluir los campos de `ALMACredential`: `schemaId`, `issuerOrgId`, `expiresAt`, `revocationAnchor`. El campo `metadata` ya existe como extensión flexible.

---

## 3. Qué debe reescribirse para ALMA

### Nuevo contrato: `ALMARegistry` (Aiken)

AdaSouls no tiene concepto de registry. ALMA necesita un contrato Cardano separado que:
- Registre organizaciones emisoras con su PolicyId único
- Registre schemas de credenciales
- Publique anclas de revocación (sin revelar identidad del portador)
- Exponga `is_valid_issuer()` e `is_valid_schema()` para verificación

### Nuevo contrato: `ALMACredentialContract` (Compact/Midnight)

Todo el estado shielded de las credenciales individuales, la generación de ZK Proofs, y la lógica de membresía viven en Midnight. AdaSouls no tiene equivalente — es la pieza más nueva y compleja de ALMA.

### Nuevo contrato: `public-mint.ak` (Aiken, Fase 2.5)

El mint público de ALMA requiere validación de pago en ADA. AdaSouls no tiene este concepto — sus tokens son emitidos por el issuer sin que el portador pague. ALMA necesita un contrato nuevo que:
- Valide el UTxO de pago (monto correcto en ADA)
- Envíe los fondos a la tesorería de ALDEA
- Prevenga double-mint (1 wallet = 1 credencial)

### Runtime y librería off-chain

| Componente | AdaSouls | ALMA |
|---|---|---|
| Runtime | Deno | Node.js (compatibilidad npm) |
| Tx building | Lucid (deprecated) | MeshJS (más mantenido) |
| API | Blockfrost hardcoded | Provider abstracto (Blockfrost / Koios / custom) |
| Distribución | Scripts standalone | npm package `@alma-protocol/sdk` |
| Gestión de UTxOs | Manual (hardcoded en scripts) | Abstraída en el SDK |

**Lucid está siendo abandonado** — El repo de AdaSouls usa una versión antigua de Lucid. ALMA debe usar MeshJS desde el día uno para no heredar deuda técnica.

**UTxO management manual** — En AdaSouls, los scripts de claim y burn requieren actualizar a mano los UTxOs del output anterior. El SDK de ALMA debe abstraer completamente este proceso.

### Sistema de estados extendido

| AdaSouls | ALMA |
|---|---|
| `"Issued"` | `PENDING` |
| `"Claimed"` | `CLAIMED` |
| (no existe) | `REVOKED` |
| (no existe) | `EXPIRED` |

### Soporte multi-token y bulk

AdaSouls opera con 1 token por transacción. ALMA necesita operaciones bulk para el genesis airdrop (TASK-027) y el bulk mint del admin dashboard (TASK-035).

---

## 4. Riesgos y notas técnicas

**Riesgo 1 — Lucid deprecado**: No heredar la dependencia de Lucid. Usar MeshJS desde el inicio del SDK.

**Riesgo 2 — UTxO contention en bulk mint**: Al emitir muchas credenciales en paralelo, múltiples txs pueden intentar consumir los mismos UTxOs. El SDK debe implementar una cola de transacciones o un sistema de UTxO locking.

**Riesgo 3 — Datum inline vs hash**: AdaSouls usa inline datums (el datum completo está en la tx). Para ALMA en Cardano esto está bien para el Registry, pero en Midnight el estado shielded no puede ser inline. Diseñar la interfaz Cardano↔Midnight teniendo esto en cuenta.

**Nota — CIP-0888**: AdaSouls propuso su propio CIP (CIP-0888) para soulbound tokens en Cardano. El ALMA-CIP debe revisarlo y decidir si extenderlo o proponer uno nuevo. Dado que ALMA agrega la capa Midnight/ZK, probablemente es un CIP complementario (no reemplaza CIP-0888, sino que lo extiende con privacidad).

---

## 5. Conclusión

AdaSouls/Cardano-Soulbound es una base técnica sólida y directamente relevante para ALMA. El 30-40% del trabajo de contratos Cardano ya está resuelto conceptualmente. La pieza crítica nueva es todo lo que involucra Midnight (ZK Proofs, estado shielded, `ALMACredentialContract`), que no tiene precedente en AdaSouls.

**Prioridad de reutilización:**
1. `check_policy` → portar a `ALMARegistry`
2. Patrón datum `{beneficiary_hash, status}` → extender para `ALMACredential`
3. Patrón de parameterización con nonce → reutilizar para PolicyIds de issuers
4. Concepto mint→claim → base para el flujo PENDING→CLAIMED de ALMA
