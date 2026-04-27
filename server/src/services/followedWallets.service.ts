import { followedWallets, users } from "@sv/db/schema.js";
import { db } from "@sv/db/index.js";
import { and, asc, eq, isNotNull } from "drizzle-orm";

const DEFAULT_HELIUS_WEBHOOK_ID = "2b2123ed-ae76-4fcc-beaa-25e0fb3f5c48";
const HELIUS_API_BASE =
  process.env.HELIUS_API_BASE || "https://api-mainnet.helius-rpc.com";
const HELIUS_WEBHOOK_ID =
  process.env.HELIUS_WEBHOOK_ID || DEFAULT_HELIUS_WEBHOOK_ID;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
const WEBHOOK_PUBLIC_URL = process.env.WEBHOOK_PUBLIC_URL || "";
const WEBHOOK_AUTH_HEADER = "thisisphuonglekey";

function heliusWebhookUrl(): string {
  return `${HELIUS_API_BASE}/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${encodeURIComponent(HELIUS_API_KEY)}`;
}

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
): Promise<boolean> {
  const deleted = await db
    .delete(followedWallets)
    .where(and(eq(followedWallets.id, id), eq(followedWallets.userId, userId)))
    .returning({ id: followedWallets.id });
  return deleted.length > 0;
}

// ── Global address list (for Helius sync) ──────────────────────────

export async function getFollowedWalletAddresses(): Promise<string[]> {
  const rows = await db
    .select({ address: followedWallets.address })
    .from(followedWallets);
  return [...new Set(rows.map((r) => r.address))];
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

// ── User settings ──────────────────────────────────────────────────

export async function getUserDiscordUrl(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ url: users.discordWebhookUrl })
    .from(users)
    .where(eq(users.id, userId));
  return row?.url ?? null;
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

// ── Helius webhook sync ────────────────────────────────────────────

export type HeliusSyncResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

export async function syncHeliusWebhookAccountAddresses(): Promise<HeliusSyncResult> {
  if (!HELIUS_API_KEY) {
    return { ok: false, error: "HELIUS_API_KEY is not set" };
  }
  if (!WEBHOOK_PUBLIC_URL) {
    return { ok: false, error: "WEBHOOK_PUBLIC_URL is not set" };
  }

  const accountAddresses = await getFollowedWalletAddresses();
  const url = heliusWebhookUrl();

  const baseBody: Record<string, unknown> = {
    webhookURL: WEBHOOK_PUBLIC_URL,
    transactionTypes: ["ANY"],
    accountAddresses,
    webhookType: "enhanced",
    authHeader: WEBHOOK_AUTH_HEADER,
  };

  try {
    const getResp = await fetch(url, { method: "GET" });
    if (getResp.ok) {
      const existing = (await getResp.json()) as {
        encoding?: string;
        txnStatus?: string;
      };
      if (existing.encoding) baseBody.encoding = existing.encoding;
      if (existing.txnStatus) baseBody.txnStatus = existing.txnStatus;
    }
  } catch {
    // ignore GET failures
  }

  try {
    const putResp = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseBody),
    });
    if (!putResp.ok) {
      const text = await putResp.text();
      return {
        ok: false,
        status: putResp.status,
        error: text || `Helius PUT failed with status ${putResp.status}`,
      };
    }
    return { ok: true, status: putResp.status };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/** Postgres unique_violation (direct or wrapped by postgres.js) */
export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code === "23505") return true;
  const cause = (error as { cause?: { code?: string } })?.cause;
  return cause?.code === "23505";
}
