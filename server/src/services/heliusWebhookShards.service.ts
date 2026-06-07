import { db } from "@sv/db/index.js";
import {
  alertRules,
  followedWallets,
  heliusWebhookShards,
  watchedAddresses,
  type HeliusWebhookShardRow,
} from "@sv/db/schema.js";
import { and, asc, count, eq, gt, isNull, or } from "drizzle-orm";

const DEFAULT_HELIUS_WEBHOOK_ID = "2b2123ed-ae76-4fcc-beaa-25e0fb3f5c48";
const DEFAULT_HELIUS_API_BASE = "https://api-mainnet.helius-rpc.com";
const DEFAULT_WEBHOOK_AUTH_SECRET = "thisisphuonglekey";
const HARD_HELIUS_MAX_ADDRESSES = 25;

export type HeliusShardSyncResult = {
  ok: boolean;
  status?: number;
  error?: string;
  shardId: number;
  heliusWebhookId: string;
  addressCount: number;
};

export type HeliusSyncResult = {
  ok: boolean;
  status?: number;
  error?: string;
  skipped?: boolean;
  shardId?: number;
  heliusWebhookId?: string;
  addressCount?: number;
  shards?: HeliusShardSyncResult[];
};

type ReconcileResult =
  | { ok: true; touchedShardIds: number[] }
  | { ok: false; error: string };

function normalizeAddress(address: string): string {
  return address.trim();
}

function heliusApiBase(): string {
  return process.env.HELIUS_API_BASE || DEFAULT_HELIUS_API_BASE;
}

function heliusApiKey(): string {
  return process.env.HELIUS_API_KEY || "";
}

function publicWebhookBaseUrl(): string {
  return process.env.WEBHOOK_PUBLIC_URL || "";
}

export function getHeliusWebhookAuthSecret(): string {
  return process.env.HELIUS_WEBHOOK_AUTH_KEY || DEFAULT_WEBHOOK_AUTH_SECRET;
}

function configuredWebhookIds(): string[] {
  const primary = process.env.HELIUS_WEBHOOK_ID || DEFAULT_HELIUS_WEBHOOK_ID;
  const additional = (process.env.HELIUS_WEBHOOK_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set([primary, ...additional].filter(Boolean))];
}

function heliusWebhookApiUrl(heliusWebhookId: string): string {
  return `${heliusApiBase()}/v0/webhooks/${heliusWebhookId}?api-key=${encodeURIComponent(heliusApiKey())}`;
}

function buildShardWebhookUrl(shardId: number): string {
  const base = publicWebhookBaseUrl();
  if (!base) return "";
  try {
    const url = new URL(base);
    url.searchParams.set("shardId", String(shardId));
    return url.toString();
  } catch {
    return `${base}${base.includes("?") ? "&" : "?"}shardId=${encodeURIComponent(String(shardId))}`;
  }
}

function shardCapacity(shard: Pick<HeliusWebhookShardRow, "maxAddresses">) {
  return Math.min(shard.maxAddresses || HARD_HELIUS_MAX_ADDRESSES, HARD_HELIUS_MAX_ADDRESSES);
}

async function countShardAddresses(shardId: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(watchedAddresses)
    .where(eq(watchedAddresses.heliusWebhookShardId, shardId));
  return Number(row?.value ?? 0);
}

async function refreshShardAddressCount(shardId: number): Promise<number> {
  const addressCount = await countShardAddresses(shardId);
  await db
    .update(heliusWebhookShards)
    .set({ addressCount })
    .where(eq(heliusWebhookShards.id, shardId));
  return addressCount;
}

async function listDesiredWatchedAddressRefCounts(): Promise<Map<string, number>> {
  const now = new Date();
  const [followRows, ruleRows] = await Promise.all([
    db
      .select({
        address: followedWallets.address,
        userId: followedWallets.userId,
      })
      .from(followedWallets),
    db
      .select({
        address: alertRules.walletAddress,
        userId: alertRules.userId,
      })
      .from(alertRules)
      .where(
        and(
          gt(alertRules.expiryDate, now),
          or(
            eq(alertRules.triggerType, "ALWAYS"),
            and(eq(alertRules.triggerType, "ONCE"), isNull(alertRules.oneShotFiredAt)),
          ),
        ),
      ),
  ]);

  const refsByAddress = new Map<string, Set<string>>();
  for (const row of [...followRows, ...ruleRows]) {
    const address = normalizeAddress(row.address);
    if (!address) continue;
    const refs = refsByAddress.get(address) ?? new Set<string>();
    refs.add(row.userId);
    refsByAddress.set(address, refs);
  }

  return new Map(
    [...refsByAddress.entries()].map(([address, refs]) => [address, refs.size]),
  );
}

async function loadShardRows(): Promise<HeliusWebhookShardRow[]> {
  return db
    .select()
    .from(heliusWebhookShards)
    .orderBy(asc(heliusWebhookShards.id));
}

async function createShardFromConfiguredWebhookId(
  usedWebhookIds: Set<string>,
): Promise<HeliusWebhookShardRow | null> {
  const nextWebhookId = configuredWebhookIds().find((id) => !usedWebhookIds.has(id));
  if (!nextWebhookId) {
    console.warn("[helius-shards] new shard required but no configured webhook id is available");
    return null;
  }

  const webhookUrl = publicWebhookBaseUrl();
  if (!webhookUrl) {
    console.warn("[helius-shards] cannot create shard because WEBHOOK_PUBLIC_URL is not set");
    throw new Error("WEBHOOK_PUBLIC_URL is not set");
  }

  console.log("[helius-shards] creating shard for configured Helius webhook", nextWebhookId);
  const [inserted] = await db
    .insert(heliusWebhookShards)
    .values({
      heliusWebhookId: nextWebhookId,
      authSecret: getHeliusWebhookAuthSecret(),
      webhookUrl,
      addressCount: 0,
      maxAddresses: HARD_HELIUS_MAX_ADDRESSES,
      status: "active",
    })
    .returning();

  const shardWebhookUrl = buildShardWebhookUrl(inserted.id);
  const [updated] = await db
    .update(heliusWebhookShards)
    .set({ webhookUrl: shardWebhookUrl })
    .where(eq(heliusWebhookShards.id, inserted.id))
    .returning();

  return updated ?? inserted;
}

async function getOrCreateShardWithCapacity(): Promise<HeliusWebhookShardRow | null> {
  let shards = await loadShardRows();
  for (const shard of shards) {
    const addressCount = await refreshShardAddressCount(shard.id);
    if (addressCount < shardCapacity(shard)) {
      return { ...shard, addressCount };
    }
  }

  const usedWebhookIds = new Set(shards.map((shard) => shard.heliusWebhookId));
  const created = await createShardFromConfiguredWebhookId(usedWebhookIds);
  if (created) return created;

  shards = await loadShardRows();
  for (const shard of shards) {
    const addressCount = await refreshShardAddressCount(shard.id);
    if (addressCount < shardCapacity(shard)) {
      return { ...shard, addressCount };
    }
  }

  return null;
}

async function configuredCapacity(): Promise<number> {
  const existingShards = await loadShardRows();
  const existingCapacity = existingShards.reduce(
    (sum, shard) => sum + shardCapacity(shard),
    0,
  );
  const existingIds = new Set(existingShards.map((shard) => shard.heliusWebhookId));
  const configuredMissingCount = configuredWebhookIds().filter(
    (id) => !existingIds.has(id),
  ).length;
  return existingCapacity + configuredMissingCount * HARD_HELIUS_MAX_ADDRESSES;
}

async function reconcileWatchedAddresses(): Promise<ReconcileResult> {
  const desiredRefs = await listDesiredWatchedAddressRefCounts();
  const capacity = await configuredCapacity();
  if (desiredRefs.size > capacity) {
    return {
      ok: false,
      error:
        `Helius shard capacity exhausted: ${desiredRefs.size} unique addresses need tracking, ` +
        `${capacity} slots are configured. Create another enhanced webhook in Helius, add its id to HELIUS_WEBHOOK_IDS, then retry.`,
    };
  }

  const touchedShardIds = new Set<number>();
  const existingRows = await db.select().from(watchedAddresses);
  const existingByAddress = new Map(
    existingRows.map((row) => [normalizeAddress(row.address), row]),
  );

  for (const existing of existingRows) {
    const address = normalizeAddress(existing.address);
    const nextRefCount = desiredRefs.get(address) ?? 0;
    if (nextRefCount <= 0) {
      await db
        .delete(watchedAddresses)
        .where(eq(watchedAddresses.address, existing.address));
      touchedShardIds.add(existing.heliusWebhookShardId);
      continue;
    }

    if (existing.refCount !== nextRefCount) {
      await db
        .update(watchedAddresses)
        .set({ refCount: nextRefCount })
        .where(eq(watchedAddresses.address, existing.address));
    }
  }

  for (const [address, refCount] of desiredRefs.entries()) {
    if (existingByAddress.has(address)) continue;

    let shard: HeliusWebhookShardRow | null;
    try {
      shard = await getOrCreateShardWithCapacity();
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (!shard) {
      return {
        ok: false,
        error:
          "A new Helius webhook shard is required, but no spare configured Helius webhook id is available. " +
          "Create another enhanced webhook in Helius and add its id to HELIUS_WEBHOOK_IDS.",
      };
    }

    await db.insert(watchedAddresses).values({
      address,
      heliusWebhookShardId: shard.id,
      refCount,
    });
    touchedShardIds.add(shard.id);
    await refreshShardAddressCount(shard.id);
  }

  for (const shardId of touchedShardIds) {
    await refreshShardAddressCount(shardId);
  }

  return { ok: true, touchedShardIds: [...touchedShardIds] };
}

async function syncShardIds(shardIds: number[]): Promise<HeliusSyncResult> {
  const uniqueShardIds = [...new Set(shardIds)];
  if (uniqueShardIds.length === 0) {
    return { ok: true, status: 0, skipped: true, shards: [] };
  }

  const results: HeliusShardSyncResult[] = [];
  for (const shardId of uniqueShardIds) {
    results.push(await syncHeliusWebhookShard(shardId));
  }

  const failed = results.find((result) => !result.ok);
  if (failed) {
    return {
      ok: false,
      status: failed.status,
      error: failed.error || "One or more Helius webhook shards failed to sync",
      shardId: failed.shardId,
      heliusWebhookId: failed.heliusWebhookId,
      addressCount: failed.addressCount,
      shards: results,
    };
  }

  const last = results[results.length - 1];
  return {
    ok: true,
    status: last?.status ?? 0,
    shardId: last?.shardId,
    heliusWebhookId: last?.heliusWebhookId,
    addressCount: last?.addressCount,
    shards: results,
  };
}

export async function syncHeliusWebhookShard(
  shardId: number,
): Promise<HeliusShardSyncResult> {
  const [shard] = await db
    .select()
    .from(heliusWebhookShards)
    .where(eq(heliusWebhookShards.id, shardId))
    .limit(1);

  if (!shard) {
    return {
      ok: false,
      error: `Helius webhook shard ${shardId} was not found`,
      shardId,
      heliusWebhookId: "",
      addressCount: 0,
    };
  }

  if (!heliusApiKey()) {
    return {
      ok: false,
      error: "HELIUS_API_KEY is not set",
      shardId,
      heliusWebhookId: shard.heliusWebhookId,
      addressCount: shard.addressCount,
    };
  }

  const rows = await db
    .select({ address: watchedAddresses.address })
    .from(watchedAddresses)
    .where(eq(watchedAddresses.heliusWebhookShardId, shardId))
    .orderBy(asc(watchedAddresses.createdAt));
  const accountAddresses = rows.map((row) => row.address);
  const maxAddresses = shardCapacity(shard);

  if (accountAddresses.length > maxAddresses) {
    return {
      ok: false,
      error: `Shard ${shardId} has ${accountAddresses.length} addresses, exceeding max ${maxAddresses}`,
      shardId,
      heliusWebhookId: shard.heliusWebhookId,
      addressCount: accountAddresses.length,
    };
  }

  const webhookURL = shard.webhookUrl || buildShardWebhookUrl(shard.id);
  if (!webhookURL) {
    return {
      ok: false,
      error: "WEBHOOK_PUBLIC_URL is not set",
      shardId,
      heliusWebhookId: shard.heliusWebhookId,
      addressCount: accountAddresses.length,
    };
  }

  const baseBody: Record<string, unknown> = {
    webhookURL,
    transactionTypes: ["ANY"],
    accountAddresses,
    webhookType: "enhanced",
    authHeader: shard.authSecret || getHeliusWebhookAuthSecret(),
  };
  const url = heliusWebhookApiUrl(shard.heliusWebhookId);

  console.log(
    "[helius-shards] syncing shard",
    shardId,
    "heliusWebhookId",
    shard.heliusWebhookId,
    "addressCount",
    accountAddresses.length,
  );

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
    // Preserve the existing behavior: GET is best-effort only.
  }

  try {
    const putResp = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseBody),
    });
    if (!putResp.ok) {
      const text = await putResp.text();
      const error = text || `Helius PUT failed with status ${putResp.status}`;
      console.error("[helius-shards] sync failed for shard", shardId, error);
      await db
        .update(heliusWebhookShards)
        .set({ status: "sync_failed", addressCount: accountAddresses.length })
        .where(eq(heliusWebhookShards.id, shardId));
      return {
        ok: false,
        status: putResp.status,
        error,
        shardId,
        heliusWebhookId: shard.heliusWebhookId,
        addressCount: accountAddresses.length,
      };
    }

    await db
      .update(heliusWebhookShards)
      .set({ status: "active", addressCount: accountAddresses.length })
      .where(eq(heliusWebhookShards.id, shardId));
    console.log("[helius-shards] synced shard", shardId, "status", putResp.status);
    return {
      ok: true,
      status: putResp.status,
      shardId,
      heliusWebhookId: shard.heliusWebhookId,
      addressCount: accountAddresses.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[helius-shards] sync exception for shard", shardId, message);
    await db
      .update(heliusWebhookShards)
      .set({ status: "sync_failed", addressCount: accountAddresses.length })
      .where(eq(heliusWebhookShards.id, shardId));
    return {
      ok: false,
      error: message,
      shardId,
      heliusWebhookId: shard.heliusWebhookId,
      addressCount: accountAddresses.length,
    };
  }
}

export async function ensureWatchedAddress(address: string): Promise<HeliusSyncResult> {
  const normalized = normalizeAddress(address);
  console.log("[helius-shards] ensuring watched address", normalized);
  const reconcile = await reconcileWatchedAddresses();
  if (!reconcile.ok) return { ok: false, error: reconcile.error };

  const [watched] = await db
    .select()
    .from(watchedAddresses)
    .where(eq(watchedAddresses.address, normalized))
    .limit(1);

  if (reconcile.touchedShardIds.length === 0) {
    return {
      ok: true,
      status: 0,
      skipped: true,
      shardId: watched?.heliusWebhookShardId,
      addressCount: watched?.refCount,
      shards: [],
    };
  }

  return syncShardIds(reconcile.touchedShardIds);
}

export async function releaseWatchedAddress(address: string): Promise<HeliusSyncResult> {
  const normalized = normalizeAddress(address);
  console.log("[helius-shards] releasing watched address", normalized);
  const reconcile = await reconcileWatchedAddresses();
  if (!reconcile.ok) return { ok: false, error: reconcile.error };
  return syncShardIds(reconcile.touchedShardIds);
}

export async function syncAllHeliusWebhookShards(): Promise<HeliusSyncResult> {
  const reconcile = await reconcileWatchedAddresses();
  if (!reconcile.ok) return { ok: false, error: reconcile.error };

  const shardRows = await loadShardRows();
  if (shardRows.length === 0) {
    return { ok: true, status: 0, skipped: true, shards: [] };
  }
  return syncShardIds(shardRows.map((shard) => shard.id));
}

export async function isValidHeliusWebhookAuthorization(
  authorization: string | undefined,
  shardIdRaw?: string,
): Promise<boolean> {
  if (!authorization) return false;

  const shardId = shardIdRaw ? Number(shardIdRaw) : NaN;
  if (Number.isFinite(shardId) && shardId > 0) {
    const [shard] = await db
      .select({ authSecret: heliusWebhookShards.authSecret })
      .from(heliusWebhookShards)
      .where(eq(heliusWebhookShards.id, shardId))
      .limit(1);
    if (shard?.authSecret) {
      return authorization === shard.authSecret;
    }
  }

  return authorization === getHeliusWebhookAuthSecret();
}
