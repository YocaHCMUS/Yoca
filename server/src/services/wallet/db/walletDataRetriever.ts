import {
	WALLET_SWAPS_TTL_MS,
	WALLET_TRANSACTIONS_TTL_MS,
	WALLET_TRANSFERS_TTL_MS,
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
} from "@sv/db/schema.js";
import { and, desc, eq, or } from "drizzle-orm";
import type {
	WalletSwap,
	WalletTransaction,
	WalletTransactionHelius,
	WalletTransfer,
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

function toNullableFiniteNumber(value: unknown): number | null {
	if (value == null) {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
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

	const rows = await db
		.select()
		.from(walletHeliusTransactions)
		.where(
			eq(walletHeliusTransactions.address, address)
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

	const transactions = rows
		.filter((row) => {
			const date = row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp);
			const ms = date.getTime();
			if (Number.isNaN(ms)) {
				return false;
			}

			const sec = Math.floor(ms / 1000);
			return sec >= requestedRange.fromSec && sec <= requestedRange.toSec;
		})
		.map(mapHeliusRow);

	return {
		transactions,
		requestedRange,
		coveredRange: { earliestSec: metaCoveredFromSec, latestSec: metaCoveredToSec },
		isFullyCovered,
	};
}

export async function getCachedWalletTransfers(
	address: string,
	from: "24h" | "7d" | CachedRange = "7d",
): Promise<WalletTransfer[] | null> {
	const transferThreshold = new Date(Date.now() - WALLET_TRANSFERS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, transferThreshold, "transfers");
	if (!isFresh) {
		return null;
	}

	const range = resolveRange(from);

	const rows = await db
		.select()
		.from(tokenTransfers)
		.where(
			or(eq(tokenTransfers.fromOwner, address), eq(tokenTransfers.toOwner, address)),
		)
		.orderBy(desc(tokenTransfers.blockTime));

	if (rows.length === 0) {
		return null;
	}

	return rows
		.filter((r) => {
			const rowDate = r.blockTime instanceof Date ? r.blockTime : new Date(r.blockTime);
			const ms = rowDate.getTime();
			if (Number.isNaN(ms)) {
				return false;
			}

			const rowSec = Math.floor(ms / 1000);
			return rowSec >= range.fromSec && rowSec <= range.toSec;
		})
		.map((r) => ({
			from: r.fromOwner,
			to: r.toOwner,
			amount: r.amount,
			timestamp: toIsoTimestamp(r.blockTime),
			tokenAddress: r.tokenAddress,
			tokenSymbol: r.tokenSymbol,
			transactionSignature: r.transactionSignature,
			instructionIndex: r.instructionIndex,
		}));
}

export async function getCachedWalletSwaps(
	address: string,
	from: "24h" | "7d" | CachedRange = "7d",
): Promise<WalletSwap[] | null> {
	const swapThreshold = new Date(Date.now() - WALLET_SWAPS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, swapThreshold, "swaps");
	if (!isFresh) {
		return null;
	}

	const range = resolveRange(from);

	const rows = await db
		.select()
		.from(walletSwap)
		.where(
			eq(walletSwap.address, address)
		)
		.orderBy(desc(walletSwap.blockTimestamp));

	if (rows.length === 0) {
		return null;
	}

	return rows
		.filter((r) => {
			const rowDate = r.blockTimestamp instanceof Date ? r.blockTimestamp : new Date(r.blockTimestamp);
			const ms = rowDate.getTime();
			if (Number.isNaN(ms)) {
				return false;
			}

			const rowSec = Math.floor(ms / 1000);
			return rowSec >= range.fromSec && rowSec <= range.toSec;
		})
		.map((r) => ({
			walletAddress: r.address,
			signature: r.signature,
			timestamp: toIsoTimestamp(r.blockTimestamp),
			slot: r.slot,
			fee: r.fee,
			feePayer: r.feePayer,
			transactionType: r.transactionType ?? null,
			subCategory: r.subCategory ?? null,
			blockNumber: r.blockNumber != null ? Number(r.blockNumber) : null,
			exchange: r.exchange ?? null,
			pair: r.pair ?? null,
			sold: r.sold ?? null,
			bought: r.bought ?? null,
			baseQuotePrice: toNullableFiniteNumber(r.baseQuotePrice),
			totalValueUsd: toNullableFiniteNumber(r.totalValueUsd),
			source: r.source ?? undefined,
			balanceChanges: r.swapBalanceChanges,
			feeChanges: r.feeBalanceChanges,
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

	const rows = await db
		.select()
		.from(tokenTransfers)
		.where(
			or(eq(tokenTransfers.fromOwner, address), eq(tokenTransfers.toOwner, address)),
		)
		.orderBy(
			desc(tokenTransfers.blockTime),
			desc(tokenTransfers.transactionSignature),
			desc(tokenTransfers.instructionIndex),
		);

	const mapped = rows.map((r) => ({
		from: r.fromOwner,
		to: r.toOwner,
		amount: r.amount,
		timestamp: toIsoTimestamp(r.blockTime),
		tokenAddress: r.tokenAddress,
		tokenSymbol: r.tokenSymbol,
		transactionSignature: r.transactionSignature,
		instructionIndex: r.instructionIndex,
	}));

	const cursor = String(options?.cursor ?? "").trim();
	let startIndex = 0;

	if (cursor) {
		const matchIndex = mapped.findIndex(
			(item) =>
				item.transactionSignature === cursor ||
				`${item.transactionSignature}:${item.instructionIndex}` === cursor,
		);

		if (matchIndex < 0) {
			return {
				available: true,
				cursorMatched: false,
				items: [],
				nextCursor: null,
				hasMore: false,
			};
		}

		startIndex = matchIndex + 1;
	}

	const pageItems = mapped.slice(startIndex, startIndex + limit);
	const hasMore = startIndex + limit < mapped.length;
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

	const rows = await db
		.select()
		.from(walletSwap)
		.where(
			eq(walletSwap.address, address)
		)
		.orderBy(desc(walletSwap.blockTimestamp), desc(walletSwap.signature));

	const mapped = rows.map((r) => ({
		walletAddress: r.address,
		signature: r.signature,
		timestamp: toIsoTimestamp(r.blockTimestamp),
		slot: r.slot,
		fee: r.fee,
		feePayer: r.feePayer,
		transactionType: r.transactionType ?? null,
		subCategory: r.subCategory ?? null,
		blockNumber: r.blockNumber != null ? Number(r.blockNumber) : null,
		exchange: r.exchange ?? null,
		pair: r.pair ?? null,
		sold: r.sold ?? null,
		bought: r.bought ?? null,
		baseQuotePrice: toNullableFiniteNumber(r.baseQuotePrice),
		totalValueUsd: toNullableFiniteNumber(r.totalValueUsd),
		source: r.source ?? undefined,
		balanceChanges: r.swapBalanceChanges,
		feeChanges: r.feeBalanceChanges,
	}));

	const before = String(options?.before ?? "").trim();
	let startIndex = 0;

	if (before) {
		const matchIndex = mapped.findIndex((item) => item.signature === before);
		if (matchIndex < 0) {
			return {
				available: true,
				cursorMatched: false,
				items: [],
				nextCursor: null,
				hasMore: false,
			};
		}

		startIndex = matchIndex + 1;
	}

	const pageItems = mapped.slice(startIndex, startIndex + limit);
	const hasMore = startIndex + limit < mapped.length;
	const nextCursor =
		hasMore && pageItems.length > 0
			? pageItems[pageItems.length - 1].signature
			: null;

	return {
		available: true,
		cursorMatched: true,
		items: pageItems,
		nextCursor,
		hasMore,
	};
}
