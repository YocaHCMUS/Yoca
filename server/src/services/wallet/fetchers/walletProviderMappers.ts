import type {
  WalletSwap,
  WalletTransfer,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import {
  MoralisSwapResult,
  MoralisTradeLeg,
} from "./walletThirdPartyResponses.js";

export function getNextCursor(pagination: any): string | null {
  const raw = pagination?.nextCursor;
  if (typeof raw !== "string") return null;
  return raw.length > 0 ? raw : null;
}

export function getTokenLogoUri(token: any): string | undefined {
  const rawLogo =
    token?.logoURI ?? token?.logoUri ?? token?.logo_uri ?? token?.image;
  if (rawLogo == null) {
    return undefined;
  }

  const normalized = String(rawLogo).trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function toOptionalNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toTokenAmount(
  amountRaw: unknown,
  decimalsRaw: unknown,
  fallbackAmount: unknown,
): number {
  const numericRaw = toOptionalNumber(amountRaw);
  const numericDecimals = toOptionalNumber(decimalsRaw);

  if (numericRaw != null && numericDecimals != null) {
    return numericRaw / 10 ** Math.max(0, numericDecimals);
  }

  return toFiniteNumber(fallbackAmount, 0);
}

export function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/(\.\d{3})\d+(Z|[+-]\d{2}:?\d{2})$/, "$1$2");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  return null;
}

export function mapHeliusTransferEntry(
  entry: any,
  address: string,
): WalletTransfer | null {
  const tsSec =
    typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
      ? entry.timestamp
      : null;
  if (tsSec == null) {
    return null;
  }

  const direction = String(entry.direction ?? "").toLowerCase();
  const counterparty = String(entry.counterparty ?? "");

  const from = direction === "in" ? counterparty : address;
  const to = direction === "in" ? address : counterparty;

  const transactionSignature = String(entry.signature ?? "").trim();
  if (!transactionSignature) {
    return null;
  }

  const amount = toTokenAmount(
    entry.amountRaw,
    entry.decimal ?? entry.decimals,
    entry.amount,
  );

  return {
    from,
    to,
    amount,
    timestamp: new Date(tsSec * 1000).toISOString(),
    tokenAddress: String(entry.mint ?? "unknown"),
    tokenSymbol: String(entry.symbol ?? "unknown"),
    transactionSignature,
    instructionIndex: 0,
  };
}

export function mapMoralisSwapEntry(
  entry: MoralisSwapResult,
  address: string,
): WalletSwap | null {
  // Map Moralis swap entry to WalletSwap structure
  const transactionHash = String(entry.transactionHash ?? "").trim();
  if (!transactionHash) {
    return null;
  }

  const blockTimestampIso = toIsoTimestamp(entry.blockTimestamp);
  if (!blockTimestampIso) {
    return null;
  }

  const mapToken = (raw: MoralisTradeLeg | null) => {
    if (!raw) return null;
    const address = String(raw.address ?? "").trim();
    if (!address) return null;
    return {
      address,
      amount: toFiniteNumber(raw.amount, 0),
      symbol: raw.symbol ?? null,
      name: raw.name ?? null,
      logoUri: raw.logo ?? null,
      priceUsd: toFiniteNumber(raw.usdPrice, 0),
      valueUsd: toFiniteNumber(raw.usdAmount, 0),
    };
  };

  const bought = mapToken(entry.bought);
  const sold = mapToken(entry.sold);

  if (!bought || !sold) {
    return null;
  }

  return {
    transactionHash,
    transactionType: entry.transactionType,
    blockTimestampIso,
    subcategory: entry.subCategory,
    walletAddress: address,
    pairAddress: entry.pairAddress,
    tokensInvolved: entry.pairLabel,
    bought,
    sold,
    totalValueUsd: toOptionalNumber(entry.totalValueUsd),
    baseQuotePrice: toOptionalNumber(entry.baseQuotePrice),
  };
}
