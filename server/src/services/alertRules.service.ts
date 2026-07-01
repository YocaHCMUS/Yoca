import type { AlertRuleRow } from "@sv/db/schema.js";
import { alertRules } from "@sv/db/schema.js";
import { db } from "@sv/db/index.js";
import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";

import { getUserAlertSettings } from "./followedWallets.service.js";

export type NewAlertRuleInput = {
  name?: string | null;
  walletAddress: string;
  actionType: "SWAP" | "TRANSFER" | "ALL";
  minVolume: number;
  maxVolume?: number | null;
  volumeUnit: "USD" | "SOL";
  triggerType: "ONCE" | "ALWAYS";
  expiryDate: Date;
  useDefaultDelivery: boolean;
  discordWebhookOverride?: string | null;
  emailOverride?: string | null;
};

export type DeliveryResolution = {
  discordUrl: string | null;
  email: string | null;
  skipReasons: string[];
};

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Rules that are not expired and still eligible to fire (ONCE rules until first hit). */
export async function listActiveAlertRules(userId: string): Promise<AlertRuleRow[]> {
  const now = new Date();
  return db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.userId, userId), gt(alertRules.expiryDate, now)))
    .orderBy(asc(alertRules.createdAt));
}

export async function createAlertRule(
  userId: string,
  input: NewAlertRuleInput,
): Promise<AlertRuleRow> {
  const [row] = await db
    .insert(alertRules)
    .values({
      userId,
      name: input.name?.trim() || null,
      walletAddress: input.walletAddress.trim(),
      actionType: input.actionType,
      minVolume: input.minVolume,
      maxVolume: input.maxVolume ?? null,
      volumeUnit: input.volumeUnit,
      triggerType: input.triggerType,
      expiryDate: input.expiryDate,
      useDefaultDelivery: input.useDefaultDelivery,
      discordWebhookOverride: input.discordWebhookOverride?.trim() || null,
      emailOverride: input.emailOverride?.trim() || null,
    })
    .returning();
  if (!row) throw new Error("insert_failed");
  return row;
}

export async function deleteAlertRule(id: number, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, id), eq(alertRules.userId, userId)))
    .returning({ id: alertRules.id });
  return deleted.length > 0;
}

/**
 * Predicate filtering: candidate rules for webhook processing when any involved
 * address matches (Observer pattern — Helius is the observable stream).
 */
export async function findActiveRulesForAddresses(
  addresses: string[],
): Promise<AlertRuleRow[]> {
  const normalizedAddresses = new Set(
    addresses.map(normalizeAddress).filter(Boolean) as string[],
  );
  if (normalizedAddresses.size === 0) return [];
  const normalizedAddressList = [...normalizedAddresses];
  const now = new Date();
  const rows = await db
    .select()
    .from(alertRules)
    .where(
      and(
        inArray(sql<string>`trim(${alertRules.walletAddress})`, normalizedAddressList),
        gt(alertRules.expiryDate, now),
        or(
          eq(alertRules.triggerType, "ALWAYS"),
          and(eq(alertRules.triggerType, "ONCE"), isNull(alertRules.oneShotFiredAt)),
        ),
      ),
    );
  return rows.filter((rule) =>
    normalizedAddresses.has(normalizeAddress(rule.walletAddress) || ""),
  );
}

export async function markRuleOneShotFired(id: number): Promise<void> {
  await db
    .update(alertRules)
    .set({ oneShotFiredAt: new Date() })
    .where(eq(alertRules.id, id));
}

export async function resolveRuleDelivery(
  rule: AlertRuleRow,
): Promise<DeliveryResolution> {
  const skipReasons: string[] = [];
  if (rule.useDefaultDelivery) {
    const s = await getUserAlertSettings(rule.userId);
    if (!s) {
      return {
        discordUrl: null,
        email: null,
        skipReasons: [
          "discord skipped: missing webhook",
          "email skipped: no recipient",
          "delivery skipped: user settings not found",
        ],
      };
    }

    const discordUrl = s.discordWebhookUrl?.trim() || null;
    if (!discordUrl) skipReasons.push("discord skipped: missing webhook");

    let email: string | null = null;
    if (!s.emailAlertsEnabled) {
      skipReasons.push("email skipped: disabled");
    } else {
      email =
        (s.emailAlertsAddress?.trim() || s.registeredEmail || "").trim() ||
        null;
      if (!email) skipReasons.push("email skipped: no recipient");
    }

    return {
      discordUrl,
      email,
      skipReasons,
    };
  }
  const discordUrl = rule.discordWebhookOverride?.trim() || null;
  const email = rule.emailOverride?.trim() || null;
  if (!discordUrl) skipReasons.push("discord skipped: missing webhook");
  if (!email) skipReasons.push("email skipped: no recipient");
  return {
    discordUrl,
    email,
    skipReasons,
  };
}
