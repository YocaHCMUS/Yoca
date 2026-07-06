import type {
    WalletDayActivitySummary,
    WalletDaySwapSummary,
    WalletDayToken,
    TokenHourlyVolume,
    WalletTxInstructionDetail,
    WalletInstruction,
    WalletInnerInstruction,
} from "./dtos/walletDataObjects.js";
import { getWalletSwaps } from "./walletTransfersSwaps.service.js";
import { resolveEnhancedTransactions } from "./providers/walletEnhancedTx.service.js";
import { roundUsd } from "./walletNormalization.utils.js";
import { getMobulaChartData } from "@sv/services/tokens/mobula-chart-data.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const STABLE_MINTS = new Set([
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "Es9vMFrzaCERmJfrF4H2FYD4h4H8o3A8rM6jD5M3j6Q",
]);

export function isBaseAsset(mint: string | undefined): boolean {
    if (!mint) return false;
    return mint === SOL_MINT || STABLE_MINTS.has(mint);
}
interface TokenAccumulator {
    symbol: string;
    logoUri: string | null;
    buyVolumeUsd: number;
    sellVolumeUsd: number;
    buyAmount: number;
    sellAmount: number;
    hourlyMap: Map<number, { buy: number; sell: number }>;
}

export async function getWalletDayActivitySummary(
    address: string,
    dayMs: number,
): Promise<WalletDayActivitySummary> {
    const fromMs = dayMs;
    const toMs = fromMs + 24 * 60 * 60 * 1000 - 1;

    const date = new Date(fromMs).toISOString().split("T")[0] ?? "";

    try {
        // const [swapsRes, transfersRes] = await Promise.allSettled([
        //     getWalletSwaps(address, fromMs, toMs),
        //     getWalletTransfers(address, fromMs, toMs),
        // ]);
        const swapsRes = await getWalletSwaps(address, fromMs, toMs);

        const swaps = swapsRes.swaps;
        let buyVolumeUsd = 0;
        let sellVolumeUsd = 0;
        let buyTxCount = 0;
        let sellTxCount = 0;

        const tokenMap = new Map<string, TokenAccumulator>();
        const swapsSummary: WalletDaySwapSummary[] = [];

        function getOrCreateToken(addr: string, symbol: string | null, logoUri: string | null): TokenAccumulator {
            const existing = tokenMap.get(addr);
            if (existing) return existing;
            const acc: TokenAccumulator = {
                symbol: (symbol ?? "Unknown").toUpperCase(),
                logoUri,
                buyVolumeUsd: 0,
                sellVolumeUsd: 0,
                buyAmount: 0,
                sellAmount: 0,
                hourlyMap: new Map(),
            };
            tokenMap.set(addr, acc);
            return acc;
        }

        function addHourlyVolume(addr: string, hour: number, isBuy: boolean, volume: number) {
            const acc = getOrCreateToken(addr, null, null);
            const entry = acc.hourlyMap.get(hour) ?? { buy: 0, sell: 0 };
            if (isBuy) {
                entry.buy += volume;
            } else {
                entry.sell += volume;
            }
            acc.hourlyMap.set(hour, entry);
        }

        for (const swap of swaps) {
            const valueUsd = swap.totalValueUsd ?? 0;

            const soldIsBase = isBaseAsset(swap.sold?.address);
            const boughtIsBase = isBaseAsset(swap.bought?.address);

            let action: "buy" | "sell" | "both";
            if (soldIsBase && !boughtIsBase) {
                action = "buy";
            } else if (!soldIsBase && boughtIsBase) {
                action = "sell";
            } else {
                action = "both";
            }

            if (action === "buy" || action === "both") {
                buyVolumeUsd += valueUsd;
                buyTxCount++;
            }
            if (action === "sell" || action === "both") {
                sellVolumeUsd += valueUsd;
                sellTxCount++;
            }

            const soldSymbol = swap.sold?.symbol ?? null;
            const boughtSymbol = swap.bought?.symbol ?? null;
            const pair = [soldSymbol, boughtSymbol].filter(Boolean).map((s) => s?.toUpperCase()).join(" → ") || "Unknown";

            swapsSummary.push({
                transactionHash: swap.transactionHash,
                timestamp: swap.blockTimestampIso,
                pair,
                valueUsd,
                action: action === "both" ? "buy" : action,
                soldSymbol: soldSymbol?.toUpperCase() ?? null,
                boughtSymbol: boughtSymbol?.toUpperCase() ?? null,
                soldAmount: swap.sold?.amount ?? 0,
                boughtAmount: swap.bought?.amount ?? 0,
                soldTokenAddress: swap.sold?.address ?? null,
                boughtTokenAddress: swap.bought?.address ?? null,
            });

            const tsMs = Date.parse(swap.blockTimestampIso);
            const hour = Number.isFinite(tsMs) ? Math.floor((tsMs - fromMs) / 3600000) : 0;

            if (swap.sold?.address) {
                const acc = getOrCreateToken(swap.sold.address, swap.sold.symbol, swap.sold.logoUri);
                acc.sellVolumeUsd += valueUsd;
                acc.sellAmount += swap.sold.amount;
                addHourlyVolume(swap.sold.address, hour, false, valueUsd);
            }
            if (swap.bought?.address) {
                const acc = getOrCreateToken(swap.bought.address, swap.bought.symbol, swap.bought.logoUri);
                acc.buyVolumeUsd += valueUsd;
                acc.buyAmount += swap.bought.amount;
                addHourlyVolume(swap.bought.address, hour, true, valueUsd);
            }
        }

        const allTokens: WalletDayToken[] = Array.from(tokenMap.entries())
            .map(([addr, acc]) => {
                const hourlyVolumes: TokenHourlyVolume[] = Array.from({ length: 24 }, (_, h) => {
                    const entry = acc.hourlyMap.get(h);
                    return {
                        hour: h,
                        buyVolumeUsd: roundUsd(entry?.buy ?? 0),
                        sellVolumeUsd: roundUsd(entry?.sell ?? 0),
                    };
                });

                return {
                    address: addr,
                    symbol: acc.symbol,
                    logoUri: acc.logoUri,
                    buyVolumeUsd: roundUsd(acc.buyVolumeUsd),
                    sellVolumeUsd: roundUsd(acc.sellVolumeUsd),
                    buyAmount: acc.buyAmount,
                    sellAmount: acc.sellAmount,
                    totalVolumeUsd: roundUsd(acc.buyVolumeUsd + acc.sellVolumeUsd),
                    hourlyVolumes,
                };
            })
            .sort((a, b) => b.totalVolumeUsd - a.totalVolumeUsd);

        swapsSummary.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

        const uniqueAddrs = [...new Set(allTokens.map((t) => t.address))];
        const priceResults = await Promise.allSettled(
            uniqueAddrs.map((addr) => getMobulaChartData(addr, "24h")),
        );
        const priceMap = new Map<string, { timestampMs: number; price: number }[]>();
        for (let i = 0; i < uniqueAddrs.length; i++) {
            const res = priceResults[i];
            if (res?.status === "fulfilled" && res.value.length > 0) {
                priceMap.set(
                    uniqueAddrs[i],
                    res.value.map((p) => ({ timestampMs: p.unixTimestampMs, price: p.price })),
                );
            }
        }
        for (const token of allTokens) {
            token.priceHistory = priceMap.get(token.address);
        }

        return {
            walletAddress: address,
            date,
            buyVolumeUsd: roundUsd(buyVolumeUsd),
            sellVolumeUsd: roundUsd(sellVolumeUsd),
            buyTxCount,
            sellTxCount,
            allTokens,
            totalTokensTraded: tokenMap.size,
            swaps: swapsSummary,
        };
    } catch (error) {
        console.error("[getWalletDayActivitySummary] failed", { address, dayMs, error });
        return {
            walletAddress: address,
            date,
            buyVolumeUsd: 0,
            sellVolumeUsd: 0,
            buyTxCount: 0,
            sellTxCount: 0,
            allTokens: [],
            totalTokensTraded: 0,
            swaps: [],
        };
    }
}

export async function getWalletTxInstructionDetail(
    address: string,
    signature: string,
): Promise<WalletTxInstructionDetail> {
    try {
        const nowMs = Date.now();
        const fromMs = nowMs - 365 * 24 * 60 * 60 * 1000;
        const toMs = nowMs;

        const txs = await resolveEnhancedTransactions(address, fromMs, toMs);
        const tx = txs.find((t) => t.signature === signature);

        if (!tx) {
            return { transactionHash: signature, instructions: [] };
        }

        const instructions: WalletInstruction[] = [];
        const txInstructions = tx.instructions ?? [];

        for (let i = 0; i < txInstructions.length; i++) {
            const ins = txInstructions[i];
            const programId = String(ins.programId ?? "").trim();
            if (!programId) continue;

            const accounts = ins.accounts ?? [];
            const innerInstructions: WalletInnerInstruction[] = [];

            const inner = ins.innerInstructions ?? [];
            for (let j = 0; j < inner.length; j++) {
                const innerIns = inner[j];
                const innerProgramId = String(innerIns.programId ?? "").trim();
                if (!innerProgramId) continue;

                innerInstructions.push({
                    index: j,
                    programId: innerProgramId,
                    programLabel: null,
                    accounts: innerIns.accounts ?? [],
                });
            }

            instructions.push({
                index: i,
                programId,
                programLabel: null,
                accounts,
                innerInstructions,
            });
        }

        return { transactionHash: signature, instructions };
    } catch (error) {
        console.error("[getWalletTxInstructionDetail] failed", { address, signature, error });
        return { transactionHash: signature, instructions: [] };
    }
}
