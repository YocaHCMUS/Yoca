import type {
  WalletExchangeCountsOptions,
  WalletExchangeCountsResponse,
  WalletPageInfo,
  WalletSwap,
  WalletSwapsQueryOptions,
  WalletSwapsResponse,
  WalletTimePeriod,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import {
  DEFAULT_EXCHANGE_LIMIT,
  MAX_EXCHANGE_LIMIT,
  WALLET_TABLE_PAGE_SIZE,
} from "@sv/services/wallet/wallet.constants.js";
import { roundUsd } from "@sv/services/wallet/walletNormalization.utils.js";
import { normalizeCursorValue } from "@sv/services/wallet/walletTime.utils.js";
import { getWalletSwaps } from "@sv/services/wallet/walletTransfersSwaps.service.js";
import { getWalletIdentity } from "./walletIdentity.service.js";

export type WalletSwapsPageFetcher = (
  address: string,
  from?: number,
  to?: number,
) => Promise<WalletSwapsResponse>;

type WalletExchangeAccumulator = {
  name: string;
  deposits: number;
  withdrawals: number;
  depositsVolume: number;
  withdrawalsVolume: number;
};

type WalletExchangePeriod = Exclude<WalletTimePeriod, "24H">;

function normalizeExchangeMetric(
  rawMetric?: "count" | "volume",
): "count" | "volume" {
  return rawMetric === "volume" ? "volume" : "count";
}

function normalizeExchangeBucketToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function toFiniteNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

async function resolveExchangeBucketFromSwap(
  swap: WalletSwap,
): Promise<{ key: string; name: string }> {
  const exchangeName = String(swap.exchangeName ?? "").trim();
  const exchangeAddress = String(swap.exchangeAddress ?? "").trim();
  // const exchangeName = String(swap.exchange?.name ?? "").trim();
  // const exchangeAddress = String(swap.exchange?.address ?? "").trim();
  if (exchangeName || exchangeAddress) {
    return {
      key: `exchange:${normalizeExchangeBucketToken(exchangeName)}:${normalizeExchangeBucketToken(exchangeAddress)}`,
      name: exchangeName || exchangeAddress,
    };
  }

  const pairAddress = String(swap.pairAddress ?? "").trim();
  if (pairAddress) {
    const pairIdentity = await getWalletIdentity(pairAddress);
    let pairLabel: string;
    if (pairIdentity.identity.status === "known") {
      pairLabel =
        pairIdentity.identity.name ??
        pairIdentity.identity.domainNames[0] ??
        pairAddress;
    } else {
      pairLabel = pairAddress;
    }

    return {
      key: `pair:${normalizeExchangeBucketToken(pairLabel)}:${normalizeExchangeBucketToken(pairAddress)}`,
      name: pairLabel,
    };
  }

  return {
    key: "unknown",
    name: "Unknown",
  };
}

function resolveSwapSideVolumes(swap: WalletSwap): {
  depositsVolume: number;
  withdrawalsVolume: number;
} {
  const hasBoughtLeg = swap.bought != null;
  const hasSoldLeg = swap.sold != null;

  let depositsVolume = toFiniteNonNegativeNumber(swap.bought?.valueUsd);
  let withdrawalsVolume = toFiniteNonNegativeNumber(swap.sold?.valueUsd);

  const hasDepositsVolume = depositsVolume > 0;
  const hasWithdrawalsVolume = withdrawalsVolume > 0;
  const totalValueUsd = toFiniteNonNegativeNumber(swap.totalValueUsd);

  if (totalValueUsd <= 0) {
    return { depositsVolume, withdrawalsVolume };
  }

  if (hasBoughtLeg && hasSoldLeg) {
    if (!hasDepositsVolume && !hasWithdrawalsVolume) {
      depositsVolume = totalValueUsd / 2;
      withdrawalsVolume = totalValueUsd / 2;
      return { depositsVolume, withdrawalsVolume };
    }

    if (!hasDepositsVolume) {
      depositsVolume = Math.max(0, totalValueUsd - withdrawalsVolume);
    }

    if (!hasWithdrawalsVolume) {
      withdrawalsVolume = Math.max(0, totalValueUsd - depositsVolume);
    }

    return { depositsVolume, withdrawalsVolume };
  }

  if (hasBoughtLeg && !hasDepositsVolume) {
    depositsVolume = totalValueUsd;
  }

  if (hasSoldLeg && !hasWithdrawalsVolume) {
    withdrawalsVolume = totalValueUsd;
  }

  return { depositsVolume, withdrawalsVolume };
}

function collapseSwapSources(
  sources: Set<WalletPageInfo["source"]>,
): WalletPageInfo["source"] {
  if (sources.size === 0) {
    return "mixed";
  }

  if (sources.has("mixed")) {
    return "mixed";
  }

  if (sources.size === 1) {
    const [single] = Array.from(sources);
    return single;
  }

  return "mixed";
}

async function collectWalletSwapsForExchangeAggregation(
  address: string,
  transactionLimit: number,
  fetchSwapsPage: WalletSwapsPageFetcher,
): Promise<{
  swaps: WalletSwap[];
  source: WalletPageInfo["source"];
  truncated: boolean;
}> {
  const page = await fetchSwapsPage(address);
  const swaps = page.swaps.slice(0, transactionLimit);
  const truncated = page.swaps.length > transactionLimit;

  return {
    swaps,
    source: page.pageInfo.source,
    truncated,
  };
}

function normalizeExchangePeriod(rawPeriod?: string): WalletExchangePeriod {
  const normalized = String(rawPeriod ?? "")
    .trim()
    .toUpperCase();
  if (
    normalized === "7D" ||
    normalized === "30D" ||
    normalized === "60D" ||
    normalized === "90D" ||
    normalized === "1Y" ||
    normalized === "ALL"
  ) {
    return normalized === "ALL" ? "All" : (normalized as WalletExchangePeriod);
  }

  return "30D";
}

function normalizeExchangeChain(rawChain?: string): string {
  const normalized = String(rawChain ?? "solana")
    .trim()
    .toLowerCase();
  return normalized || "solana";
}

export async function getWalletExchangeCountsWithFetcher(
  address: string,
  options: WalletExchangeCountsOptions | undefined,
  fetchSwapsPage: WalletSwapsPageFetcher,
): Promise<WalletExchangeCountsResponse> {
  const transactionLimit = Math.min(
    Math.max(Math.floor(options?.limit ?? DEFAULT_EXCHANGE_LIMIT), 1),
    MAX_EXCHANGE_LIMIT,
  );
  const period = normalizeExchangePeriod(options?.period);
  const chain = normalizeExchangeChain(options?.chain);
  const metric = normalizeExchangeMetric(options?.metric);

  console.log(`[getWalletExchangeCounts] Fetching swaps for ${address}. Options:`, { transactionLimit, period, chain, metric });

  const dataset = await collectWalletSwapsForExchangeAggregation(
    address,
    transactionLimit,
    fetchSwapsPage,
  );

  console.log(`[getWalletExchangeCounts] Collected ${dataset.swaps.length} swaps from dataset`);
  console.log(`[getWalletExchangeCounts] First 3 swaps structure:`, JSON.stringify(dataset.swaps.slice(0, 3), null, 2));

  const byBucket = new Map<string, WalletExchangeAccumulator>();
  const dedupe = new Set<string>();
  const walletLower = address.toLowerCase();

  for (const swap of dataset.swaps) {
    const signature = String(swap.transactionHash ?? "")
      .trim()
      .toLowerCase();
    if (!signature) {
      console.log("[getWalletExchangeCounts] Skipping swap without signature");
      continue;
    }

    const bucket = await resolveExchangeBucketFromSwap(swap);
    const dedupeKey = `${walletLower}:${signature}:${bucket.key}`;
    if (dedupe.has(dedupeKey)) {
      continue;
    }
    dedupe.add(dedupeKey);

    const accumulator = byBucket.get(bucket.key) ?? {
      name: bucket.name,
      deposits: 0,
      withdrawals: 0,
      depositsVolume: 0,
      withdrawalsVolume: 0,
    };

    const { depositsVolume, withdrawalsVolume } = resolveSwapSideVolumes(swap);

    const transactionType = swap.transactionType;
    console.log(`[getWalletExchangeCounts] Processing swap - exchangeName: ${swap.exchangeName}, transactionType: ${transactionType}, bought.valueUsd: ${swap.bought?.valueUsd}, sold.valueUsd: ${swap.sold?.valueUsd}`);

    if (transactionType === "buy") {
      accumulator.deposits += 1;
      accumulator.depositsVolume += depositsVolume;
    } else if (transactionType === "sell") {
      accumulator.withdrawals += 1;
      accumulator.withdrawalsVolume += withdrawalsVolume;
    } else {
      console.log(`[getWalletExchangeCounts] Unknown transaction type: ${transactionType}`);
    }

    byBucket.set(bucket.key, accumulator);
  }

  const exchanges = Array.from(byBucket.values())
    .sort((a, b) => {
      const interactionDiff =
        b.deposits + b.withdrawals - (a.deposits + a.withdrawals);
      if (interactionDiff !== 0) {
        return interactionDiff;
      }

      const volumeDiff =
        b.depositsVolume +
        b.withdrawalsVolume -
        (a.depositsVolume + a.withdrawalsVolume);
      if (volumeDiff !== 0) {
        return volumeDiff;
      }

      return a.name.localeCompare(b.name);
    })
    .map((item) => ({
      ...item,
      depositsVolume: roundUsd(item.depositsVolume),
      withdrawalsVolume: roundUsd(item.withdrawalsVolume),
    }));

  const response: WalletExchangeCountsResponse = {
    exchanges,
    metadata: {
      period,
      chain,
      metric,
      source: dataset.source,
      limit: transactionLimit,
      truncated: dataset.truncated,
    },
  };

  console.log(`[getWalletExchangeCounts] FINAL RESPONSE - exchanges count: ${exchanges.length}`, JSON.stringify(response, null, 2));

  return response;
}

export async function getWalletExchangeCounts(
  address: string,
  options?: WalletExchangeCountsOptions,
): Promise<WalletExchangeCountsResponse> {
  return getWalletExchangeCountsWithFetcher(address, options, getWalletSwaps);
}
