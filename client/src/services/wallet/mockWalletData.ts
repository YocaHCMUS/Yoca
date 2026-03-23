import type {
    WalletCounterpartiesResponse,
    WalletOverviewMultiPeriodResponse,
    WalletOverviewPeriodKey,
    WalletPortfolioItem,
    WalletSwapsResponse,
    WalletTransfersResponse,
} from "@/services/wallet/walletApi";
import type {
    AssetDistributionResponse,
    BalanceTrendResponse,
    CounterpartyActivityResponse,
    ExchangeComparisonResponse,
    PnLChartResponse,
} from "@/types/chart-api.types";

const MOCK_NOW = Date.UTC(2026, 2, 23, 12, 0, 0);
const PAGE_SIZE = 100 as const;

type WalletScenario = "empty" | "single-token" | "multi-wallet" | "high-activity";

type TokenDef = {
    symbol: string;
    tokenAddress: string;
    name: string;
    logoUri: string;
    decimals: number;
    basePriceUsd: number;
};

type WalletProfile = {
    address: string;
    scenario: WalletScenario;
    seed: number;
    tokens: TokenDef[];
    activityCount: number;
    identity: {
        status: "known" | "unknown" | "unavailable";
        name: string | null;
        category: string | null;
        type: string | null;
    };
};

const TOKENS: TokenDef[] = [
    {
        symbol: "SOL",
        tokenAddress: "So11111111111111111111111111111111111111112",
        name: "Solana",
        logoUri: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
        decimals: 9,
        basePriceUsd: 162,
    },
    {
        symbol: "USDC",
        tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        name: "USD Coin",
        logoUri: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
        decimals: 6,
        basePriceUsd: 1,
    },
    {
        symbol: "JUP",
        tokenAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
        name: "Jupiter",
        logoUri: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
        decimals: 6,
        basePriceUsd: 0.96,
    },
    {
        symbol: "BONK",
        tokenAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6zv6r4rJjP6y8Y6",
        name: "Bonk",
        logoUri: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
        decimals: 5,
        basePriceUsd: 0.000029,
    },
];

function hashString(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
}

function seededUnit(seed: number, offset = 0): number {
    let x = (seed + offset * 2654435761) >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967295;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function parseCursor(cursor?: string): number {
    if (!cursor) {
        return 0;
    }
    const match = cursor.match(/(\d+)$/);
    if (!match) {
        return 0;
    }
    return Number.parseInt(match[1], 10) || 0;
}

function toCursor(page: number): string {
    return `mock:${page}`;
}

function normalizeAddress(address: string): string {
    return address.trim() || "unknown-wallet";
}

function walletLabel(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function periodToDays(period?: string): number {
    switch ((period ?? "30D").toUpperCase()) {
        case "24H":
            return 1;
        case "7D":
            return 7;
        case "30D":
            return 30;
        case "90D":
            return 90;
        case "ALL":
            return 365;
        default:
            return 30;
    }
}

function resolveScenario(address: string, seed: number): WalletScenario {
    const lower = address.toLowerCase();
    if (lower.includes("empty")) {
        return "empty";
    }
    if (lower.includes("single")) {
        return "single-token";
    }
    if (lower.includes("multi")) {
        return "multi-wallet";
    }
    if (lower.includes("active")) {
        return "high-activity";
    }

    const index = seed % 4;
    if (index === 0) {
        return "empty";
    }
    if (index === 1) {
        return "single-token";
    }
    if (index === 2) {
        return "multi-wallet";
    }
    return "high-activity";
}

function buildProfile(address: string): WalletProfile {
    const normalized = normalizeAddress(address);
    const seed = hashString(normalized.toLowerCase());
    const scenario = resolveScenario(normalized, seed);

    const tokenCount =
        scenario === "empty" ? 0 : scenario === "single-token" ? 1 : scenario === "multi-wallet" ? 3 : 4;
    const tokens = TOKENS.slice(0, tokenCount);

    const activityCount =
        scenario === "empty" ? 0 : scenario === "single-token" ? 12 : scenario === "multi-wallet" ? 42 : 280;

    const known = seededUnit(seed, 4) > 0.25;
    const identity = known
        ? {
            status: "known" as const,
            name: `Entity ${walletLabel(normalized)}`,
            category: scenario === "high-activity" ? "exchange" : "trader",
            type: scenario === "high-activity" ? "institution" : "individual",
        }
        : {
            status: "unknown" as const,
            name: null,
            category: null,
            type: null,
        };

    return {
        address: normalized,
        scenario,
        seed,
        tokens,
        activityCount,
        identity,
    };
}

function tokenAmount(profile: WalletProfile, token: TokenDef, index: number): number {
    const u = seededUnit(profile.seed, 100 + index);
    const base = profile.scenario === "single-token" ? 1800 : profile.scenario === "high-activity" ? 900 : 320;
    const amount = base * (0.7 + u * 1.8);
    return Number(amount.toFixed(token.symbol === "USDC" ? 2 : 4));
}

function tokenPrice(profile: WalletProfile, token: TokenDef, index: number): number {
    const drift = (seededUnit(profile.seed, 200 + index) - 0.5) * 0.22;
    return Number((token.basePriceUsd * (1 + drift)).toFixed(token.basePriceUsd < 1 ? 6 : 2));
}

function createTimelinePoints(seed: number, days: number, base: number, spread: number): Array<{ timestamp: number; value: number }> {
    const points: Array<{ timestamp: number; value: number }> = [];
    const count = clamp(days, 8, 120);
    const step = Math.floor((days * 24 * 60 * 60 * 1000) / count);
    let value = base;

    for (let i = 0; i < count; i += 1) {
        const t = MOCK_NOW - (count - i) * step;
        const wave = Math.sin((i / Math.max(1, count - 1)) * Math.PI * 4);
        const noise = seededUnit(seed, i + 1) - 0.5;
        value = Math.max(0, value + wave * spread * 0.35 + noise * spread);
        points.push({
            timestamp: t,
            value: Number(value.toFixed(2)),
        });
    }

    return points;
}

export function getWalletMockScenario(address: string): WalletScenario {
    return buildProfile(address).scenario;
}

export function generateMockWalletPortfolio(address: string): WalletPortfolioItem[] {
    const profile = buildProfile(address);
    if (profile.scenario === "empty") {
        return [];
    }

    return profile.tokens.map((token, index) => {
        const amount = tokenAmount(profile, token, index);
        const priceUsd = tokenPrice(profile, token, index);
        return {
            tokenAddress: token.tokenAddress,
            symbol: token.symbol,
            name: token.name,
            logoUri: token.logoUri,
            amount,
            priceUsd,
            valueUsd: Number((amount * priceUsd).toFixed(2)),
            change24hPercent: Number((((seededUnit(profile.seed, 50 + index) - 0.45) * 32)).toFixed(2)),
        };
    });
}

export function generateMockWalletOverview(address: string): WalletOverviewMultiPeriodResponse {
    const profile = buildProfile(address);
    const portfolio = generateMockWalletPortfolio(address);
    const totalAssetValueUsd = Number(portfolio.reduce((sum, item) => sum + item.valueUsd, 0).toFixed(2));

    const periodKeys: WalletOverviewPeriodKey[] = ["24H", "7D", "30D", "90D", "All"];
    const periods = periodKeys.reduce<WalletOverviewMultiPeriodResponse["periods"]>((acc, key, index) => {
        const mult = [0.08, 0.26, 0.55, 0.84, 1.1][index];
        const txCount = profile.activityCount === 0 ? 0 : Math.round(profile.activityCount * mult);
        const volume = Number((totalAssetValueUsd * (0.3 + mult * 0.9)).toFixed(2));
        const realized = Number((volume * (seededUnit(profile.seed, 500 + index) - 0.35)).toFixed(2));
        const unrealized = Number((totalAssetValueUsd * (seededUnit(profile.seed, 600 + index) - 0.45)).toFixed(2));

        acc[key] = {
            tradingVolumeUsd: profile.activityCount === 0 ? null : volume,
            buy: {
                transactionCount: profile.activityCount === 0 ? null : Math.max(0, Math.round(txCount * 0.54)),
                volumeUsd: profile.activityCount === 0 ? null : Number((volume * 0.58).toFixed(2)),
            },
            sell: {
                transactionCount: profile.activityCount === 0 ? null : Math.max(0, Math.round(txCount * 0.46)),
                volumeUsd: profile.activityCount === 0 ? null : Number((volume * 0.42).toFixed(2)),
            },
            tokensTradedCount: profile.activityCount === 0 ? null : Math.max(1, profile.tokens.length),
            transactionCount: profile.activityCount === 0 ? null : txCount,
            pnl: {
                totalUsd: profile.activityCount === 0 ? null : Number((realized + unrealized).toFixed(2)),
                realizedUsd: profile.activityCount === 0 ? null : realized,
                unrealizedUsd: profile.activityCount === 0 ? null : unrealized,
            },
            source: "overview-cache",
        };
        return acc;
    }, {} as WalletOverviewMultiPeriodResponse["periods"]);

    const selectedPeriod: WalletOverviewPeriodKey = "24H";
    const selectedStats = periods[selectedPeriod];

    return {
        address: profile.address,
        availablePeriods: periodKeys,
        selectedPeriod,
        holdings: {
            totalAssetValueUsd,
            change24hPercent: profile.scenario === "empty" ? 0 : Number(((seededUnit(profile.seed, 700) - 0.5) * 12).toFixed(2)),
            tokensHoldingCount: portfolio.length,
            source: portfolio.length > 0 ? "overview-cache" : "none",
        },
        periods,
        legacy: {
            totalAssetValueUsd,
            tradingVolumeUsd24h: selectedStats.tradingVolumeUsd,
            pnlUsdTotal: selectedStats.pnl.totalUsd,
            transactionCount24h: selectedStats.transactionCount,
            tokensTradedCount: selectedStats.tokensTradedCount,
            tokensHoldingCount: portfolio.length,
            metricsPeriod: selectedPeriod,
        },
        totalAssetValueUsd,
        tradingVolumeUsd24h: selectedStats.tradingVolumeUsd,
        pnlUsdTotal: selectedStats.pnl.totalUsd,
        transactionCount24h: selectedStats.transactionCount,
        tokensTradedCount: selectedStats.tokensTradedCount,
        tokensHoldingCount: portfolio.length,
        tradingVolumeUsdWindow: selectedStats.tradingVolumeUsd,
        pnlUsdWindow: selectedStats.pnl.totalUsd,
        metricsPeriod: selectedPeriod,
    };
}

function buildSwap(profile: WalletProfile, index: number) {
    const soldToken = profile.tokens[index % Math.max(1, profile.tokens.length)] ?? TOKENS[0];
    const boughtToken = profile.tokens[(index + 1) % Math.max(1, profile.tokens.length)] ?? TOKENS[1];
    const soldAmount = Number((20 + seededUnit(profile.seed, 1000 + index) * 190).toFixed(4));
    const boughtAmount = Number((soldAmount * (tokenPrice(profile, soldToken, index) / tokenPrice(profile, boughtToken, index + 1))).toFixed(4));
    const soldPrice = tokenPrice(profile, soldToken, index);
    const boughtPrice = tokenPrice(profile, boughtToken, index + 1);
    const soldValue = Number((soldAmount * soldPrice).toFixed(2));

    const timestamp = new Date(MOCK_NOW - index * 60 * 60 * 1000).toISOString();
    const signature = `mock-swap-${profile.seed.toString(16)}-${index.toString(16).padStart(4, "0")}`;

    return {
        walletAddress: profile.address,
        signature,
        timestamp,
        slot: 280000000 + index,
        fee: Number((0.00001 + seededUnit(profile.seed, 4000 + index) * 0.00008).toFixed(8)),
        feePayer: profile.address,
        balanceChanges: [
            {
                mint: soldToken.tokenAddress,
                amount: -soldAmount,
                decimals: soldToken.decimals,
                symbol: soldToken.symbol,
                name: soldToken.name,
                logoUri: soldToken.logoUri,
                priceUsd: soldPrice,
                valueUsd: -soldValue,
            },
            {
                mint: boughtToken.tokenAddress,
                amount: boughtAmount,
                decimals: boughtToken.decimals,
                symbol: boughtToken.symbol,
                name: boughtToken.name,
                logoUri: boughtToken.logoUri,
                priceUsd: boughtPrice,
                valueUsd: Number((boughtAmount * boughtPrice).toFixed(2)),
            },
        ],
        feeChanges: [
            {
                mint: TOKENS[0].tokenAddress,
                amount: -0.00002,
                decimals: 9,
                symbol: "SOL",
                name: "Solana",
                logoUri: TOKENS[0].logoUri,
                priceUsd: TOKENS[0].basePriceUsd,
                valueUsd: -0.01,
            },
        ],
        transactionType: "swap",
        subCategory: "dex",
        blockNumber: 280000000 + index,
        exchange: {
            name: index % 2 === 0 ? "Jupiter" : "Raydium",
            address: `mock-ex-${(profile.seed + index).toString(16)}`,
            logo: null,
        },
        pair: {
            address: `mock-pair-${(profile.seed + index).toString(16)}`,
            label: `${soldToken.symbol}/${boughtToken.symbol}`,
            baseTokenAddress: soldToken.tokenAddress,
            quoteTokenAddress: boughtToken.tokenAddress,
        },
        sold: {
            mint: soldToken.tokenAddress,
            amount: soldAmount,
            decimals: soldToken.decimals,
            symbol: soldToken.symbol,
            name: soldToken.name,
            logoUri: soldToken.logoUri,
            priceUsd: soldPrice,
            valueUsd: soldValue,
        },
        bought: {
            mint: boughtToken.tokenAddress,
            amount: boughtAmount,
            decimals: boughtToken.decimals,
            symbol: boughtToken.symbol,
            name: boughtToken.name,
            logoUri: boughtToken.logoUri,
            priceUsd: boughtPrice,
            valueUsd: Number((boughtAmount * boughtPrice).toFixed(2)),
        },
        baseQuotePrice: Number((soldPrice / Math.max(0.0000001, boughtPrice)).toFixed(8)),
        totalValueUsd: soldValue,
        source: "mock",
    };
}

function buildTransfer(profile: WalletProfile, index: number) {
    const token = profile.tokens[index % Math.max(1, profile.tokens.length)] ?? TOKENS[0];
    const amount = Number((5 + seededUnit(profile.seed, 2200 + index) * 95).toFixed(4));
    const price = tokenPrice(profile, token, index);
    const outgoing = index % 2 === 0;

    return {
        from: outgoing ? profile.address : `mock-peer-${(profile.seed + index).toString(16)}`,
        to: outgoing ? `mock-peer-${(profile.seed + index + 99).toString(16)}` : profile.address,
        amount,
        amountUsd: Number((amount * price).toFixed(2)),
        timestamp: new Date(MOCK_NOW - index * 45 * 60 * 1000).toISOString(),
        tokenAddress: token.tokenAddress,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        tokenLogoUri: token.logoUri,
        priceUsd: price,
        transactionSignature: `mock-transfer-${profile.seed.toString(16)}-${index.toString(16).padStart(4, "0")}`,
        instructionIndex: index % 6,
    };
}

function paginate<T>(items: T[], page: number) {
    const offset = page * PAGE_SIZE;
    const sliced = items.slice(offset, offset + PAGE_SIZE);
    const hasMore = offset + PAGE_SIZE < items.length;
    return {
        sliced,
        hasMore,
        nextCursor: hasMore ? toCursor(page + 1) : null,
    };
}

export function generateMockWalletSwaps(address: string, cursor?: string): WalletSwapsResponse {
    const profile = buildProfile(address);
    const total = profile.activityCount;
    const swaps = Array.from({ length: total }, (_, i) => buildSwap(profile, i));
    const page = parseCursor(cursor);
    const { sliced, hasMore, nextCursor } = paginate(swaps, page);

    return {
        address: profile.address,
        chain: "solana",
        swaps: sliced,
        pageInfo: {
            pageSize: PAGE_SIZE,
            hasMore,
            nextCursor,
            source: "mixed",
        },
    };
}

export function generateMockWalletTransfers(address: string, cursor?: string): WalletTransfersResponse {
    const profile = buildProfile(address);
    const total = profile.activityCount;
    const transfers = Array.from({ length: total }, (_, i) => buildTransfer(profile, i));
    const page = parseCursor(cursor);
    const { sliced, hasMore, nextCursor } = paginate(transfers, page);

    return {
        address: profile.address,
        chain: "solana",
        transfers: sliced,
        pageInfo: {
            pageSize: PAGE_SIZE,
            hasMore,
            nextCursor,
            source: "mixed",
        },
    };
}

export function generateMockWalletCounterparties(address: string, period: "24h" | "7d" = "7d", limit = 50): WalletCounterpartiesResponse {
    const profile = buildProfile(address);
    const count = Math.min(limit, Math.max(0, profile.scenario === "empty" ? 0 : profile.scenario === "high-activity" ? 18 : 8));

    const counterparties = Array.from({ length: count }, (_, i) => {
        const tx = Math.max(1, Math.round((profile.activityCount / Math.max(1, count)) * (0.5 + seededUnit(profile.seed, 3000 + i))));
        const volume = Number((tx * (500 + seededUnit(profile.seed, 3500 + i) * 4200)).toFixed(2));
        const label = `Counterparty ${i + 1}`;
        return {
            address: `mock-cp-${profile.seed.toString(16)}-${i.toString(16)}`,
            identity: {
                status: i % 3 === 0 ? "known" : "unknown",
                name: i % 3 === 0 ? label : null,
                category: i % 3 === 0 ? "dex" : null,
                type: i % 3 === 0 ? "smart-contract" : null,
            },
            uniqueTokenCount: Math.max(1, Math.round(1 + seededUnit(profile.seed, 3300 + i) * profile.tokens.length)),
            tokens: profile.tokens.slice(0, Math.max(1, (i % Math.max(1, profile.tokens.length)) + 1)).map((t) => t.symbol),
            transactionCount: tx,
            totalVolumeUsd: volume,
        };
    });

    const byTransactionCount = [...counterparties]
        .sort((a, b) => b.transactionCount - a.transactionCount)
        .map((cp) => ({
            address: cp.address,
            label: cp.identity.name ?? walletLabel(cp.address),
            transactionCount: cp.transactionCount,
            totalVolumeUsd: cp.totalVolumeUsd,
        }));

    const byVolume = [...counterparties]
        .sort((a, b) => b.totalVolumeUsd - a.totalVolumeUsd)
        .map((cp) => ({
            address: cp.address,
            label: cp.identity.name ?? walletLabel(cp.address),
            transactionCount: cp.transactionCount,
            totalVolumeUsd: cp.totalVolumeUsd,
        }));

    return {
        counterparties,
        rankings: {
            byTransactionCount,
            byVolume,
        },
        metadata: {
            period,
            chain: "solana",
            source: "mixed",
            totals: {
                counterparties: counterparties.length,
                transactions: counterparties.reduce((sum, cp) => sum + cp.transactionCount, 0),
                volume: Number(counterparties.reduce((sum, cp) => sum + cp.totalVolumeUsd, 0).toFixed(2)),
            },
        },
    };
}

export function generateMockWalletIdentity(address: string) {
    const profile = buildProfile(address);
    return {
        address: profile.address,
        identity: profile.identity,
        source: "mock",
    };
}

export function generateMockWalletIntelligence(address: string) {
    const profile = buildProfile(address);
    return {
        address: profile.address,
        identity: profile.identity,
        analysis: {
            riskLevel: profile.scenario === "high-activity" ? "medium" : "low",
            confidence: Number((0.62 + seededUnit(profile.seed, 3900) * 0.33).toFixed(2)),
        },
        tags: [profile.scenario.replace("-", " "), "temp-mock"],
        source: "mock",
    };
}

export function generateMockWalletExchanges(address: string, metric: "count" | "volume" = "count", limit = 10) {
    const profile = buildProfile(address);
    const names = ["Jupiter", "Raydium", "Orca", "Meteora", "Phoenix", "Drift"];
    const rows = names.slice(0, Math.max(1, Math.min(limit, names.length))).map((name, i) => {
        const deposits = Math.round((5 + seededUnit(profile.seed, 4100 + i) * 70) * (profile.scenario === "high-activity" ? 3 : 1));
        const withdrawals = Math.round((4 + seededUnit(profile.seed, 4200 + i) * 65) * (profile.scenario === "high-activity" ? 2.6 : 1));
        const depositsVolume = Number((deposits * (220 + seededUnit(profile.seed, 4300 + i) * 1800)).toFixed(2));
        const withdrawalsVolume = Number((withdrawals * (210 + seededUnit(profile.seed, 4400 + i) * 1650)).toFixed(2));
        return { name, deposits, withdrawals, depositsVolume, withdrawalsVolume };
    });

    return {
        address: profile.address,
        metric,
        exchanges: rows,
        metadata: {
            source: "mock",
        },
    };
}

function parseWalletList(wallets?: string): string[] {
    if (!wallets) {
        return [];
    }
    return wallets
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

function parseTokenList(tokens?: string): string[] {
    if (!tokens) {
        return [];
    }
    return tokens
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
}

function resolveChartWallets(wallets?: string): string[] {
    const parsed = parseWalletList(wallets);
    if (parsed.length > 0) {
        return parsed;
    }
    return ["wallet-single-mock"];
}

export function generateMockBalanceChart(params: { wallets?: string; tokens?: string; timePeriod?: string; timezone?: string }): BalanceTrendResponse {
    const walletAddresses = resolveChartWallets(params.wallets);
    const tokenSymbols = parseTokenList(params.tokens);
    const days = periodToDays(params.timePeriod);
    const includeTokenMode = tokenSymbols.length > 0;

    const series = walletAddresses.flatMap((address, walletIndex) => {
        const profile = buildProfile(address);
        const portfolio = generateMockWalletPortfolio(address);
        const baseWalletValue = portfolio.reduce((sum, item) => sum + item.valueUsd, 0);
        const base = baseWalletValue > 0 ? baseWalletValue : 2000 + walletIndex * 700;

        if (!includeTokenMode) {
            return [
                {
                    name: walletAddresses.length > 1 ? walletLabel(address) : "All (USD)",
                    unit: "USD" as const,
                    seriesType: "line" as const,
                    data: createTimelinePoints(profile.seed + walletIndex * 37, days, base, Math.max(120, base * 0.03)),
                },
            ];
        }

        return tokenSymbols.map((symbol, tokenIndex) => {
            const token = TOKENS.find((t) => t.symbol === symbol);
            const tokenBase = token
                ? (portfolio.find((item) => item.symbol === symbol)?.valueUsd ?? base * (0.2 + tokenIndex * 0.12))
                : base * (0.15 + tokenIndex * 0.1);

            const displayName = walletAddresses.length > 1
                ? `${walletLabel(address)} ${symbol} (USD)`
                : `${symbol} (USD)`;

            return {
                name: displayName,
                unit: "USD" as const,
                seriesType: "line" as const,
                data: createTimelinePoints(profile.seed + tokenIndex * 19 + walletIndex * 31, days, tokenBase, Math.max(30, tokenBase * 0.08)),
            };
        });
    });

    const tokenMeta = tokenSymbols.reduce<Record<string, { symbol: string; logoUri?: string; tokenAddress?: string }>>((acc, symbol) => {
        const token = TOKENS.find((item) => item.symbol === symbol);
        acc[symbol] = {
            symbol,
            logoUri: token?.logoUri,
            tokenAddress: token?.tokenAddress,
        };
        return acc;
    }, {});

    const walletMeta = walletAddresses.reduce<Record<string, { label: string; identityName?: string }>>((acc, address) => {
        const profile = buildProfile(address);
        acc[address] = {
            label: walletLabel(address),
            identityName: profile.identity.name ?? undefined,
        };
        return acc;
    }, {});

    return {
        series,
        wallets: walletAddresses,
        metadata: {
            currency: "USD",
            timezone: params.timezone ?? "UTC",
            aggregation: days <= 7 ? "hourly" : "daily",
            mode: includeTokenMode ? "token" : "total",
            tokens: tokenSymbols,
            primaryYAxis: "USD",
            tokenMeta,
            walletMeta,
        },
    };
}

export function generateMockPnLChart(params: { wallets?: string; period?: string; aggregation?: "daily" | "weekly" | "monthly" }): PnLChartResponse {
    const walletAddresses = parseWalletList(params.wallets);
    const days = periodToDays(params.period);
    const pointDays = params.aggregation === "weekly" ? 7 : params.aggregation === "monthly" ? 30 : 1;
    const points = Math.max(8, Math.floor(days / pointDays));

    const buildSeries = (seed: number, baseScale: number) => {
        const dailyPnL = Array.from({ length: points }, (_, i) => {
            const timestamp = MOCK_NOW - (points - i) * pointDays * 24 * 60 * 60 * 1000;
            const wave = Math.sin((i / Math.max(1, points - 1)) * Math.PI * 3);
            const jitter = seededUnit(seed, i + 1) - 0.5;
            return {
                timestamp,
                value: Number((wave * baseScale + jitter * baseScale * 0.6).toFixed(2)),
            };
        });

        let running = 0;
        const cumulativePnL = dailyPnL.map((item) => {
            running += item.value;
            return {
                timestamp: item.timestamp,
                value: Number(running.toFixed(2)),
            };
        });

        return { dailyPnL, cumulativePnL };
    };

    if (walletAddresses.length > 1) {
        return {
            wallets: walletAddresses.map((address, index) => {
                const profile = buildProfile(address);
                const { dailyPnL, cumulativePnL } = buildSeries(profile.seed + index * 23, profile.scenario === "high-activity" ? 5200 : 1800);
                return {
                    walletAddress: address,
                    walletName: profile.identity.name ?? walletLabel(address),
                    dailyPnL,
                    cumulativePnL,
                    startBalance: 120000,
                    endBalance: Number((120000 + cumulativePnL[cumulativePnL.length - 1].value).toFixed(2)),
                };
            }),
            metadata: {
                currency: "USD",
            },
        };
    }

    const address = walletAddresses[0] ?? "wallet-single-mock";
    const profile = buildProfile(address);
    const { dailyPnL, cumulativePnL } = buildSeries(profile.seed, profile.scenario === "high-activity" ? 4200 : 1500);

    return {
        dailyPnL,
        cumulativePnL,
        metadata: {
            currency: "USD",
            startBalance: 100000,
            endBalance: Number((100000 + cumulativePnL[cumulativePnL.length - 1].value).toFixed(2)),
        },
    };
}

export function generateMockAssetDistribution(params: { wallets?: string }): AssetDistributionResponse {
    const walletAddresses = parseWalletList(params.wallets);

    const buildDistribution = (address: string) => {
        const portfolio = generateMockWalletPortfolio(address);
        const totalValue = portfolio.reduce((sum, item) => sum + item.valueUsd, 0);
        const data = portfolio.map((item) => ({
            name: item.symbol,
            value: item.valueUsd,
            percentage: totalValue > 0 ? Number(((item.valueUsd / totalValue) * 100).toFixed(2)) : 0,
            tokenAddress: item.tokenAddress,
            symbol: item.symbol,
            logoUri: item.logoUri,
            rawAmount: item.amount,
        }));

        return {
            walletAddress: address,
            data,
            totalValue: Number(totalValue.toFixed(2)),
        };
    };

    if (walletAddresses.length > 1) {
        return {
            wallets: walletAddresses.map((address) => buildDistribution(address)),
            metadata: {
                currency: "USD",
                timestamp: MOCK_NOW,
            },
        };
    }

    const single = buildDistribution(walletAddresses[0] ?? "wallet-single-mock");
    return {
        data: single.data,
        totalValue: single.totalValue,
        metadata: {
            currency: "USD",
            timestamp: MOCK_NOW,
        },
    };
}

export function generateMockExchangeComparison(params: { metric?: "count" | "volume"; wallet?: string }): ExchangeComparisonResponse {
    const metric = params.metric ?? "count";
    const exchanges = generateMockWalletExchanges(params.wallet ?? "wallet-single-mock", metric, 6).exchanges;
    return {
        exchanges,
        metadata: {
            period: "30D",
            metric,
        },
    };
}

export function generateMockCounterpartyActivity(params: { wallets?: string; limit?: number; timePeriod?: string; transactionType?: string; address?: string }): CounterpartyActivityResponse {
    const address = params.address ?? parseWalletList(params.wallets)[0] ?? "wallet-single-mock";
    const source = generateMockWalletCounterparties(address, "7d", params.limit ?? 10);

    const byCount = source.rankings.byTransactionCount.map((item) => ({
        id: item.address,
        name: item.label,
        transactionCount: item.transactionCount,
        totalVolume: item.totalVolumeUsd,
    }));
    const byVolume = source.rankings.byVolume.map((item) => ({
        id: item.address,
        name: item.label,
        transactionCount: item.transactionCount,
        totalVolume: item.totalVolumeUsd,
    }));

    return {
        counterparties: byCount,
        counterpartiesByTransactionCount: byCount,
        counterpartiesByVolume: byVolume,
        metadata: {
            period: params.timePeriod ?? "30D",
            transactionType: params.transactionType ?? "all",
            limit: params.limit,
        },
    };
}
