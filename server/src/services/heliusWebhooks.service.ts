import { db } from "@sv/db/index.js";
import {
  alertRules,
  followedWallets,
  heliusWebhookAddresses,
  heliusWebhooks,
  type HeliusWebhookRow,
} from "@sv/db/schema.js";
import { and, asc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";

export const MAX_HELIUS_WEBHOOK_ADDRESSES = 25;
const DEFAULT_HELIUS_API_BASE = "https://api.helius.xyz";
const DEFAULT_WEBHOOK_TYPE = "enhanced";
const DEFAULT_TRANSACTION_TYPES = ["ANY"];

export interface ManagedHeliusWebhook {
  id?: number;
  heliusWebhookId: string;
  webhookUrl: string;
  webhookType: string;
  transactionTypes: string[];
  accountAddresses: string[];
  status: string;
}

export interface HeliusShardAssignment {
  heliusWebhookId: string;
  webhookUrl: string;
  webhookType: string;
  transactionTypes: string[];
  accountAddresses: string[];
  status: "active";
}

export type HeliusSyncResult =
  | {
      ok: true;
      status: number;
      totalAddresses: number;
      requiredShards: number;
      managedShards: number;
      createdWebhookIds: string[];
      updatedWebhookIds: string[];
      deletedWebhookIds: string[];
      shardAddressCounts: number[];
    }
  | {
      ok: false;
      status?: number;
      error: string;
      totalAddresses?: number;
      requiredShards?: number;
      managedShards?: number;
      createdWebhookIds?: string[];
      updatedWebhookIds?: string[];
      deletedWebhookIds?: string[];
      shardAddressCounts?: number[];
    };

export interface HeliusWebhookDiagnostics {
  totalWatchedAddressCount: number;
  maxAddressesPerWebhook: number;
  requiredHeliusWebhookCount: number;
  managedHeliusWebhookCount: number;
  shardAddressCounts: Array<{
    heliusWebhookId: string;
    status: string;
    addressCount: number;
  }>;
  oldEnvWebhookConfigured: boolean;
  oldEnvWebhookIdPresent: boolean;
  legacyCutoverRequired: boolean;
  publicWebhookUrlConfigured: boolean;
  publicWebhookUrlLooksLocalhost: boolean;
  lastShardSyncStatus: "ok" | "error" | null;
  lastShardSyncError: string | null;
  lastSuccessfulShardSyncAt: string | null;
  warnings: string[];
  lastSyncStatus: "ok" | "error" | null;
  lastSyncError: string | null;
  configured: {
    publicWebhookUrl: boolean;
    heliusApiKey: boolean;
    heliusWebhookAuthKey: boolean;
  };
}

export interface HeliusCutoverVerificationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  totalWatchedAddressCount: number;
  maxAddressesPerWebhook: number;
  requiredHeliusWebhookCount: number;
  managedHeliusWebhookCount: number;
  shardAddressCounts: Array<{
    heliusWebhookId: string;
    status: string;
    addressCount: number;
  }>;
  oldEnvWebhookConfigured: boolean;
  oldEnvWebhookIdPresent: boolean;
  legacyCutoverRequired: boolean;
  publicWebhookUrlConfigured: boolean;
  publicWebhookUrlLooksLocalhost: boolean;
}

export interface HeliusWebhookSyncDependencies {
  withShardSyncLock: <T>(work: () => Promise<T>) => Promise<T>;
  loadWatchedAddresses: () => Promise<string[]>;
  listManagedWebhooksFromDb: () => Promise<ManagedHeliusWebhook[]>;
  createWebhook: (addresses: string[]) => Promise<string>;
  updateWebhook: (
    heliusWebhookId: string,
    addresses: string[],
  ) => Promise<void>;
  deleteWebhook: (heliusWebhookId: string) => Promise<void>;
  persistShardState: (
    activeAssignments: HeliusShardAssignment[],
    deletedWebhookIds: string[],
  ) => Promise<void>;
}

export interface HeliusCutoverVerificationDependencies {
  loadWatchedAddresses: () => Promise<string[]>;
  listManagedWebhooksFromDb: () => Promise<ManagedHeliusWebhook[]>;
}

export interface HeliusWebhookDeleteResult {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
}

export interface DisableLegacyHeliusWebhookResult {
  ok: boolean;
  skipped: boolean;
  message: string;
  verification?: HeliusCutoverVerificationResult;
  deleteResult?: HeliusWebhookDeleteResult;
  manualSteps?: string[];
}

export interface DisableLegacyHeliusWebhookDependencies
  extends HeliusCutoverVerificationDependencies {
  deleteWebhookById: (heliusWebhookId: string) => Promise<HeliusWebhookDeleteResult>;
}

let lastSyncResult: HeliusSyncResult | null = null;
let lastSuccessfulShardSyncAt: Date | null = null;
let legacyWebhookWarningLogged = false;

const LEGACY_WEBHOOK_WARNING =
  "[helius-shards] legacy HELIUS_WEBHOOK_ID is configured. Managed shards are enabled. Disable/delete the legacy webhook after verifying managed shards to avoid duplicate events.";
const LEGACY_WEBHOOK_MANUAL_STEPS = [
  "Open Helius dashboard",
  "Go to Webhooks",
  "Find the webhook with ID from HELIUS_WEBHOOK_ID",
  "Disable or delete it",
  "Confirm only DB-managed shard webhooks remain active",
  "Remove HELIUS_WEBHOOK_ID from server env",
  "Restart server",
];

class HeliusWebhookHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "HeliusWebhookHttpError";
  }
}

export async function withShardSyncLock<T>(
  work: () => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('helius_webhook_shard_sync'))`,
    );
    return work();
  });
}

function heliusApiKey(): string {
  return process.env.HELIUS_API_KEY?.trim() || "";
}

function heliusApiBase(): string {
  return process.env.HELIUS_API_BASE?.trim() || DEFAULT_HELIUS_API_BASE;
}

function webhookAuthHeader(): string {
  return (
    process.env.HELIUS_WEBHOOK_AUTH_KEY?.trim() ||
    process.env.HELIUS_AUTH_HEADER?.trim() ||
    ""
  );
}

function publicWebhookBaseUrl(): string {
  return (
    process.env.WEBHOOK_PUBLIC_URL?.trim() ||
    process.env.PUBLIC_WEBHOOK_URL?.trim() ||
    ""
  );
}

function legacyWebhookId(): string {
  return process.env.HELIUS_WEBHOOK_ID?.trim() || "";
}

function legacyWebhookEnvPresent(): boolean {
  return Object.prototype.hasOwnProperty.call(process.env, "HELIUS_WEBHOOK_ID");
}

function isLocalhostWebhookUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1" ||
      url.hostname.endsWith(".localhost")
    );
  } catch {
    return /\blocalhost\b|127\.0\.0\.1|\[?::1\]?/.test(value);
  }
}

export function warnIfLegacyHeliusWebhookConfigured(): void {
  if (!legacyWebhookId() || legacyWebhookWarningLogged) return;
  legacyWebhookWarningLogged = true;
  console.warn(LEGACY_WEBHOOK_WARNING);
}

function legacyCutoverWarnings(publicWebhookLooksLocalhost: boolean): string[] {
  const warnings: string[] = [];
  if (legacyWebhookId()) {
    warnings.push(
      "legacy HELIUS_WEBHOOK_ID is configured. Managed shards are enabled. Disable/delete the legacy webhook after verifying managed shards to avoid duplicate events.",
    );
  }
  if (publicWebhookLooksLocalhost) {
    warnings.push(
      "WEBHOOK_PUBLIC_URL/PUBLIC_WEBHOOK_URL looks local; Helius cannot deliver live webhooks to localhost from production.",
    );
  }
  return warnings;
}

export function getManagedWebhookUrl(): string {
  const base = publicWebhookBaseUrl().replace(/\/+$/, "");
  if (!base) return "";
  return base.endsWith("/webhook") ? base : `${base}/webhook`;
}

function heliusWebhooksUrl(): string {
  return `${heliusApiBase()}/v0/webhooks?api-key=${encodeURIComponent(
    heliusApiKey(),
  )}`;
}

function heliusWebhookUrl(heliusWebhookId: string): string {
  return `${heliusApiBase()}/v0/webhooks/${encodeURIComponent(
    heliusWebhookId,
  )}?api-key=${encodeURIComponent(heliusApiKey())}`;
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeWatchedAddresses(addresses: string[]): string[] {
  return [
    ...new Set(addresses.map(normalizeAddress).filter(Boolean) as string[]),
  ].sort();
}

export function chunkAddresses(
  addresses: string[],
  chunkSize = MAX_HELIUS_WEBHOOK_ADDRESSES,
): string[][] {
  const normalized = normalizeWatchedAddresses(addresses);
  const chunks: string[][] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }
  return chunks;
}

function webhookBody(addresses: string[]): Record<string, unknown> {
  return {
    webhookURL: getManagedWebhookUrl(),
    transactionTypes: DEFAULT_TRANSACTION_TYPES,
    accountAddresses: addresses,
    webhookType: DEFAULT_WEBHOOK_TYPE,
    authHeader: webhookAuthHeader(),
  };
}

function extractHeliusWebhookId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const record = response as Record<string, unknown>;
  const direct =
    record.webhookID || record.webhookId || record.heliusWebhookId || record.id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = record.webhook;
  if (nested && typeof nested === "object") {
    return extractHeliusWebhookId(nested);
  }
  return null;
}

async function readErrorResponse(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return text.slice(0, 1000) || `Helius HTTP ${response.status}`;
}

async function heliusHttpError(response: Response): Promise<HeliusWebhookHttpError> {
  const body = await readErrorResponse(response);
  return new HeliusWebhookHttpError(body, response.status, body);
}

function isHeliusWebhookNotFound(error: unknown): boolean {
  if (error instanceof HeliusWebhookHttpError && error.status === 404) {
    return true;
  }
  return (error as { status?: number } | null)?.status === 404;
}

export async function loadWatchedAddresses(): Promise<string[]> {
  const now = new Date();
  const followed = await db
    .select({ address: followedWallets.address })
    .from(followedWallets);
  const rules = await db
    .select({ address: alertRules.walletAddress })
    .from(alertRules)
    .where(
      and(
        gt(alertRules.expiryDate, now),
        or(
          eq(alertRules.triggerType, "ALWAYS"),
          and(
            eq(alertRules.triggerType, "ONCE"),
            isNull(alertRules.oneShotFiredAt),
          ),
        ),
      ),
    );

  return normalizeWatchedAddresses([
    ...followed.map((row) => row.address),
    ...rules.map((row) => row.address),
  ]);
}

function mapWebhookRow(row: HeliusWebhookRow): ManagedHeliusWebhook {
  return {
    id: row.id,
    heliusWebhookId: row.heliusWebhookId,
    webhookUrl: row.webhookUrl,
    webhookType: row.webhookType,
    transactionTypes: row.transactionTypes,
    accountAddresses: row.accountAddresses,
    status: row.status,
  };
}

export async function listManagedWebhooksFromDb(): Promise<
  ManagedHeliusWebhook[]
> {
  const rows = await db
    .select()
    .from(heliusWebhooks)
    .where(ne(heliusWebhooks.status, "deleted"))
    .orderBy(asc(heliusWebhooks.id));
  return rows.map(mapWebhookRow);
}

export async function createWebhook(addresses: string[]): Promise<string> {
  const response = await fetch(heliusWebhooksUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookBody(addresses)),
  });
  if (!response.ok) {
    throw await heliusHttpError(response);
  }
  const json = (await response.json().catch(() => null)) as unknown;
  const heliusWebhookId = extractHeliusWebhookId(json);
  if (!heliusWebhookId) {
    throw new Error("Helius create response did not include webhook id");
  }
  return heliusWebhookId;
}

export async function updateWebhook(
  heliusWebhookId: string,
  addresses: string[],
): Promise<void> {
  const response = await fetch(heliusWebhookUrl(heliusWebhookId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookBody(addresses)),
  });
  if (!response.ok) {
    throw await heliusHttpError(response);
  }
}

export async function deleteWebhook(heliusWebhookId: string): Promise<void> {
  const result = await deleteWebhookById(heliusWebhookId);
  if (!result.ok) {
    throw new Error(
      result.body || result.error || `Helius HTTP ${result.status ?? "unknown"}`,
    );
  }
}

export async function deleteWebhookById(
  heliusWebhookId: string,
): Promise<HeliusWebhookDeleteResult> {
  try {
    const response = await fetch(heliusWebhookUrl(heliusWebhookId), {
      method: "DELETE",
    });
    const body = await response.text().catch(() => "");
    if (!response.ok && response.status !== 404) {
      return {
        ok: false,
        status: response.status,
        body: body.slice(0, 1000),
      };
    }
    return {
      ok: true,
      status: response.status,
      body: body.slice(0, 1000),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function persistShardState(
  activeAssignments: HeliusShardAssignment[],
  deletedWebhookIds: string[],
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const assignment of activeAssignments) {
      await tx
        .insert(heliusWebhooks)
        .values({
          heliusWebhookId: assignment.heliusWebhookId,
          webhookUrl: assignment.webhookUrl,
          webhookType: assignment.webhookType,
          transactionTypes: assignment.transactionTypes,
          accountAddresses: assignment.accountAddresses,
          status: assignment.status,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: heliusWebhooks.heliusWebhookId,
          set: {
            webhookUrl: assignment.webhookUrl,
            webhookType: assignment.webhookType,
            transactionTypes: assignment.transactionTypes,
            accountAddresses: assignment.accountAddresses,
            status: assignment.status,
            updatedAt: now,
          },
        });

      await tx
        .delete(heliusWebhookAddresses)
        .where(
          eq(
            heliusWebhookAddresses.heliusWebhookId,
            assignment.heliusWebhookId,
          ),
        );

      if (assignment.accountAddresses.length > 0) {
        await tx.insert(heliusWebhookAddresses).values(
          assignment.accountAddresses.map((walletAddress) => ({
            heliusWebhookId: assignment.heliusWebhookId,
            walletAddress,
          })),
        );
      }
    }

    if (deletedWebhookIds.length > 0) {
      await tx
        .update(heliusWebhooks)
        .set({
          status: "deleted",
          accountAddresses: [],
          updatedAt: now,
        })
        .where(inArray(heliusWebhooks.heliusWebhookId, deletedWebhookIds));
      await tx
        .delete(heliusWebhookAddresses)
        .where(
          inArray(
            heliusWebhookAddresses.heliusWebhookId,
            deletedWebhookIds,
          ),
        );
    }
  });
}

function logSync(message: string, payload: Record<string, unknown>) {
  console.log(`[helius-shards] ${message}`, JSON.stringify(payload));
}

function logSyncError(message: string, payload: Record<string, unknown>) {
  console.error(`[helius-shards] ${message}`, JSON.stringify(payload));
}

function defaultDependencies(): HeliusWebhookSyncDependencies {
  return {
    withShardSyncLock,
    loadWatchedAddresses,
    listManagedWebhooksFromDb,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    persistShardState,
  };
}

export async function syncHeliusWebhookAccountAddresses(
  dependencies: Partial<HeliusWebhookSyncDependencies> = {},
): Promise<HeliusSyncResult> {
  const deps = { ...defaultDependencies(), ...dependencies };
  return deps.withShardSyncLock(() => syncHeliusWebhookAccountAddressesLocked(deps));
}

async function syncHeliusWebhookAccountAddressesLocked(
  deps: HeliusWebhookSyncDependencies,
): Promise<HeliusSyncResult> {
  const addresses = normalizeWatchedAddresses(await deps.loadWatchedAddresses());
  const chunks = chunkAddresses(addresses);
  const existing = await deps.listManagedWebhooksFromDb();
  const webhookUrl = getManagedWebhookUrl();

  logSync("sync start", {
    totalUniqueWatchedAddresses: addresses.length,
    requiredShardCount: chunks.length,
    existingManagedShardCount: existing.length,
    maxAddressesPerWebhook: MAX_HELIUS_WEBHOOK_ADDRESSES,
  });

  if (chunks.length > 0 && !heliusApiKey()) {
    const result: HeliusSyncResult = {
      ok: false,
      error: "HELIUS_API_KEY is not set",
      totalAddresses: addresses.length,
      requiredShards: chunks.length,
      managedShards: existing.length,
    };
    lastSyncResult = result;
    logSyncError("sync failed", { error: result.error });
    return result;
  }

  if (chunks.length > 0 && !webhookUrl) {
    const result: HeliusSyncResult = {
      ok: false,
      error: "PUBLIC_WEBHOOK_URL is not set",
      totalAddresses: addresses.length,
      requiredShards: chunks.length,
      managedShards: existing.length,
    };
    lastSyncResult = result;
    logSyncError("sync failed", { error: result.error });
    return result;
  }

  if (chunks.length > 0 && !webhookAuthHeader()) {
    const result: HeliusSyncResult = {
      ok: false,
      error: "HELIUS_WEBHOOK_AUTH_KEY is not set",
      totalAddresses: addresses.length,
      requiredShards: chunks.length,
      managedShards: existing.length,
    };
    lastSyncResult = result;
    logSyncError("sync failed", { error: result.error });
    return result;
  }

  const createdWebhookIds: string[] = [];
  const updatedWebhookIds: string[] = [];
  const deletedWebhookIds: string[] = [];
  const activeAssignments: HeliusShardAssignment[] = [];

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const addressesForShard = chunks[index] || [];
      const existingShard = existing[index];
      if (existingShard) {
        let heliusWebhookId = existingShard.heliusWebhookId;
        try {
          await deps.updateWebhook(existingShard.heliusWebhookId, addressesForShard);
          updatedWebhookIds.push(existingShard.heliusWebhookId);
        } catch (error) {
          if (!isHeliusWebhookNotFound(error)) {
            throw error;
          }
          logSync("managed shard missing remotely; recreating", {
            staleHeliusWebhookId: existingShard.heliusWebhookId,
            addressCount: addressesForShard.length,
          });
          heliusWebhookId = await deps.createWebhook(addressesForShard);
          createdWebhookIds.push(heliusWebhookId);
          deletedWebhookIds.push(existingShard.heliusWebhookId);
        }
        activeAssignments.push({
          heliusWebhookId,
          webhookUrl,
          webhookType: DEFAULT_WEBHOOK_TYPE,
          transactionTypes: DEFAULT_TRANSACTION_TYPES,
          accountAddresses: addressesForShard,
          status: "active",
        });
      } else {
        const heliusWebhookId = await deps.createWebhook(addressesForShard);
        createdWebhookIds.push(heliusWebhookId);
        activeAssignments.push({
          heliusWebhookId,
          webhookUrl,
          webhookType: DEFAULT_WEBHOOK_TYPE,
          transactionTypes: DEFAULT_TRANSACTION_TYPES,
          accountAddresses: addressesForShard,
          status: "active",
        });
      }
    }

    const extraShards = existing.slice(chunks.length);
    for (const shard of extraShards) {
      if (!heliusApiKey()) {
        throw new Error("HELIUS_API_KEY is not set");
      }
      await deps.deleteWebhook(shard.heliusWebhookId);
      deletedWebhookIds.push(shard.heliusWebhookId);
    }

    await deps.persistShardState(activeAssignments, deletedWebhookIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result: HeliusSyncResult = {
      ok: false,
      error: message,
      totalAddresses: addresses.length,
      requiredShards: chunks.length,
      managedShards: existing.length,
      createdWebhookIds,
      updatedWebhookIds,
      deletedWebhookIds,
      shardAddressCounts: chunks.map((chunk) => chunk.length),
    };
    lastSyncResult = result;
    logSyncError("sync failed", {
      error: message,
      totalUniqueWatchedAddresses: addresses.length,
      requiredShardCount: chunks.length,
      existingManagedShardCount: existing.length,
      createdWebhookIds,
      updatedWebhookIds,
      deletedWebhookIds,
    });
    return result;
  }

  const result: HeliusSyncResult = {
    ok: true,
    status: 200,
    totalAddresses: addresses.length,
    requiredShards: chunks.length,
    managedShards: activeAssignments.length,
    createdWebhookIds,
    updatedWebhookIds,
    deletedWebhookIds,
    shardAddressCounts: chunks.map((chunk) => chunk.length),
  };
  lastSyncResult = result;
  lastSuccessfulShardSyncAt = new Date();

  logSync("sync complete", {
    totalUniqueWatchedAddresses: result.totalAddresses,
    requiredShardCount: result.requiredShards,
    existingManagedShardCount: existing.length,
    createdWebhookIds,
    updatedWebhookIds,
    deletedWebhookIds,
    addressesPerShard: result.shardAddressCounts,
  });

  return result;
}

function cutoverDependencies(
  dependencies: Partial<HeliusCutoverVerificationDependencies> = {},
): HeliusCutoverVerificationDependencies {
  return {
    loadWatchedAddresses,
    listManagedWebhooksFromDb,
    ...dependencies,
  };
}

export async function verifyHeliusCutover(
  dependencies: Partial<HeliusCutoverVerificationDependencies> = {},
): Promise<HeliusCutoverVerificationResult> {
  const deps = cutoverDependencies(dependencies);
  const [watchedAddresses, managed] = await Promise.all([
    deps.loadWatchedAddresses(),
    deps.listManagedWebhooksFromDb(),
  ]);
  const normalizedWatchedAddresses = normalizeWatchedAddresses(watchedAddresses);
  const activeManaged = managed.filter((shard) => shard.status === "active");
  const requiredCount = Math.ceil(
    normalizedWatchedAddresses.length / MAX_HELIUS_WEBHOOK_ADDRESSES,
  );
  const publicWebhookUrl = publicWebhookBaseUrl();
  const publicWebhookUrlConfigured = Boolean(getManagedWebhookUrl());
  const publicWebhookUrlLooksLocalhost =
    isLocalhostWebhookUrl(publicWebhookUrl);
  const oldEnvWebhookConfigured = Boolean(legacyWebhookId());
  const errors: string[] = [];
  const warnings = legacyCutoverWarnings(publicWebhookUrlLooksLocalhost);

  if (!publicWebhookUrlConfigured) {
    errors.push("WEBHOOK_PUBLIC_URL or PUBLIC_WEBHOOK_URL is not configured");
  }
  if (!heliusApiKey()) {
    errors.push("HELIUS_API_KEY is not configured");
  }
  if (!webhookAuthHeader()) {
    errors.push("HELIUS_WEBHOOK_AUTH_KEY is not configured");
  }
  if (normalizedWatchedAddresses.length > 0 && activeManaged.length === 0) {
    errors.push(
      "watched addresses exist, but no DB-managed Helius webhook shards exist",
    );
  }
  if (requiredCount !== activeManaged.length) {
    errors.push(
      `required shard count ${requiredCount} does not match managed active shard count ${activeManaged.length}`,
    );
  }

  const watchedSet = new Set(normalizedWatchedAddresses);
  const shardAddressCounts = activeManaged.map((shard) => {
    const addresses = normalizeWatchedAddresses(shard.accountAddresses);
    if (addresses.length > MAX_HELIUS_WEBHOOK_ADDRESSES) {
      errors.push(
        `managed shard ${shard.heliusWebhookId} has ${addresses.length} addresses; max is ${MAX_HELIUS_WEBHOOK_ADDRESSES}`,
      );
    }
    return {
      heliusWebhookId: shard.heliusWebhookId,
      status: shard.status,
      addressCount: addresses.length,
    };
  });

  const addressOwners = new Map<string, string>();
  for (const shard of activeManaged) {
    for (const address of normalizeWatchedAddresses(shard.accountAddresses)) {
      const previousShardId = addressOwners.get(address);
      if (previousShardId && previousShardId !== shard.heliusWebhookId) {
        errors.push(
          `address ${address} appears in multiple managed shards: ${previousShardId}, ${shard.heliusWebhookId}`,
        );
      } else {
        addressOwners.set(address, shard.heliusWebhookId);
      }
    }
  }

  for (const address of watchedSet) {
    if (!addressOwners.has(address)) {
      errors.push(`watched address ${address} is missing from managed shards`);
    }
  }
  for (const address of addressOwners.keys()) {
    if (!watchedSet.has(address)) {
      errors.push(`managed shard address ${address} is no longer watched`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    totalWatchedAddressCount: normalizedWatchedAddresses.length,
    maxAddressesPerWebhook: MAX_HELIUS_WEBHOOK_ADDRESSES,
    requiredHeliusWebhookCount: requiredCount,
    managedHeliusWebhookCount: activeManaged.length,
    shardAddressCounts,
    oldEnvWebhookConfigured,
    oldEnvWebhookIdPresent: legacyWebhookEnvPresent(),
    legacyCutoverRequired: oldEnvWebhookConfigured,
    publicWebhookUrlConfigured,
    publicWebhookUrlLooksLocalhost,
  };
}

function disableLegacyDependencies(
  dependencies: Partial<DisableLegacyHeliusWebhookDependencies> = {},
): DisableLegacyHeliusWebhookDependencies {
  return {
    loadWatchedAddresses,
    listManagedWebhooksFromDb,
    deleteWebhookById,
    ...dependencies,
  };
}

export async function disableLegacyHeliusWebhook(
  dependencies: Partial<DisableLegacyHeliusWebhookDependencies> = {},
): Promise<DisableLegacyHeliusWebhookResult> {
  const legacyId = legacyWebhookId();
  if (!legacyId) {
    return {
      ok: true,
      skipped: true,
      message: "No legacy HELIUS_WEBHOOK_ID configured. Nothing to disable.",
    };
  }

  const deps = disableLegacyDependencies(dependencies);
  const verification = await verifyHeliusCutover(deps);
  if (!verification.ok) {
    return {
      ok: false,
      skipped: true,
      message:
        "Managed Helius webhook shards are not healthy. Refusing to disable/delete the legacy webhook.",
      verification,
      manualSteps: LEGACY_WEBHOOK_MANUAL_STEPS,
    };
  }

  const managed = await deps.listManagedWebhooksFromDb();
  if (managed.some((shard) => shard.heliusWebhookId === legacyId)) {
    return {
      ok: false,
      skipped: true,
      message:
        "HELIUS_WEBHOOK_ID matches a DB-managed shard. Refusing to delete any managed shard.",
      verification,
      manualSteps: LEGACY_WEBHOOK_MANUAL_STEPS,
    };
  }

  const deleteResult = await deps.deleteWebhookById(legacyId);
  if (!deleteResult.ok) {
    return {
      ok: false,
      skipped: false,
      message:
        "Failed to delete the legacy Helius webhook automatically. Use the manual dashboard steps.",
      verification,
      deleteResult,
      manualSteps: LEGACY_WEBHOOK_MANUAL_STEPS,
    };
  }

  return {
    ok: true,
    skipped: false,
    message:
      "Deleted legacy HELIUS_WEBHOOK_ID webhook. Remove HELIUS_WEBHOOK_ID from server env and restart server.",
    verification,
    deleteResult,
  };
}

export async function getHeliusWebhookDiagnostics(
  dependencies: Partial<HeliusCutoverVerificationDependencies> = {},
): Promise<HeliusWebhookDiagnostics> {
  const deps = cutoverDependencies(dependencies);
  const [addresses, managed] = await Promise.all([
    deps.loadWatchedAddresses(),
    deps.listManagedWebhooksFromDb(),
  ]);
  const normalizedAddresses = normalizeWatchedAddresses(addresses);
  const activeManaged = managed.filter((shard) => shard.status === "active");
  const verification = await verifyHeliusCutover({
    loadWatchedAddresses: async () => normalizedAddresses,
    listManagedWebhooksFromDb: async () => managed,
  });
  const lastShardSyncStatus = lastSyncResult
    ? lastSyncResult.ok
      ? "ok"
      : "error"
    : null;
  const lastShardSyncError =
    lastSyncResult && !lastSyncResult.ok ? lastSyncResult.error : null;
  return {
    totalWatchedAddressCount: normalizedAddresses.length,
    maxAddressesPerWebhook: MAX_HELIUS_WEBHOOK_ADDRESSES,
    requiredHeliusWebhookCount: verification.requiredHeliusWebhookCount,
    managedHeliusWebhookCount: activeManaged.length,
    shardAddressCounts: activeManaged.map((shard) => ({
      heliusWebhookId: shard.heliusWebhookId,
      status: shard.status,
      addressCount: normalizeWatchedAddresses(shard.accountAddresses).length,
    })),
    oldEnvWebhookConfigured: verification.oldEnvWebhookConfigured,
    oldEnvWebhookIdPresent: verification.oldEnvWebhookIdPresent,
    legacyCutoverRequired: verification.legacyCutoverRequired,
    publicWebhookUrlConfigured: verification.publicWebhookUrlConfigured,
    publicWebhookUrlLooksLocalhost: verification.publicWebhookUrlLooksLocalhost,
    lastShardSyncStatus,
    lastShardSyncError,
    lastSuccessfulShardSyncAt: lastSuccessfulShardSyncAt?.toISOString() ?? null,
    warnings: verification.warnings,
    lastSyncStatus: lastShardSyncStatus,
    lastSyncError: lastShardSyncError,
    configured: {
      publicWebhookUrl: Boolean(getManagedWebhookUrl()),
      heliusApiKey: Boolean(heliusApiKey()),
      heliusWebhookAuthKey: Boolean(webhookAuthHeader()),
    },
  };
}
