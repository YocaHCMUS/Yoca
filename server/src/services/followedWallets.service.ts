import { alertRules, followedWallets, users } from "@sv/db/schema.js";
import { db } from "@sv/db/index.js";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import {
  syncAllHeliusWebhookShards,
  type HeliusSyncResult,
} from "./heliusWebhookShards.service.js";

// ── Per-user CRUD ──────────────────────────────────────────────────

export async function listFollowedWallets(userId: string) {
  return db
    .select()
    .from(followedWallets)
    .where(eq(followedWallets.userId, userId))
    .orderBy(asc(followedWallets.createdAt));
}

export async function addFollowedWallet(
  userId: string,
  address: string,
  label?: string | null,
) {
  const [row] = await db
    .insert(followedWallets)
    .values({
      userId,
      address,
      label: label?.trim() || null,
    })
    .returning();
  return row;
}

export async function removeFollowedWallet(
  id: number,
  userId: string,
): Promise<{ id: number; address: string } | null> {
  const [deleted] = await db
    .delete(followedWallets)
    .where(and(eq(followedWallets.id, id), eq(followedWallets.userId, userId)))
    .returning({ id: followedWallets.id, address: followedWallets.address });
  return deleted ?? null;
}

// ── Global address list (for Helius sync) ──────────────────────────

export async function getFollowedWalletAddresses(): Promise<string[]> {
  const fw = await db
    .select({ address: followedWallets.address })
    .from(followedWallets);
  const ar = await db
    .select({ address: alertRules.walletAddress })
    .from(alertRules);
  return [...new Set([...fw.map((r) => r.address), ...ar.map((r) => r.address)])];
}

// ── Fan-out: Discord URLs for a given wallet address ───────────────

export async function getDiscordUrlsForAddress(
  address: string,
): Promise<string[]> {
  const rows = await db
    .select({ url: users.discordWebhookUrl })
    .from(users)
    .innerJoin(followedWallets, eq(users.id, followedWallets.userId))
    .where(
      and(
        eq(followedWallets.address, address),
        isNotNull(users.discordWebhookUrl),
      ),
    );
  return [...new Set(rows.map((r) => r.url).filter(Boolean) as string[])];
}

// ── Fan-out: Email addresses for a given wallet address ────────────

export async function getEmailRecipientsForAddress(
  address: string,
): Promise<string[]> {
  const rows = await db
    .select({
      email: users.email,
      override: users.emailAlertsAddress,
      enabled: users.emailAlertsEnabled,
    })
    .from(users)
    .innerJoin(followedWallets, eq(users.id, followedWallets.userId))
    .where(
      and(
        eq(followedWallets.address, address),
        eq(users.emailAlertsEnabled, true),
      ),
    );

  const recipients = rows
    .map((r) => (r.override?.trim() || r.email || "").trim())
    .filter((e): e is string => !!e && /.+@.+\..+/.test(e));
  return [...new Set(recipients)];
}

// ── User settings ──────────────────────────────────────────────────

export interface UserAlertSettings {
  discordWebhookUrl: string | null;
  registeredEmail: string | null;
  emailAlertsEnabled: boolean;
  emailAlertsAddress: string | null;
}

export async function getUserAlertSettings(
  userId: string,
): Promise<UserAlertSettings | null> {
  const [row] = await db
    .select({
      discordWebhookUrl: users.discordWebhookUrl,
      registeredEmail: users.email,
      emailAlertsEnabled: users.emailAlertsEnabled,
      emailAlertsAddress: users.emailAlertsAddress,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!row) return null;
  return {
    discordWebhookUrl: row.discordWebhookUrl ?? null,
    registeredEmail: row.registeredEmail ?? null,
    emailAlertsEnabled: Boolean(row.emailAlertsEnabled),
    emailAlertsAddress: row.emailAlertsAddress ?? null,
  };
}

export async function setUserDiscordUrl(
  userId: string,
  url: string | null,
): Promise<void> {
  await db
    .update(users)
    .set({ discordWebhookUrl: url || null })
    .where(eq(users.id, userId));
}

export async function setUserEmailAlertSettings(
  userId: string,
  input: { emailAlertsEnabled: boolean; emailAlertsAddress: string | null },
): Promise<void> {
  await db
    .update(users)
    .set({
      emailAlertsEnabled: input.emailAlertsEnabled,
      emailAlertsAddress: input.emailAlertsAddress || null,
    })
    .where(eq(users.id, userId));
}

// ── Helius webhook sync ────────────────────────────────────────────

export async function syncHeliusWebhookAccountAddresses(): Promise<HeliusSyncResult> {
  return syncAllHeliusWebhookShards();
}

/** Postgres unique_violation (direct or wrapped by postgres.js) */
export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code === "23505") return true;
  const cause = (error as { cause?: { code?: string } })?.cause;
  return cause?.code === "23505";
}
