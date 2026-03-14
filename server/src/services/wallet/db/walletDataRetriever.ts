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
	SupportedChain,
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

function getChainCandidates(chain: SupportedChain): string[] {
	const raw = String(chain ?? "").trim();
	if (!raw) {
		return ["solana"];
	}

	const lower = raw.toLowerCase();
	const title = lower.charAt(0).toUpperCase() + lower.slice(1);
	return Array.from(new Set([raw, lower, title]));
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

async function getTransactionMetaRows(address: string, chain: SupportedChain) {
	return await db
		.select()
		.from(walletTransactionsMeta)
		.where(
			and(
				eq(walletTransactionsMeta.address, address),
				eq(walletTransactionsMeta.chain, chain),
			),
		)
		.limit(1);
}

async function getTransferMetaRows(address: string, chain: SupportedChain) {
	return await db
		.select()
		.from(walletTransferMeta)
		.where(
			and(
				eq(walletTransferMeta.address, address),
				eq(walletTransferMeta.chain, chain),
			),
		)
		.limit(1);
}

async function getSwapMetaRows(address: string, chain: SupportedChain) {
	return await db
		.select()
		.from(walletSwapMeta)
		.where(
			and(
				eq(walletSwapMeta.address, address),
				eq(walletSwapMeta.chain, chain),
			),
		)
		.limit(1);
}

async function hasFreshWalletMeta(
	address: string,
	chain: SupportedChain,
	threshold: Date,
	type: "transfers" | "swaps" | "transactions"
): Promise<boolean> {
	if (type === "transfers") {
		const metaRows = await getTransferMetaRows(address, chain);
		return metaRows.length > 0 && metaRows[0].fetchedAt >= threshold;
	} else if (type === "swaps") {
		const metaRows = await getSwapMetaRows(address, chain);
		return metaRows.length > 0 && metaRows[0].fetchedAt >= threshold;
	} else if (type === "transactions") {
		const metaRows = await getTransactionMetaRows(address, chain);
		return metaRows.length > 0 && metaRows[0].fetchedAt >= threshold;
	}

	return false;

}

export async function getCachedWalletTransactions(
	address: string,
	chain: SupportedChain,
	limit: number,
): Promise<WalletTransaction[] | null> {
	const txThreshold = new Date(Date.now() - WALLET_TRANSACTIONS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, chain, txThreshold, "transactions");
	if (!isFresh) {
		return null;
	}

	const rows = await db
		.select()
		.from(walletTransactions)
		.where(
			and(
				eq(walletTransactions.address, address),
				eq(walletTransactions.chain, chain),
			),
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
	chain: SupportedChain,
	range: CachedRange | "24h" | "7d" = "7d",
): Promise<CachedWalletTransactionsHeliusRangeResult> {
	const requestedRange = resolveRange(range);
	const chainCandidates = getChainCandidates(chain);
	const chainCondition =
		chainCandidates.length === 1
			? eq(walletHeliusTransactions.chain, chainCandidates[0])
			: or(...chainCandidates.map((candidate) => eq(walletHeliusTransactions.chain, candidate)));

	// ------------------------------------------------------------------
	// Bug 1 & 2 fix: determine coverage from the persisted meta bounds,
	// NOT from min/max of transaction timestamps.  Transaction timestamps
	// are unreliable for sparse wallets and will produce false head/tail
	// gaps on every request.
	// ------------------------------------------------------------------
	const canonicalChain = chainCandidates.find((candidate) => candidate === candidate.toLowerCase()) ?? chainCandidates[0];
	let metaRows = await db
		.select()
		.from(walletTransactionsMeta)
		.where(
			and(
				eq(walletTransactionsMeta.address, address),
				eq(walletTransactionsMeta.chain, canonicalChain),
			),
		)
		.limit(1);

	if (metaRows.length === 0) {
		const legacyChainCandidates = chainCandidates.filter((candidate) => candidate !== canonicalChain);
		if (legacyChainCandidates.length > 0) {
			const legacyChainCondition =
				legacyChainCandidates.length === 1
					? eq(walletTransactionsMeta.chain, legacyChainCandidates[0])
					: or(
						...legacyChainCandidates.map((candidate) =>
							eq(walletTransactionsMeta.chain, candidate),
						),
					);

			metaRows = await db
				.select()
				.from(walletTransactionsMeta)
				.where(
					and(
						eq(walletTransactionsMeta.address, address),
						legacyChainCondition,
					),
				)
				.orderBy(desc(walletTransactionsMeta.fetchedAt))
				.limit(1);
		}
	}

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
			and(
				eq(walletHeliusTransactions.address, address),
				chainCondition,
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
	chain: SupportedChain,
	from: "24h" | "7d" | CachedRange = "7d",
): Promise<WalletTransfer[] | null> {
	const transferThreshold = new Date(Date.now() - WALLET_TRANSFERS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, chain, transferThreshold, "transfers");
	if (!isFresh) {
		return null;
	}

	const range = resolveRange(from);

	const rows = await db
		.select()
		.from(tokenTransfers)
		.where(
			and(
				or(eq(tokenTransfers.fromOwner, address), eq(tokenTransfers.toOwner, address)),
				eq(tokenTransfers.chain, chain),
			),
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
	chain: SupportedChain,
	from: "24h" | "7d" | CachedRange = "7d",
): Promise<WalletSwap[] | null> {
	const swapThreshold = new Date(Date.now() - WALLET_SWAPS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, chain, swapThreshold, "swaps");
	if (!isFresh) {
		return null;
	}

	const range = resolveRange(from);

	const rows = await db
		.select()
		.from(walletSwap)
		.where(and(eq(walletSwap.address, address), eq(walletSwap.chain, chain)))
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
			balanceChanges: r.swapBalanceChanges,
			feeChanges: r.feeBalanceChanges,
		}));
}
