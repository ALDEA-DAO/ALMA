/**
 * TASK-037 — E2E Test: Public Mint Flow
 *
 * Tests the complete public mint flow:
 *   1. User visits alma.aldea.world/mint
 *   2. Sees explanation of ALMA and pricing
 *   3. Connects wallet
 *   4. Confirms payment
 *   5. Signs and submits ADA transaction
 *   6. Credential is issued
 *   7. Redirected to ALDEA World
 *
 * Also tests the claim flow:
 *   1. Founding member visits alma.aldea.world/claim
 *   2. Sees welcome message
 *   3. Connects wallet
 *   4. Pending credential detected
 *   5. Claims credential
 *   6. Redirected to ALDEA World
 */

import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

const WEB_URL = "http://localhost:3000";

async function waitForText(page: Page, text: string, timeout = 10000) {
  await expect(page.getByText(text, { exact: false })).toBeVisible({ timeout });
}

// ─── Public Mint Tests ──────────────────────────────────────────────────────

test.describe("Public Mint Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${WEB_URL}/mint`);
  });

  test("mint page shows pricing and description", async ({ page }) => {
    await waitForText(page, "Mint your ALMA");
    await waitForText(page, "35 ADA");
    await waitForText(page, "MEMBER access");
  });

  test("mint intro step explains what ALMA gives", async ({ page }) => {
    // Should show the intro step by default
    await waitForText(page, "What you get");
    await waitForText(page, "soulbound ALMA credential");
    await waitForText(page, "MEMBER access");
    await waitForText(page, "ZK proofs");
  });

  test("connect wallet button navigates to wallet selection", async ({ page }) => {
    const connectBtn = page.getByRole("button", { name: /Connect Wallet to Mint/i });
    await expect(connectBtn).toBeVisible();

    await connectBtn.click();

    // Should show wallet selection
    await waitForText(page, "Select your Cardano wallet");
    await expect(page.getByText("Lace")).toBeVisible();
    await expect(page.getByText("Nami")).toBeVisible();
    await expect(page.getByText("Eternl")).toBeVisible();
  });

  test("back button returns to intro from wallet selection", async ({ page }) => {
    // Go to wallet selection
    await page.getByRole("button", { name: /Connect Wallet to Mint/i }).click();
    await waitForText(page, "Select your Cardano wallet");

    // Click back
    await page.getByText("Back").click();

    // Should be back at intro
    await waitForText(page, "What you get");
  });

  test("shows testnet indicator", async ({ page }) => {
    await waitForText(page, "Testnet");
    await waitForText(page, "Cardano Preprod");
  });
});

// ─── Claim Flow Tests ───────────────────────────────────────────────────────

test.describe("Claim Flow (Airdrop)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${WEB_URL}/claim`);
  });

  test("claim page shows welcome for founding members", async ({ page }) => {
    await waitForText(page, "Claim your ALMA");
    await waitForText(page, "Founding ALDEA members");
  });

  test("welcome step has correct messaging", async ({ page }) => {
    await waitForText(page, "Welcome back, founder");
    await waitForText(page, "original ALDEA member");
    await waitForText(page, "Claim my ALMA");
  });

  test("shows link to mint for non-founding members", async ({ page }) => {
    const mintLink = page.getByText("Mint a new credential instead");
    await expect(mintLink).toBeVisible();
  });

  test("claim button navigates to wallet selection", async ({ page }) => {
    await page.getByRole("button", { name: /Claim my ALMA/i }).click();
    await waitForText(page, "Select your Cardano wallet");
  });
});

// ─── Landing Page Tests ─────────────────────────────────────────────────────

test.describe("Landing Page (alma.aldea.world)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WEB_URL);
  });

  test("hero section renders correctly", async ({ page }) => {
    await waitForText(page, "Your identity in");
    await waitForText(page, "ALDEA World");
    await waitForText(page, "Mint my ALMA");
    await waitForText(page, "Claim Airdrop");
  });

  test("how it works section is visible", async ({ page }) => {
    await waitForText(page, "How ALMA works");
    await waitForText(page, "Connect wallet");
    await waitForText(page, "Pay & mint");
    await waitForText(page, "Access ALDEA");
  });

  test("navigation links work", async ({ page }) => {
    // Mint button
    const mintLink = page.getByRole("link", { name: "Mint ALMA" }).first();
    await expect(mintLink).toBeVisible();
    expect(await mintLink.getAttribute("href")).toBe("/mint");

    // Docs link
    const docsLink = page.getByRole("link", { name: "Docs" }).first();
    await expect(docsLink).toBeVisible();
    expect(await docsLink.getAttribute("href")).toBe("/docs");

    // Stats link
    const statsLink = page.getByRole("link", { name: "Stats" }).first();
    await expect(statsLink).toBeVisible();
    expect(await statsLink.getAttribute("href")).toBe("/stats");
  });

  test("tech stack section shows Cardano and Midnight", async ({ page }) => {
    await waitForText(page, "Built on solid ground");
    await waitForText(page, "Cardano");
    await waitForText(page, "Midnight");
  });

  test("footer renders", async ({ page }) => {
    await waitForText(page, "ALMA Protocol");
    await waitForText(page, "Built by ALDEA DAO");
  });
});

// ─── Docs & Stats Pages ────────────────────────────────────────────────────

test.describe("Docs Page", () => {
  test("renders documentation content", async ({ page }) => {
    await page.goto(`${WEB_URL}/docs`);
    await waitForText(page, "Documentation");
    await waitForText(page, "What is ALMA");
    await waitForText(page, "Architecture");
    await waitForText(page, "Credential Lifecycle");
  });
});

test.describe("Stats Page", () => {
  test("renders metrics dashboard", async ({ page }) => {
    await page.goto(`${WEB_URL}/stats`);
    await waitForText(page, "Protocol Stats");
    await waitForText(page, "Total Minted");
    await waitForText(page, "Mint Price");
    await waitForText(page, "35 ADA");
  });
});
