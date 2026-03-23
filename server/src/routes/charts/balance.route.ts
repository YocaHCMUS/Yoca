import { Hono } from "hono";
import { z } from "zod";
import { getWalletTokenBalanceHistory } from "@sv/services/wallet/walletTokenBalance.service.js";
import { getWalletBalanceHistory } from "@sv/services/wallet/walletCharts.service.js";
import { mapWithConcurrency } from "@sv/util/concurrency.js";
import { getWalletPortfolio } from "@sv/services/wallet/walletPortfolio.service.js";

const MAX_CHART_WALLETS = 5;
const MAX_CHART_TOKENS = 10;
const MAX_WALLET_CHART_CONCURRENCY = 2;

type TokenMeta = {
    symbol: string;
    logoUri?: string;
    tokenAddress?: string;
};

const balanceRequestSchema = z.object({
    timePeriod: z.enum(["7D", "30D", "60D", "90D", "1Y", "All"]).optional().default("30D"),
    tokens: z.string().optional(),
    wallets: z.string().optional(),
    timezone: z.string().optional().default("UTC"),
});

const app = new Hono().get("/", async (c) => {
    try {
        const params = balanceRequestSchema.parse(c.req.query());

        if (!params.wallets) {
            return c.json({ error: "Validation error", message: "wallets is required" }, 400);
        }

        const walletAddresses = params.wallets
            .split(",")
            .map((wallet) => wallet.trim())
            .filter((wallet) => wallet.length > 0);

        const tokenSelectors = params.tokens
            ? params.tokens
                .split(",")
                .map((token) => token.trim())
                .filter((token) => token.length > 0)
            : [];

        const walletMeta = Object.fromEntries(
            walletAddresses.map((address) => [
                address,
                {
                    label: `${address.substring(0, 8)}...`,
                },
            ]),
        );

        if (walletAddresses.length === 0) {
            return c.json({ error: "Validation error", message: "Invalid wallet addresses provided" }, 400);
        }

        if (walletAddresses.length > MAX_CHART_WALLETS) {
            return c.json(
                {
                    error: "Validation error",
                    message: `wallets exceeds max allowed (${MAX_CHART_WALLETS})`,
                },
                400,
            );
        }

        if (tokenSelectors.length > MAX_CHART_TOKENS) {
            return c.json(
                {
                    error: "Validation error",
                    message: `tokens exceeds max allowed (${MAX_CHART_TOKENS})`,
                },
                400,
            );
        }

        if (tokenSelectors.length === 0) {
            const allHistories = await mapWithConcurrency(
                walletAddresses,
                MAX_WALLET_CHART_CONCURRENCY,
                async (address) => getWalletBalanceHistory(address),
            );

            const series =
                walletAddresses.length === 1
                    ? [
                        {
                            name: "Total",
                            data: allHistories[0].map((point) => ({ timestamp: point.timestamp, value: point.value })),
                            seriesType: "line" as const,
                            unit: "USD" as const,
                        },
                    ]
                    : walletAddresses.map((address, index) => ({
                        name: `${address.substring(0, 8)}...`,
                        data: allHistories[index].map((point) => ({ timestamp: point.timestamp, value: point.value })),
                        seriesType: "line" as const,
                        unit: "USD" as const,
                    }));

            return c.json(
                {
                    series,
                    wallets: walletAddresses.length > 1 ? walletAddresses : undefined,
                    metadata: {
                        timePeriod: "30D",
                        aggregation: "daily",
                        dataPoints: allHistories[0]?.length ?? 0,
                        currency: "USD",
                        timezone: params.timezone || "UTC",
                        mode: "total" as const,
                        tokens: [],
                        tokenMeta: {},
                        walletMeta,
                        primaryYAxis: "USD" as const,
                    },
                },
                200,
            );
        }

        const portfolios = await mapWithConcurrency(
            walletAddresses,
            MAX_WALLET_CHART_CONCURRENCY,
            async (address) => ({
                address,
                items: await getWalletPortfolio(address),
            }),
        );

        const tokenMetaBySelector = new Map<string, TokenMeta>();
        for (const selector of tokenSelectors) {
            const selectorLower = selector.toLowerCase();

            for (const portfolio of portfolios) {
                const matched = portfolio.items.find((item) => {
                    const symbol = item.symbol?.toLowerCase() ?? "";
                    const tokenAddress = item.tokenAddress?.toLowerCase() ?? "";
                    return symbol === selectorLower || tokenAddress === selectorLower;
                });

                if (!matched) {
                    continue;
                }

                tokenMetaBySelector.set(selector, {
                    symbol: matched.symbol?.toUpperCase() || selector.toUpperCase(),
                    logoUri: matched.logoUri || undefined,
                    tokenAddress: matched.tokenAddress || undefined,
                });
                break;
            }

            if (!tokenMetaBySelector.has(selector)) {
                tokenMetaBySelector.set(selector, {
                    symbol: selector.toUpperCase(),
                });
            }
        }

        const pairs = walletAddresses.flatMap((address) =>
            tokenSelectors.map((token) => ({ address, token })),
        );

        const pairResults = await mapWithConcurrency(
            pairs,
            MAX_WALLET_CHART_CONCURRENCY,
            async ({ address, token }) => getWalletTokenBalanceHistory(address, token),
        );

        const selectedTokenSymbols = Array.from(
            new Set(pairResults.map((result) => result.tokenSymbol.toUpperCase())),
        );
        const tokenMeta = Object.fromEntries(
            selectedTokenSymbols.map((symbol) => {
                const selectorMeta = tokenSelectors
                    .map((selector) => tokenMetaBySelector.get(selector))
                    .find((meta) => meta?.symbol?.toUpperCase() === symbol);

                const pairMeta = pairResults.find((result) => result.tokenSymbol.toUpperCase() === symbol);

                return [
                    symbol,
                    {
                        symbol,
                        logoUri: selectorMeta?.logoUri,
                        tokenAddress: selectorMeta?.tokenAddress ?? pairMeta?.tokenAddress,
                    },
                ];
            }),
        );

        const series = pairs.flatMap(({ address }, index) => {
            const result = pairResults[index];
            const prefix = walletAddresses.length > 1 ? `${address.substring(0, 8)}... ` : "";
            return [
                {
                    name: `${prefix}${result.tokenSymbol} (units)`,
                    data: result.tokenSeries.map((point) => ({ timestamp: point.timestamp, value: point.value })),
                    seriesType: "line" as const,
                    unit: "TOKEN" as const,
                },
                {
                    name: `${prefix}${result.tokenSymbol} (USD)`,
                    data: result.usdSeries.map((point) => ({ timestamp: point.timestamp, value: point.value })),
                    seriesType: "bar" as const,
                    unit: "USD" as const,
                },
            ];
        });

        return c.json(
            {
                series,
                wallets: walletAddresses.length > 1 ? walletAddresses : undefined,
                metadata: {
                    timePeriod: "30D",
                    aggregation: "daily",
                    dataPoints: pairResults[0]?.tokenSeries.length ?? 0,
                    currency: "USD",
                    timezone: params.timezone || "UTC",
                    mode: "token" as const,
                    tokens: selectedTokenSymbols,
                    tokenMeta,
                    walletMeta,
                    primaryYAxis: "TOKEN" as const,
                },
            },
            200,
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation error", details: error.issues }, 400);
        }

        console.error("[BalanceChart] Error fetching wallet balance history:", error);
        return c.json({ error: "[BalanceChart] Error fetching wallet balance history:", details: error }, 500);
    }
});

export default app;
