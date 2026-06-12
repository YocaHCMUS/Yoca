import {
    WALLET_SWAPS_TTL_MS,
    WALLET_TRANSACTIONS_TTL_MS,
    WALLET_TRANSFERS_TTL_MS
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
    tokenTransfers,
    walletHeliusTransactions,
    walletSwap,
    walletSwapMeta,
    walletTransactions,
    walletTransactionsMeta,
    walletTransferMeta,
    walletFirstFund,
    walletPnlDataCache,
    walletPnlDataMeta
} from "@sv/db/schema.js";
import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import type {
    WalletSwap,
    WalletTransaction,
    WalletTransactionHelius,
    WalletTransfer
} from "@sv/services/wallet/dtos/walletDataObjects.js";

export type CachedRange = {
	fromSec: number;
	toSec?: number;
};

export type CachedWalletTransactionsHeliusRangeResult = {
	transactions: WalletTransactionHelius[];
	requestedRange: { fromSec: number; toSec: number };
	coveredRange: { earliestSec: number | null; latestSec: number | null };
	isFullyCovered: boolean;
};

export type CachedWalletChunkResult<T> = {
	available: boolean;
	cursorMatched: boolean;
	items: T[];
	nextCursor: string | null;
	hasMore: boolean;
};

const MOVING_NOW_HEAD_LAG_ALLOWANCE_SEC = 5;
const MOVING_NOW_HEAD_FRESHNESS_SEC = Math.max(
	30,
	Math.floor(WALLET_TRANSACTIONS_TTL_MS / 1000),
);
function toIsoTimestamp(value: unknown): string {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime())
			? new Date().toISOString()
			: value.toISOString();
	}

	if (typeof value === "string") {
		const normalized = value.includes("T") ? value : value.replace(" ", "T");
		const parsed = new Date(normalized);
		return Number.isNaN(parsed.getTime())
			? new Date().toISOString()
			: parsed.toISOString();
	}

	return new Date().toISOString();
}

function toEpochSec(value: unknown): number | null {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			return null;
		}
		return Math.floor(value.getTime() / 1000);
	}

	if (typeof value === "string") {
		const normalized = value.includes("T") ? value : value.replace(" ", "T");
		const parsed = new Date(normalized);
		if (Number.isNaN(parsed.getTime())) {
			return null;
		}
		return Math.floor(parsed.getTime() / 1000);
	}

	return null;
}

function resolveRange(input: CachedRange | "24h" | "7d") {
	const nowSec = Math.floor(Date.now() / 1000);
	if (typeof input === "object") {
		return {
			fromSec: input.fromSec,
			toSec: input.toSec ?? nowSec,
		};
	}

	const fromMs = input === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
	return {
		fromSec: Math.floor((Date.now() - fromMs) / 1000),
		toSec: nowSec,
	};
}

function mapHeliusRow(row: any): WalletTransactionHelius {
	return {
		walletAddress: row.address,
		signature: row.signature,
		timestamp: toIsoTimestamp(row.timestamp),
		slot: row.slot != null ? Number(row.slot) : 0,
		fee: row.fee != null ? Number(row.fee) : 0,
		feePayer: row.feePayer,
		balanceChanges: row.balanceChanges,
	};
}

async function getTransactionMetaRows(address: string) {
	return await db
		.select()
		.from(walletTransactionsMeta)
		.where(
			eq(walletTransactionsMeta.address, address)
		)
		.limit(1);
}

async function getTransferMetaRows(address: string) {
	return await db
		.select()
		.from(walletTransferMeta)
		.where(
			eq(walletTransferMeta.address, address)
		)
		.limit(1);
}

async function getSwapMetaRows(address: string) {
	return await db
		.select()
		.from(walletSwapMeta)
		.where(
			eq(walletSwapMeta.address, address),
		)
		.limit(1);
}

async function hasFreshWalletMeta(
	address: string,
	threshold: Date,
	type: "transfers" | "swaps" | "transactions"
): Promise<boolean> {
	if (type === "transfers") {
		const metaRows = await getTransferMetaRows(address);
		return metaRows.length > 0 && metaRows[0].fetchedAt >= threshold;
	} else if (type === "swaps") {
		const metaRows = await getSwapMetaRows(address);
		return metaRows.length > 0 && metaRows[0].fetchedAt >= threshold;
	} else if (type === "transactions") {
		const metaRows = await getTransactionMetaRows(address);
		return metaRows.length > 0 && metaRows[0].fetchedAt >= threshold;
	}

	return false;

}

export async function getCachedWalletTransactions(
	address: string,
	limit: number,
): Promise<WalletTransaction[] | null> {
	const txThreshold = new Date(Date.now() - WALLET_TRANSACTIONS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, txThreshold, "transactions");
	if (!isFresh) {
		return null;
	}

	const rows = await db
		.select()
		.from(walletTransactions)
		.where(
			eq(walletTransactions.address, address)
		)
		.orderBy(desc(walletTransactions.blockTimestamp))
		.limit(limit);

	if (rows.length === 0) {
		return null;
	}

	return rows.map((r) => ({
		hash: r.hash,
		timestamp: toIsoTimestamp(r.blockTimestamp),
		from: r.fromAddress,
		to: r.toAddress,
		status: r.receiptStatus === 1 ? true : r.receiptStatus === 0 ? false : null,
		fee: r.fee != null ? Number(r.fee) : undefined,
		mainAction: r.mainAction ?? undefined,
		direction: (r.direction as WalletTransaction["direction"]) ?? undefined,
		tokens: (r.tokens as string[]) ?? undefined,
		primaryTokenSymbol: r.primaryTokenSymbol ?? undefined,
		primaryTokenAmount:
			r.primaryTokenAmount != null ? Number(r.primaryTokenAmount) : undefined,
		primaryTokenAddress: r.primaryTokenAddress ?? undefined,
		priceUsd: undefined,
		totalUsd: undefined,
	}));
}

export async function getCachedWalletTransactionsHelius(
	address: string,
	range: CachedRange | "24h" | "7d" = "7d",
): Promise<CachedWalletTransactionsHeliusRangeResult> {
	const requestedRange = resolveRange(range);

	let metaRows = await db
		.select()
		.from(walletTransactionsMeta)
		.where(
			eq(walletTransactionsMeta.address, address),
		)
		.orderBy(desc(walletTransactionsMeta.fetchedAt))
		.limit(1);

	const metaCoveredFromSec: number | null =
		metaRows.length > 0 && metaRows[0].coveredFromSec != null
			? Number(metaRows[0].coveredFromSec)
			: null;
	const metaCoveredToSec: number | null =
		metaRows.length > 0 && metaRows[0].coveredToSec != null
			? Number(metaRows[0].coveredToSec)
			: null;
	const metaFetchedAtSec: number | null =
		metaRows.length > 0 ? toEpochSec(metaRows[0].fetchedAt) : null;

	const nowSec = Math.floor(Date.now() / 1000);
	const isMovingNowWindow =
		Math.abs(requestedRange.toSec - nowSec) <= MOVING_NOW_HEAD_LAG_ALLOWANCE_SEC;
	const hasFreshMovingNowHead =
		isMovingNowWindow &&
		metaCoveredToSec != null &&
		metaCoveredToSec >= requestedRange.toSec - MOVING_NOW_HEAD_FRESHNESS_SEC &&
		metaFetchedAtSec != null &&
		metaFetchedAtSec >= requestedRange.toSec - MOVING_NOW_HEAD_FRESHNESS_SEC;

	const coversTail =
		metaCoveredFromSec != null && metaCoveredFromSec <= requestedRange.fromSec;
	const coversHead =
		metaCoveredToSec != null && metaCoveredToSec >= requestedRange.toSec;

	const isFullyCovered = coversTail && (coversHead || hasFreshMovingNowHead);
	const fromDate = new Date(requestedRange.fromSec * 1000);
	const toDate = new Date(requestedRange.toSec * 1000);

	const rows = await db
		.select()
		.from(walletHeliusTransactions)
		.where(
			and(
				eq(walletHeliusTransactions.address, address),
				gte(walletHeliusTransactions.timestamp, fromDate),
				lte(walletHeliusTransactions.timestamp, toDate),
			),
		)
		.orderBy(desc(walletHeliusTransactions.timestamp));

	if (rows.length === 0) {
		return {
			transactions: [],
			requestedRange,
			coveredRange: { earliestSec: metaCoveredFromSec, latestSec: metaCoveredToSec },
			isFullyCovered,
		};
	}

	const transactions = rows.map(mapHeliusRow);

	return {
		transactions,
		requestedRange,
		coveredRange: { earliestSec: metaCoveredFromSec, latestSec: metaCoveredToSec },
		isFullyCovered,
	};
}

export async function getCachedWalletTransfersMeta(address: string) {
	return await db
		.select()
		.from(walletTransferMeta)
		.where(eq(walletTransferMeta.address, address))
		.limit(1)
}

export async function getCachedWalletTransfers(
	address: string,
	from?: number, //ms
	to?: number,
	tokenAddress?: string,
	direction?: "in" | "out",
	minAmountUsd?: number
): Promise<WalletTransfer[] | null> {
	const predicates = [eq(tokenTransfers.address, address)];

	if (from != null && to != null) {
		predicates.push(gte(tokenTransfers.blockTime, new Date(from)));
		predicates.push(lte(tokenTransfers.blockTime, new Date(to)));
	}

	if (tokenAddress != null) {
		predicates.push(eq(tokenTransfers.tokenAddress, tokenAddress));
	}

	if (direction === "in") {
		predicates.push(eq(tokenTransfers.toOwner, address));
	} else if (direction === "out") {
		predicates.push(eq(tokenTransfers.fromOwner, address));
	}

	if (minAmountUsd != null) {
		predicates.push(gte(tokenTransfers.amountUsd, minAmountUsd));
	}

	const rows = await db
		.select()
		.from(tokenTransfers)
		.where(and(...predicates))
		.orderBy(desc(tokenTransfers.blockTime));

	if (rows.length === 0) {
		return null;
	}

	return rows.map((r) => ({
		from: r.fromOwner,
		to: r.toOwner,
		amount: r.amount,
		amountUsd: Number(r.amountUsd) || undefined,
		priceUsd: undefined,
		timestamp: toIsoTimestamp(r.blockTime),
		tokenAddress: r.tokenAddress,
		tokenSymbol: r.tokenSymbol,
		transactionSignature: r.transactionSignature,
		instructionIndex: r.instructionIndex,
	}));
}

export async function getCachedWalletSwapsMeta(address: string) {
	return await db
		.select()
		.from(walletSwapMeta)
		.where(eq(walletSwapMeta.address, address))
		.limit(1)
}

export async function getCachedWalletSwaps(
	address: string,
	from?: number, //ms
	to?: number,
	tokenAddress?: string
): Promise<WalletSwap[] | null> {
	const predicates = [eq(walletSwap.walletAddress, address)];

	if (from != null && to != null) {
		predicates.push(gte(walletSwap.blockTimestampMs, from));
		predicates.push(lte(walletSwap.blockTimestampMs, to));
	}

	if (tokenAddress != null) {
		predicates.push(or(
			eq(walletSwap.boughtTokenAddress, tokenAddress),
			eq(walletSwap.soldTokenAddress, tokenAddress),
		)!);
	}

	const rows = await db
		.select()
		.from(walletSwap)
		.where(and(...predicates))
		.orderBy(desc(walletSwap.blockTimestampMs));

	if (rows.length === 0) {
		return null;
	}

	return rows.map((r) => ({
		walletAddress: r.walletAddress,
		transactionHash: r.transactionHash,
		blockTimestampIso: toIsoTimestamp(new Date(r.blockTimestampMs)),
		transactionType: r.transactionType,
		subcategory: r.subcategory,
		tokensInvolved: r.tokensInvoled,

		pairAddress: r.pairAddress,
		bought: {
			address: r.boughtTokenAddress,
			amount: r.boughtTokenAmount,
			symbol: null,
			name: null,
			logoUri: null,
			priceUsd: r.boughtTokenPriceUsd,
			valueUsd: r.boughtTokenAmount != null && r.boughtTokenPriceUsd != null
				? Number(r.boughtTokenAmount) * Number(r.boughtTokenPriceUsd)
				: 0,
		},
		sold: {
			address: r.soldTokenAddress,
			amount: r.soldTokenAmount,
			symbol: null,
			name: null,
			logoUri: null,
			priceUsd: r.soldTokenPriceUsd,
			valueUsd: r.soldTokenAmount != null && r.soldTokenPriceUsd != null
				? Number(r.soldTokenAmount) * Number(r.soldTokenPriceUsd)
				: 0,
		},
		totalValueUsd: r.totalValueUsd,
		baseQuotePrice: r.baseQuotePrice,

	}));
}


export async function getCachedWalletTransfersChunk(
	address: string,
	options?: { cursor?: string; limit?: number },
): Promise<CachedWalletChunkResult<WalletTransfer>> {
	const transferThreshold = new Date(Date.now() - WALLET_TRANSFERS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, transferThreshold, "transfers");
	if (!isFresh) {
		return {
			available: false,
			cursorMatched: false,
			items: [],
			nextCursor: null,
			hasMore: false,
		};
	}

	const limit = Math.min(Math.max(Math.floor(options?.limit ?? 100), 1), 100);
	const addressPredicate = or(
		eq(tokenTransfers.fromOwner, address),
		eq(tokenTransfers.toOwner, address),
	);

	const cursor = String(options?.cursor ?? "").trim();
	let pagePredicate = addressPredicate;

	if (cursor) {
		const [cursorSignatureRaw, cursorInstructionRaw] = cursor.split(":");
		const cursorSignature = String(cursorSignatureRaw ?? "").trim();
		const cursorInstructionIndex =
			cursorInstructionRaw != null && Number.isFinite(Number(cursorInstructionRaw))
				? Math.floor(Number(cursorInstructionRaw))
				: null;

		const cursorPredicate = cursorInstructionIndex == null
			? and(
				addressPredicate,
				eq(tokenTransfers.transactionSignature, cursorSignature),
			)
			: and(
				addressPredicate,
				eq(tokenTransfers.transactionSignature, cursorSignature),
				eq(tokenTransfers.instructionIndex, cursorInstructionIndex),
			);

		const cursorRows = await db
			.select({
				blockTime: tokenTransfers.blockTime,
				transactionSignature: tokenTransfers.transactionSignature,
				instructionIndex: tokenTransfers.instructionIndex,
			})
			.from(tokenTransfers)
			.where(cursorPredicate)
			.orderBy(
				desc(tokenTransfers.blockTime),
				desc(tokenTransfers.transactionSignature),
				desc(tokenTransfers.instructionIndex),
			)
			.limit(1);

		if (cursorRows.length === 0) {
			return {
				available: true,
				cursorMatched: false,
				items: [],
				nextCursor: null,
				hasMore: false,
			};
		}

		const anchor = cursorRows[0];
		pagePredicate = and(
			addressPredicate,
			or(
				lt(tokenTransfers.blockTime, anchor.blockTime),
				and(
					eq(tokenTransfers.blockTime, anchor.blockTime),
					lt(tokenTransfers.transactionSignature, anchor.transactionSignature),
				),
				and(
					eq(tokenTransfers.blockTime, anchor.blockTime),
					eq(tokenTransfers.transactionSignature, anchor.transactionSignature),
					lt(tokenTransfers.instructionIndex, anchor.instructionIndex),
				),
			),
		);
	}

	const rows = await db
		.select()
		.from(tokenTransfers)
		.where(pagePredicate)
		.orderBy(
			desc(tokenTransfers.blockTime),
			desc(tokenTransfers.transactionSignature),
			desc(tokenTransfers.instructionIndex),
		)
		.limit(limit + 1);

	const pageRows = rows.slice(0, limit);
	const pageItems = pageRows.map((r) => ({
		from: r.fromOwner,
		to: r.toOwner,
		amount: r.amount,
		timestamp: toIsoTimestamp(r.blockTime),
		tokenAddress: r.tokenAddress,
		tokenSymbol: r.tokenSymbol,
		transactionSignature: r.transactionSignature,
		instructionIndex: r.instructionIndex,
	}));
	const hasMore = rows.length > limit;
	const nextCursor =
		hasMore && pageItems.length > 0
			? `${pageItems[pageItems.length - 1].transactionSignature}:${pageItems[pageItems.length - 1].instructionIndex}`
			: null;

	return {
		available: true,
		cursorMatched: true,
		items: pageItems,
		nextCursor,
		hasMore,
	};
}

export async function getCachedWalletSwapsChunk(
	address: string,
	options?: { before?: string; limit?: number },
): Promise<CachedWalletChunkResult<WalletSwap>> {
	const swapThreshold = new Date(Date.now() - WALLET_SWAPS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, swapThreshold, "swaps");
	if (!isFresh) {
		return {
			available: false,
			cursorMatched: false,
			items: [],
			nextCursor: null,
			hasMore: false,
		};
	}

	const limit = Math.min(Math.max(Math.floor(options?.limit ?? 100), 1), 100);
	const addressPredicate = eq(walletSwap.walletAddress, address);
	const before = String(options?.before ?? "").trim();
	let pagePredicate = addressPredicate;

	if (before) {
		const cursorRows = await db
			.select({
				blockTimestampMs: walletSwap.blockTimestampMs,
				transactionHash: walletSwap.transactionHash,
			})
			.from(walletSwap)
			.where(
				and(
					addressPredicate,
					eq(walletSwap.transactionHash, before),
				),
			)
			.orderBy(desc(walletSwap.blockTimestampMs), desc(walletSwap.transactionHash))
			.limit(1);

		if (cursorRows.length === 0) {
			return {
				available: true,
				cursorMatched: false,
				items: [],
				nextCursor: null,
				hasMore: false,
			};
		}

		const anchor = cursorRows[0];
		pagePredicate = and(
			addressPredicate,
			or(
				lt(walletSwap.blockTimestampMs, anchor.blockTimestampMs),
				and(
					eq(walletSwap.blockTimestampMs, anchor.blockTimestampMs),
					lt(walletSwap.transactionHash, anchor.transactionHash),
				),
			),
		)!;
	}

	const rows = await db
		.select()
		.from(walletSwap)
		.where(pagePredicate)
		.orderBy(desc(walletSwap.blockTimestampMs), desc(walletSwap.transactionHash))
		.limit(limit + 1);

	const pageRows = rows.slice(0, limit);
	const pageItems = pageRows.map((r) => ({
		walletAddress: r.walletAddress,
		transactionHash: r.transactionHash,
		blockTimestampIso: toIsoTimestamp(new Date(r.blockTimestampMs)),
		transactionType: r.transactionType,
		subcategory: r.subcategory,
		tokensInvolved: r.tokensInvoled,

		pairAddress: r.pairAddress,
		bought: {
			address: r.boughtTokenAddress,
			amount: r.boughtTokenAmount,
			symbol: null,
			name: null,
			logoUri: null,
			priceUsd: r.boughtTokenPriceUsd,
			valueUsd: r.boughtTokenAmount != null && r.boughtTokenPriceUsd != null
				? Number(r.boughtTokenAmount) * Number(r.boughtTokenPriceUsd)
				: 0,
		},
		sold: {
			address: r.soldTokenAddress,
			amount: r.soldTokenAmount,
			symbol: null,
			name: null,
			logoUri: null,
			priceUsd: r.soldTokenPriceUsd,
			valueUsd: r.soldTokenAmount != null && r.soldTokenPriceUsd != null
				? Number(r.soldTokenAmount) * Number(r.soldTokenPriceUsd)
				: 0,
		},
		totalValueUsd: r.totalValueUsd,
		baseQuotePrice: r.baseQuotePrice,
	}));
	const hasMore = rows.length > limit;
	const nextCursor =
		hasMore && pageItems.length > 0
			? pageItems[pageItems.length - 1].transactionHash
			: null;

	return {
		available: true,
		cursorMatched: true,
		items: pageItems,
		nextCursor,
		hasMore,
	};
}

export async function getCachedWalletFirstFund(
	address: string
) {
	const row = await db
		.select()
		.from(walletFirstFund)
		.where(
			eq(walletFirstFund.reciepient, address),
		)
		.limit(1);

	return row.length > 0 ? row[0] : null;
}

/**
 * Retrieve wallet PnL cache rows for a given address/period/aggregation within a date range.
 *
 * Returns daily PnL records sorted by dayStartMs ascending.
 * If no data is cached, returns an empty array.
 */
export async function getCachedWalletPnl(
	address: string,
	timePeriod: string,
	aggregation: string,
	fromMs: number,
	toMs: number,
) {
	const rows = await db
		.select()
		.from(walletPnlDataCache)
		.where(
			and(
				eq(walletPnlDataCache.address, address),
				eq(walletPnlDataCache.timePeriod, timePeriod),
				eq(walletPnlDataCache.aggregation, aggregation),
				gte(walletPnlDataCache.dayStartMs, fromMs),
				lt(walletPnlDataCache.dayStartMs, toMs),
			),
		)
		.orderBy(walletPnlDataCache.dayStartMs);

	return rows;
}

/**
 * Retrieve wallet PnL cache metadata for a given address/period/aggregation.
 *
 * Returns metadata with coverage ranges and source data ranges, or null if not cached.
 */
export async function getWalletPnlMeta(
	address: string,
	timePeriod: string,
	aggregation: string,
) {
	const row = await db
		.select()
		.from(walletPnlDataMeta)
		.where(
			and(
				eq(walletPnlDataMeta.address, address),
				eq(walletPnlDataMeta.timePeriod, timePeriod),
				eq(walletPnlDataMeta.aggregation, aggregation),
			),
		)
		.limit(1);

	return row.length > 0 ? row[0] : null;
}