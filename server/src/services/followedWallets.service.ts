import { followedWallets } from "@sv/db/schema.js";
import { db } from "@sv/db/index.js";
import { asc } from "drizzle-orm";

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

export async function listFollowedWallets() {
  return db
    .select()
    .from(followedWallets)
    .orderBy(asc(followedWallets.createdAt));
}

export async function getFollowedWalletAddresses(): Promise<string[]> {
  const rows = await db
    .select({ address: followedWallets.address })
    .from(followedWallets);
  return [...new Set(rows.map((r) => r.address))];
}

export async function addFollowedWallet(address: string, label?: string | null) {
  const [row] = await db
    .insert(followedWallets)
    .values({
      address,
      label: label?.trim() || null,
    })
    .returning();
  return row;
}

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
