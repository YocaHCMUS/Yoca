import {
    WALLET_IDENTITY_KNOWN_TTL_MS,
    WALLET_IDENTITY_UNKNOWN_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { walletIdentityCache } from "@sv/db/schema.js";
import type { WalletIdentityNormalized } from "@sv/services/wallet/dtos/walletIdentityObjects.js";
import { eq } from "drizzle-orm";

type WalletIdentityCacheRow = typeof walletIdentityCache.$inferSelect;

let warnedMissingIdentityCacheTable = false;

export type CachedWalletIdentity = {
    address: string;
    identity: WalletIdentityNormalized;
    raw: Record<string, unknown> | null;
    fetchedAt: Date;
    ttlSec: number;
    isFresh: boolean;
};

function normalizeIdentityStatus(status: string): "known" | "unknown" | "unavailable" {
    if (status === "known" || status === "unknown" || status === "unavailable") {
        return status;
    }
    return "unknown";
}

export function getIdentityCacheTtlMs(status: string): number {
    const normalized = normalizeIdentityStatus(status);
    if (normalized === "known") {
        return WALLET_IDENTITY_KNOWN_TTL_MS;
    }

    if (normalized === "unknown") {
        return WALLET_IDENTITY_UNKNOWN_TTL_MS;
    }

    return 0;
}

function mapRowToIdentity(row: WalletIdentityCacheRow): WalletIdentityNormalized {
    const status = normalizeIdentityStatus(String(row.status ?? "unknown"));

    return {
        status,
        type: row.type != null ? String(row.type) : null,
        name: row.name != null ? String(row.name) : null,
        category: row.category != null ? String(row.category) : null,
        tags: Array.isArray(row.tags) ? row.tags.map((tag: unknown) => String(tag)) : [],
        domainNames: Array.isArray(row.domainNames)
            ? row.domainNames.map((domain: unknown) => String(domain))
            : [],
        provider: "helius",
        providerVersion: "wallet-api-beta",
        resolvedAt:
            row.fetchedAt instanceof Date
                ? row.fetchedAt.toISOString()
                : new Date(row.fetchedAt ?? Date.now()).toISOString(),
    };
}

function isMissingIdentityCacheTableError(error: unknown): boolean {
    if (error == null || typeof error !== "object") {
        return false;
    }

    const record = error as {
        cause?: { code?: unknown };
        message?: unknown;
    };

    if (record.cause != null && typeof record.cause === "object") {
        const causeCode = (record.cause as { code?: unknown }).code;
        if (causeCode === "42P01") {
            return true;
        }
    }

    if (typeof record.message !== "string") {
        return false;
    }

    return (
        record.message.includes("wallet_identity_cache") &&
        record.message.toLowerCase().includes("does not exist")
    );
}

function warnMissingIdentityCacheTableOnce(): void {
    if (warnedMissingIdentityCacheTable) {
        return;
    }

    warnedMissingIdentityCacheTable = true;
    console.warn(
        "[wallet-identity-cache] wallet_identity_cache table not found; continuing without identity cache until migration is applied",
    );
}

export async function getCachedWalletIdentity(
    address: string,
): Promise<CachedWalletIdentity | null> {
    const normalizedAddress = address.trim();

    let rows: WalletIdentityCacheRow[];

    try {
        rows = await db
            .select()
            .from(walletIdentityCache)
            .where(
                eq(walletIdentityCache.address, normalizedAddress),
            )
            .limit(1);
    } catch (error) {
        if (isMissingIdentityCacheTableError(error)) {
            warnMissingIdentityCacheTableOnce();
            return null;
        }

        throw error;
    }

    if (rows.length === 0) {
        return null;
    }

    const row = rows[0];
    const fetchedAt =
        row.fetchedAt instanceof Date ? row.fetchedAt : new Date(row.fetchedAt ?? Date.now());

    const ttlMs = getIdentityCacheTtlMs(String(row.status ?? "unknown"));
    const ttlSec = Math.floor(ttlMs / 1000);
    const isFresh =
        ttlMs > 0 && fetchedAt.getTime() >= Date.now() - ttlMs;

    return {
        address: normalizedAddress,
        identity: mapRowToIdentity(row),
        raw:
            row.raw != null && typeof row.raw === "object" && !Array.isArray(row.raw)
                ? (row.raw as Record<string, unknown>)
                : null,
        fetchedAt,
        ttlSec,
        isFresh,
    };
}

export async function saveWalletIdentityCache(input: {
    address: string;
    identity: WalletIdentityNormalized;
    raw?: Record<string, unknown> | null;
}): Promise<void> {
    const normalizedAddress = input.address.trim();

    if (input.identity.status === "unavailable") {
        return;
    }

    try {
        await db
            .insert(walletIdentityCache)
            .values({
                address: normalizedAddress,
                status: input.identity.status,
                type: input.identity.type,
                name: input.identity.name,
                category: input.identity.category,
                tags: input.identity.tags,
                domainNames: input.identity.domainNames,
                raw: input.raw ?? null,
            })
            .onConflictDoUpdate({
                target: [walletIdentityCache.address],
                set: {
                    status: input.identity.status,
                    type: input.identity.type,
                    name: input.identity.name,
                    category: input.identity.category,
                    tags: input.identity.tags,
                    domainNames: input.identity.domainNames,
                    raw: input.raw ?? null,
                    fetchedAt: new Date(),
                },
            });
    } catch (error) {
        if (isMissingIdentityCacheTableError(error)) {
            warnMissingIdentityCacheTableOnce();
            return;
        }

        throw error;
    }
}
