import type { AlertRuleRow } from "@sv/db/schema.js";
import type { DeliveryResolution } from "@sv/services/alertRules.service.js";
import type { FollowedWalletDeliveryTarget } from "@sv/services/followedWallets.service.js";
import {
  extractInvolvedAddresses,
  processHeliusWebhookTransactions,
  resetProcessedWebhookSignaturesForTests,
  transactionMatchesActionType,
  type HeliusEnhancedTransaction,
  type WalletAlertPipelineDependencies,
} from "@sv/services/walletAlerts.service.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const WATCHED = "3nMNd89AxwHUa1AFvQGqohRkxFEQsTsgiEyEyqXFHyyH";
const OTHER = "ARu4n5mFdZogZAravu7CcizaojWnS6oqka37gdLT5SZn";
const DISCORD_URL = "https://discord.com/api/webhooks/test/token";
const USER_ID = "d231d7ca-7221-45f1-97d5-19badf25e762";

function makeRule(
  overrides: Partial<AlertRuleRow> = {},
): AlertRuleRow {
  const now = new Date();
  return {
    id: 1,
    userId: USER_ID,
    name: "Test rule",
    walletAddress: WATCHED,
    actionType: "ALL",
    minVolume: 0.0001,
    maxVolume: 100,
    volumeUnit: "SOL",
    triggerType: "ALWAYS",
    expiryDate: new Date(Date.now() + 86_400_000),
    oneShotFiredAt: null,
    useDefaultDelivery: true,
    discordWebhookOverride: null,
    emailOverride: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeFollowTarget(
  overrides: Partial<FollowedWalletDeliveryTarget> = {},
): FollowedWalletDeliveryTarget {
  return {
    userId: USER_ID,
    walletAddress: WATCHED,
    label: "bot",
    discordWebhookUrl: DISCORD_URL,
    registeredEmail: "alerts@example.com",
    emailAlertsEnabled: true,
    emailAlertsAddress: null,
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<WalletAlertPipelineDependencies> = {},
): WalletAlertPipelineDependencies {
  return {
    findActiveRulesForAddresses: vi.fn().mockResolvedValue([]),
    findFollowedWalletDeliveryTargetsForAddresses: vi.fn().mockResolvedValue([]),
    resolveRuleDelivery: vi.fn().mockResolvedValue({
      discordUrl: DISCORD_URL,
      email: null,
      skipReasons: ["email skipped: disabled"],
    } satisfies DeliveryResolution),
    markRuleOneShotFired: vi.fn().mockResolvedValue(undefined),
    sendDiscord: vi.fn().mockResolvedValue({ ok: true, status: 204 }),
    sendEmail: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function transferTx(signature = "transfer-signature"): HeliusEnhancedTransaction {
  return {
    signature,
    type: "TRANSFER",
    feePayer: WATCHED,
    timestamp: 1777958632,
    nativeTransfers: [
      {
        fromUserAccount: WATCHED,
        toUserAccount: OTHER,
        amount: 2_000_000,
      },
    ],
    tokenTransfers: [],
    accountData: [{ account: WATCHED }],
  };
}

function swapTx(signature = "swap-signature"): HeliusEnhancedTransaction {
  return {
    signature,
    type: "SWAP",
    feePayer: WATCHED,
    timestamp: 1777958632,
    tokenTransfers: [
      {
        fromUserAccount: WATCHED,
        toUserAccount: OTHER,
        tokenAmount: 1.2,
        mint: "So11111111111111111111111111111111111111112",
      },
    ],
    nativeTransfers: [],
    accountData: [{ account: WATCHED }],
  };
}

describe("wallet alert webhook processor", () => {
  beforeEach(() => {
    resetProcessedWebhookSignaturesForTests();
  });

  it("sends Discord for a Helius TRANSFER involving a followed wallet", async () => {
    const deps = makeDeps({
      findFollowedWalletDeliveryTargetsForAddresses: vi
        .fn()
        .mockResolvedValue([makeFollowTarget()]),
    });

    const summary = await processHeliusWebhookTransactions([transferTx()], {
      dependencies: deps,
      dedupe: false,
      log: false,
    });

    expect(deps.sendDiscord).toHaveBeenCalledTimes(1);
    expect(deps.sendEmail).toHaveBeenCalledTimes(1);
    expect(summary.followedWalletMatches).toBe(1);
    expect(summary.followedWalletDelivered).toBe(1);
  });

  it("sends Discord for a SWAP alert rule with actionType SWAP", async () => {
    const deps = makeDeps({
      findActiveRulesForAddresses: vi
        .fn()
        .mockResolvedValue([makeRule({ actionType: "SWAP" })]),
      resolveRuleDelivery: vi.fn().mockResolvedValue({
        discordUrl: DISCORD_URL,
        email: null,
        skipReasons: ["email skipped: disabled"],
      } satisfies DeliveryResolution),
    });

    const summary = await processHeliusWebhookTransactions([swapTx()], {
      dependencies: deps,
      dedupe: false,
      log: false,
    });

    expect(deps.sendDiscord).toHaveBeenCalledTimes(1);
    expect(summary.rulesMatched).toBe(1);
    expect(summary.rulesDelivered).toBe(1);
  });

  it("matches actionType ALL against SWAP and TRANSFER", () => {
    expect(transactionMatchesActionType("SWAP", "ALL")).toBe(true);
    expect(transactionMatchesActionType("TRANSFER", "ALL")).toBe(true);
    expect(transactionMatchesActionType("TOKEN_MINT", "ALL")).toBe(true);
    expect(transactionMatchesActionType("UNKNOWN", "ALL")).toBe(true);
  });

  it("does not send email when email alerts are disabled", async () => {
    const deps = makeDeps({
      findFollowedWalletDeliveryTargetsForAddresses: vi
        .fn()
        .mockResolvedValue([
          makeFollowTarget({
            discordWebhookUrl: null,
            emailAlertsEnabled: false,
          }),
        ]),
    });

    const summary = await processHeliusWebhookTransactions([transferTx()], {
      dependencies: deps,
      dedupe: false,
      log: false,
    });

    expect(deps.sendEmail).not.toHaveBeenCalled();
    expect(summary.events[0]?.deliveries[0]?.email.skippedReason).toBe(
      "email skipped: disabled",
    );
  });

  it("skips missing Discord but still sends email", async () => {
    const deps = makeDeps({
      findFollowedWalletDeliveryTargetsForAddresses: vi
        .fn()
        .mockResolvedValue([
          makeFollowTarget({
            discordWebhookUrl: null,
            emailAlertsEnabled: true,
          }),
        ]),
    });

    const summary = await processHeliusWebhookTransactions([transferTx()], {
      dependencies: deps,
      dedupe: false,
      log: false,
    });

    expect(deps.sendDiscord).not.toHaveBeenCalled();
    expect(deps.sendEmail).toHaveBeenCalledTimes(1);
    expect(summary.events[0]?.deliveries[0]?.discord.skippedReason).toBe(
      "discord skipped: missing webhook",
    );
    expect(summary.followedWalletDelivered).toBe(1);
  });

  it("dedupes duplicate signatures without blocking new events", async () => {
    const deps = makeDeps({
      findFollowedWalletDeliveryTargetsForAddresses: vi
        .fn()
        .mockResolvedValue([makeFollowTarget({ emailAlertsEnabled: false })]),
    });

    const summary = await processHeliusWebhookTransactions(
      [transferTx("sig-a"), transferTx("sig-a"), transferTx("sig-b")],
      {
        dependencies: deps,
        dedupe: true,
        log: false,
      },
    );

    expect(summary.duplicates).toBe(1);
    expect(summary.processed).toBe(2);
    expect(deps.sendDiscord).toHaveBeenCalledTimes(2);
  });

  it("extracts transactionEvents.swap addresses", () => {
    const tx: HeliusEnhancedTransaction = {
      signature: "swap-event-addresses",
      type: "SWAP",
      transactionEvents: {
        swap: {
          user: WATCHED,
          tokenInputs: [{ userAccount: WATCHED, tokenAccount: OTHER }],
        },
      },
    };

    expect(extractInvolvedAddresses(tx)).toEqual(
      expect.arrayContaining([WATCHED, OTHER]),
    );
  });

  it("dry-runs the real Helius SWAP fixture through matching and delivery", async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const fixturePath = path.resolve(
      __dirname,
      "../fixtures/helius-swap-followed-wallet.json",
    );
    const fixture = JSON.parse(
      await readFile(fixturePath, "utf8"),
    ) as HeliusEnhancedTransaction[];
    const deps = makeDeps({
      findActiveRulesForAddresses: vi
        .fn()
        .mockResolvedValue([makeRule({ actionType: "ALL" })]),
      findFollowedWalletDeliveryTargetsForAddresses: vi
        .fn()
        .mockResolvedValue([makeFollowTarget()]),
    });

    const summary = await processHeliusWebhookTransactions(fixture, {
      dependencies: deps,
      dryRun: true,
      dedupe: false,
      log: false,
    });

    expect(summary.rulesMatched).toBe(1);
    expect(summary.rulesDelivered).toBe(1);
    expect(summary.events[0]?.involvedAddresses).toContain(WATCHED);
    expect(deps.sendDiscord).not.toHaveBeenCalled();
  });
});
