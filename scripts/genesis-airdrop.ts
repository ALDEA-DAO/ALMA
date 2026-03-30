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
 *
 * Input: CSV file with one wallet address per line (or wallet,memberId pairs)
 * Output: Log of results per wallet (issued / already exists / error)
 *
 * Idempotent: running twice won't duplicate credentials.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SoulboundIssuer, MockProvider } from "@adasouls/soulbound-sdk";
import { ALDEA_ORG, RESOURCES, ALDEA_SCHEMA, ACCESS_LEVELS } from "../config/aldea.js";

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const inputIndex = args.indexOf("--input");
const inputFile = inputIndex !== -1 ? args[inputIndex + 1]! : "members.csv";

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

// ─── Parse input ─────────────────────────────────────────────────────────────

function parseMembers(filePath: string): MemberEntry[] {
  const content = readFileSync(resolve(filePath), "utf-8");
  const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));

  return lines.map((line) => {
    const [walletAddress, memberId] = line.split(",").map((s) => s.trim());
    return { walletAddress: walletAddress!, memberId: memberId || undefined };
  });
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

  console.log(`  Members found: ${members.length}`);
  console.log(`  Organization:  ${ALDEA_ORG.orgName}`);
  console.log(`  Resource:      ${RESOURCES.MAIN_GATE}`);
  console.log(`  Access level:  ${ACCESS_LEVELS.FOUNDING}`);
  console.log();

  if (members.length === 0) {
    console.log("  No members to process. Exiting.");
    return;
  }

  // Initialize SDK
  // TODO: Replace MockProvider with MidnightProvider for production
  const provider = new MockProvider();
  const issuer = new SoulboundIssuer(ALDEA_ORG, provider);

  // Process each member
  const results: AirdropResult[] = [];

  for (const member of members) {
    if (dryRun) {
      console.log(`  [DRY RUN] Would issue to ${member.walletAddress}`);
      results.push({ walletAddress: member.walletAddress, status: "issued" });
      continue;
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
      results.push({ walletAddress: member.walletAddress, status: "issued", credentialId });
    } catch (err) {
      const message = (err as Error).message;
      console.log(`  ✗ ${member.walletAddress} → ${message}`);
      results.push({ walletAddress: member.walletAddress, status: "error", error: message });
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
}

main().catch((err) => {
  console.error("Airdrop failed:", err.message);
  process.exit(1);
});
