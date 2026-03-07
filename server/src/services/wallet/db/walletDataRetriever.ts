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
	limit: number,
): Promise<WalletTransactionHelius[] | null> {
	const txThreshold = new Date(Date.now() - WALLET_TRANSACTIONS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, chain, txThreshold, "transactions");
	if (!isFresh) {
		return null;
	}

	const rows = await db
		.select()
		.from(walletHeliusTransactions)
		.where(
			and(
				eq(walletHeliusTransactions.address, address),
				eq(walletHeliusTransactions.chain, chain),
			),
		)
		.orderBy(desc(walletHeliusTransactions.timestamp))
		.limit(limit);

	if (rows.length === 0) {
		return null;
	}

	return rows.map((r) => ({
		walletAddress: r.address,
		signature: r.signature,
		timestamp: toIsoTimestamp(r.timestamp),
		slot: r.slot != null ? Number(r.slot) : 0,
		fee: r.fee != null ? Number(r.fee) : 0,
		feePayer: r.feePayer,
		balanceChanges: r.balanceChanges,
	}));
}

export async function getCachedWalletTransfers(
	address: string,
	chain: SupportedChain,
	limit: number,
): Promise<WalletTransfer[] | null> {
	const transferThreshold = new Date(Date.now() - WALLET_TRANSFERS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, chain, transferThreshold, "transfers");
	if (!isFresh) {
		return null;
	}

	const rows = await db
		.select()
		.from(tokenTransfers)
		.where(
			and(
				or(eq(tokenTransfers.fromOwner, address), eq(tokenTransfers.toOwner, address)),
				eq(tokenTransfers.chain, chain),
			),
		)
		.orderBy(desc(tokenTransfers.blockTime))
		.limit(limit);

	if (rows.length === 0) {
		return null;
	}

	return rows.map((r) => ({
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
	limit: number,
): Promise<WalletSwap[] | null> {
	const swapThreshold = new Date(Date.now() - WALLET_SWAPS_TTL_MS);
	const isFresh = await hasFreshWalletMeta(address, chain, swapThreshold, "swaps");
	if (!isFresh) {
		return null;
	}

	const rows = await db
		.select()
		.from(walletSwap)
		.where(and(eq(walletSwap.address, address), eq(walletSwap.chain, chain)))
		.orderBy(desc(walletSwap.blockTimestamp))
		.limit(limit);

	if (rows.length === 0) {
		return null;
	}

	return rows.map((r) => ({
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
