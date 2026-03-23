import type { WalletSwap, WalletTransfer } from "@sv/services/wallet/dtos/walletDataObjects.js";

export function getNextCursor(pagination: any): string | null {
    const raw = pagination?.nextCursor;
    if (typeof raw !== "string") return null;
    return raw.length > 0 ? raw : null;
}

export function getMoralisCursor(payload: any): string | null {
    const candidates = [
        payload?.cursor,
        payload?.nextCursor,
        payload?.pagination?.cursor,
        payload?.pagination?.nextCursor,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.length > 0) {
            return candidate;
        }
    }

    return null;
}

export function getTokenLogoUri(token: any): string | undefined {
    const rawLogo = token?.logoURI ?? token?.logoUri ?? token?.logo_uri ?? token?.image;
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
        const normalized = value.trim().replace(
            /(\.\d{3})\d+(Z|[+-]\d{2}:?\d{2})$/,
            "$1$2",
        );
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    return null;
}

export function mapHeliusTransferEntry(entry: any, address: string): WalletTransfer | null {
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

    const amount = toTokenAmount(entry.amountRaw, entry.decimal ?? entry.decimals, entry.amount);

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

export function mapHeliusSwapEntry(entry: any, address: string): WalletSwap | null {
    const tsSec =
        typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
            ? entry.timestamp
            : null;
    if (tsSec == null) {
        return null;
    }

    const signature = String(entry.signature ?? "").trim();
    if (!signature) {
        return null;
    }

    const mappedBalanceChanges = Array.isArray(entry.balanceChanges)
        ? entry.balanceChanges
            .map((change: any) => ({
                mint: String(change?.mint ?? ""),
                amount: Number(change?.amount ?? 0),
                decimals: Number(change?.decimals ?? 0),
            }))
            .filter(
                (change: { mint: string; amount: number; decimals: number }) =>
                    change.mint.length > 0 &&
                    Number.isFinite(change.amount) &&
                    Number.isFinite(change.decimals),
            )
        : [];

    const swapBalanceChanges = mappedBalanceChanges.slice(0, 2);
    const swapFeeBalanceChanges = mappedBalanceChanges.slice(2);

    return {
        walletAddress: address,
        signature,
        timestamp: new Date(tsSec * 1000).toISOString(),
        slot: Number(entry.slot ?? 0),
        fee: Number(entry.fee ?? 0),
        feePayer: String(entry.feePayer ?? ""),
        balanceChanges: swapBalanceChanges,
        feeChanges: swapFeeBalanceChanges,
    };
}

function mapMoralisLeg(raw: any): WalletSwap["sold"] {
    if (raw == null || typeof raw !== "object") {
        return null;
    }

    const mint = String(raw.address ?? raw.tokenAddress ?? raw.mint ?? "").trim();
    if (!mint) {
        return null;
    }

    const amount = Math.abs(toFiniteNumber(raw.amount ?? raw.amountRaw, 0));
    const decimals = Math.max(0, Math.floor(toFiniteNumber(raw.decimals ?? raw.decimal, 0)));

    return {
        mint,
        amount,
        decimals,
        symbol: raw.symbol ?? null,
        priceUsd: toOptionalNumber(raw.usdPrice ?? raw.priceUsd),
        valueUsd: toOptionalNumber(raw.usdAmount ?? raw.valueUsd),
    };
}

function mapMoralisSwapExchange(entry: any): WalletSwap["exchange"] {
    const nested = entry?.exchange;

    const name = String(
        nested?.name ?? entry.exchangeName ?? entry.exchange_name ?? "",
    ).trim();
    const address = String(
        nested?.address ?? entry.exchangeAddress ?? entry.exchange_address ?? "",
    ).trim();
    const logo = String(
        nested?.logo ?? entry.exchangeLogo ?? entry.exchange_logo ?? "",
    ).trim();

    if (!name && !address && !logo) {
        return null;
    }

    return {
        name: name || null,
        address: address || null,
        logo: logo || null,
    };
}

function mapMoralisSwapPair(entry: any): WalletSwap["pair"] {
    const nested = entry?.pair;

    const address = String(
        nested?.address ?? nested?.pairAddress ?? entry.pairAddress ?? entry.pair_address ?? "",
    ).trim();
    const label = String(
        nested?.label ?? entry.pairLabel ?? entry.pair_label ?? "",
    ).trim();
    const baseTokenAddress = String(
        nested?.baseTokenAddress ?? entry.baseToken ?? entry.base_token ?? "",
    ).trim();
    const quoteTokenAddress = String(
        nested?.quoteTokenAddress ?? entry.quoteToken ?? entry.quote_token ?? "",
    ).trim();

    if (!address && !label && !baseTokenAddress && !quoteTokenAddress) {
        return null;
    }

    return {
        address: address || null,
        label: label || null,
        baseTokenAddress: baseTokenAddress || null,
        quoteTokenAddress: quoteTokenAddress || null,
    };
}

export function mapMoralisSwapEntry(entry: any, address: string): WalletSwap | null {
    const signature = String(
        entry.transactionHash ?? entry.transaction_hash ?? entry.signature ?? "",
    ).trim();

    if (!signature) {
        return null;
    }

    const timestamp = toIsoTimestamp(
        entry.blockTimestamp ?? entry.block_timestamp ?? entry.blockTime ?? entry.block_time,
    );
    if (!timestamp) {
        return null;
    }

    const sold = mapMoralisLeg(entry.sold);
    const bought = mapMoralisLeg(entry.bought);

    const balanceChanges = [
        sold ? { ...sold, amount: -Math.abs(sold.amount) } : null,
        bought ? { ...bought, amount: Math.abs(bought.amount) } : null,
    ].filter((item): item is NonNullable<WalletSwap["sold"]> => item != null);

    const blockNumber = toOptionalNumber(entry.blockNumber ?? entry.block_number);

    const slot = toOptionalNumber(entry.slot) ?? blockNumber ?? 0;

    return {
        walletAddress: address,
        signature,
        timestamp,
        slot,
        fee: toOptionalNumber(entry.fee ?? entry.transactionFee ?? entry.transaction_fee) ?? 0,
        feePayer: String(entry.feePayer ?? entry.fee_payer ?? address),
        transactionType: entry.transactionType ?? entry.transaction_type ?? null,
        subCategory: entry.subCategory ?? entry.sub_category ?? null,
        blockNumber,
        exchange: mapMoralisSwapExchange(entry),
        pair: mapMoralisSwapPair(entry),

        sold,
        bought,
        baseQuotePrice: toOptionalNumber(entry.baseQuotePrice ?? entry.base_quote_price),
        totalValueUsd: toOptionalNumber(entry.totalValueUsd ?? entry.total_value_usd),
        source: "moralis",
        balanceChanges,
        feeChanges: [],
    };
}
