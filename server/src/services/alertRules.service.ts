import type { AlertRuleRow } from "@sv/db/schema.js";
import { alertRules } from "@sv/db/schema.js";
import { db } from "@sv/db/index.js";
import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";

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

export async function deleteAlertRule(
  id: number,
  userId: string,
): Promise<AlertRuleRow | null> {
  const [deleted] = await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, id), eq(alertRules.userId, userId)))
    .returning();
  return deleted ?? null;
}

/**
 * Predicate filtering: candidate rules for webhook processing when any involved
 * address matches (Observer pattern — Helius is the observable stream).
 */
export async function findActiveRulesForAddresses(
  addresses: string[],
): Promise<AlertRuleRow[]> {
  if (addresses.length === 0) return [];
  const now = new Date();
  return db
    .select()
    .from(alertRules)
    .where(
      and(
        inArray(alertRules.walletAddress, addresses),
        gt(alertRules.expiryDate, now),
        or(
          eq(alertRules.triggerType, "ALWAYS"),
          and(eq(alertRules.triggerType, "ONCE"), isNull(alertRules.oneShotFiredAt)),
        ),
      ),
    );
}

export async function markRuleOneShotFired(id: number): Promise<void> {
  await db
    .update(alertRules)
    .set({ oneShotFiredAt: new Date() })
    .where(eq(alertRules.id, id));
}

export async function resolveRuleDelivery(rule: AlertRuleRow): Promise<{
  discordUrl: string | null;
  email: string | null;
}> {
  if (rule.useDefaultDelivery) {
    const s = await getUserAlertSettings(rule.userId);
    if (!s) return { discordUrl: null, email: null };
    const email =
      s.emailAlertsEnabled
        ? (s.emailAlertsAddress?.trim() || s.registeredEmail || "").trim() || null
        : null;
    return {
      discordUrl: s.discordWebhookUrl?.trim() || null,
      email,
    };
  }
  return {
    discordUrl: rule.discordWebhookOverride?.trim() || null,
    email: rule.emailOverride?.trim() || null,
  };
}
