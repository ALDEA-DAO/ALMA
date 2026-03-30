#!/usr/bin/env npx tsx
/**
 * ALMA — Genesis Airdrop Script
 *
 * One-shot script to issue ALMA credentials to all existing ALDEA members.
 * Credentials are created in PENDING state — each member claims theirs
 * by connecting their wallet.
 *
 * Usage:
 *   npx tsx scripts/genesis-airdrop.ts                    # Execute airdrop
 *   npx tsx scripts/genesis-airdrop.ts --dry-run          # Preview without issuing
 *   npx tsx scripts/genesis-airdrop.ts --input members.csv # Custom input file
 *   npx tsx scripts/genesis-airdrop.ts --batch-size 50    # Custom batch size
 *   npx tsx scripts/genesis-airdrop.ts --output results.json # Save results to file
 *
 * Input: CSV file with one wallet address per line (or wallet,memberId pairs)
 * Output: Log of results per wallet (issued / already exists / error)
 *
 * Idempotent: running twice won't duplicate credentials. The script checks
 * for existing credentials before issuing.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SoulboundIssuer, SoulboundHolder, MockProvider } from "@adasouls/soulbound-sdk";
import { ALDEA_ORG, RESOURCES, ALDEA_SCHEMA, ACCESS_LEVELS } from "../config/aldea.js";

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const inputIndex = args.indexOf("--input");
const inputFile = inputIndex !== -1 ? args[inputIndex + 1]! : "members.csv";
const batchSizeIndex = args.indexOf("--batch-size");
const batchSize = batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1]!, 10) : 25;
const outputIndex = args.indexOf("--output");
const outputFile = outputIndex !== -1 ? args[outputIndex + 1]! : null;

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemberEntry {
  walletAddress: string;
  memberId?: string;
}

interface AirdropResult {
  walletAddress: string;
  status: "issued" | "skipped" | "error";
  credentialId?: string;
  error?: string;
}

// ─── State file for idempotency ──────────────────────────────────────────────

const STATE_FILE = resolve(".genesis-airdrop-state.json");

interface AirdropState {
  processedWallets: Record<string, { credentialId: string; processedAt: string }>;
}

function loadState(): AirdropState {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as AirdropState;
    } catch {
      // Corrupted state file — start fresh
    }
  }
  return { processedWallets: {} };
}

function saveState(state: AirdropState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Parse input ─────────────────────────────────────────────────────────────

function parseMembers(filePath: string): MemberEntry[] {
  const content = readFileSync(resolve(filePath), "utf-8");
  const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));

  return lines.map((line) => {
    const [walletAddress, memberId] = line.split(",").map((s) => s.trim());
    return { walletAddress: walletAddress!, memberId: memberId || undefined };
  });
}

// ─── Batch processing ────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   ALMA — Genesis Airdrop for ALDEA World    ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();

  if (dryRun) {
    console.log("  ** DRY RUN — no credentials will be issued **\n");
  }

  // Parse member list
  let members: MemberEntry[];
  try {
    members = parseMembers(inputFile);
  } catch (err) {
    console.error(`Failed to read ${inputFile}:`, (err as Error).message);
    console.error("Create a members.csv file with one wallet address per line.");
    process.exit(1);
  }

  // Deduplicate by wallet address
  const seen = new Set<string>();
  members = members.filter((m) => {
    if (seen.has(m.walletAddress)) return false;
    seen.add(m.walletAddress);
    return true;
  });

  console.log(`  Members found:  ${members.length}`);
  console.log(`  Organization:   ${ALDEA_ORG.orgName}`);
  console.log(`  Resource:       ${RESOURCES.MAIN_GATE}`);
  console.log(`  Access level:   ${ACCESS_LEVELS.FOUNDING}`);
  console.log(`  Batch size:     ${batchSize}`);
  console.log();

  if (members.length === 0) {
    console.log("  No members to process. Exiting.");
    return;
  }

  // Load idempotency state
  const state = loadState();
  const alreadyProcessed = Object.keys(state.processedWallets).length;
  if (alreadyProcessed > 0) {
    console.log(`  Previously processed: ${alreadyProcessed} wallets (will be skipped)`);
    console.log();
  }

  // Initialize SDK
  // TODO: Replace MockProvider with MidnightProvider for production
  const provider = new MockProvider();
  const issuer = new SoulboundIssuer(ALDEA_ORG, provider);

  // Process in batches
  const results: AirdropResult[] = [];
  const batches = chunk(members, batchSize);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]!;
    console.log(`  ── Batch ${batchIdx + 1}/${batches.length} (${batch.length} members) ──`);

    const batchPromises = batch.map(async (member): Promise<AirdropResult> => {
      // Idempotency check: skip if already processed
      const existing = state.processedWallets[member.walletAddress];
      if (existing) {
        console.log(`  ⊘ ${member.walletAddress} → already issued (${existing.credentialId})`);
        return { walletAddress: member.walletAddress, status: "skipped", credentialId: existing.credentialId };
      }

      // Additional check: query provider for existing credentials
      try {
        const holder = new SoulboundHolder(member.walletAddress, provider);
        const pending = await holder.listPending();
        const owned = await holder.listOwned();
        const allCreds = [...pending, ...owned];
        const existingCred = allCreds.find(
          ({ credential }) =>
            credential.issuer.orgId === ALDEA_ORG.orgId &&
            credential.subject.metadata?.["resourceId"] === RESOURCES.MAIN_GATE
        );

        if (existingCred) {
          console.log(`  ⊘ ${member.walletAddress} → credential exists (${existingCred.id})`);
          state.processedWallets[member.walletAddress] = {
            credentialId: existingCred.id,
            processedAt: new Date().toISOString(),
          };
          return { walletAddress: member.walletAddress, status: "skipped", credentialId: existingCred.id };
        }
      } catch {
        // Provider check failed — proceed with issuance attempt
      }

      if (dryRun) {
        console.log(`  [DRY RUN] Would issue to ${member.walletAddress}`);
        return { walletAddress: member.walletAddress, status: "issued" };
      }

      try {
        const credentialId = await issuer.emit({
          schema: ALDEA_SCHEMA,
          subject: {
            walletAddress: member.walletAddress,
            resourceId: RESOURCES.MAIN_GATE,
            accessLevel: ACCESS_LEVELS.FOUNDING,
            memberId: member.memberId,
          },
        });

        console.log(`  ✓ ${member.walletAddress} → ${credentialId}`);

        // Save to state for idempotency
        state.processedWallets[member.walletAddress] = {
          credentialId,
          processedAt: new Date().toISOString(),
        };

        return { walletAddress: member.walletAddress, status: "issued", credentialId };
      } catch (err) {
        const message = (err as Error).message;
        console.log(`  ✗ ${member.walletAddress} → ${message}`);
        return { walletAddress: member.walletAddress, status: "error", error: message };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Save state after each batch (crash recovery)
    if (!dryRun) {
      saveState(state);
    }
  }

  // Summary
  console.log();
  console.log("═══════════════════════════════════════════════");
  const issued = results.filter((r) => r.status === "issued").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;
  console.log(`  Issued:  ${issued}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
  console.log(`  Total:   ${members.length}`);
  console.log("═══════════════════════════════════════════════");

  // Save results to file if requested
  if (outputFile) {
    const report = {
      executedAt: new Date().toISOString(),
      dryRun,
      summary: { issued, skipped, errors, total: members.length },
      results,
    };
    writeFileSync(resolve(outputFile), JSON.stringify(report, null, 2));
    console.log(`\n  Results saved to ${outputFile}`);
  }

  if (errors > 0) {
    console.log(`\n  ⚠ ${errors} error(s) — re-run the script to retry failed wallets.`);
  }
}

main().catch((err) => {
  console.error("Airdrop failed:", err.message);
  process.exit(1);
});
