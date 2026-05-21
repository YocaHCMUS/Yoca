import type {
    WalletDayActivitySummary,
    WalletDaySwapSummary,
    WalletDayToken,
    TokenHourlyVolume,
    WalletTxDetail,
    WalletTxTransfer,
    WalletFeeReceiver,
    WalletTxInstructionDetail,
    WalletInstruction,
    WalletInnerInstruction,
} from "./dtos/walletDataObjects.js";
import { getWalletSwaps, getWalletTransfers } from "./walletTransfersSwaps.service.js";
import { resolveEnhancedTransactions } from "./providers/walletEnhancedTx.service.js";
import { roundUsd } from "./walletNormalization.utils.js";
import { isRentExemptLikeLamports } from "./providers/helius-to-swap.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const STABLE_MINTS = new Set([
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "Es9vMFrzaCERmJfrF4H2FYD4h4H8o3A8rM6jD5M3j6Q",
]);

function isBaseAsset(mint: string | undefined): boolean {
    if (!mint) return false;
    const lower = mint.toLowerCase();
    return lower === SOL_MINT.toLowerCase() || STABLE_MINTS.has(lower);
}

function getUtcStartOfDayMs(tsMs: number): number {
    const d = new Date(tsMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
    const fromMs = getUtcStartOfDayMs(dayMs);
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

export async function getWalletTxDetail(
    address: string,
    signature: string,
): Promise<WalletTxDetail> {
    try {
        const nowMs = Date.now();
        const fromMs = nowMs - 365 * 24 * 60 * 60 * 1000;
        const toMs = nowMs;

        const txs = await resolveEnhancedTransactions(address, fromMs, toMs);
        const tx = txs.find((t) => t.signature === signature);

        if (!tx) {
            return {
                transactionHash: signature,
                timestamp: "",
                pair: "",
                valueUsd: 0,
                action: "buy",
                transfers: [],
                feePaid: 0,
                feePaidUsd: null,
                feePayer: address,
                feeReceivers: [],
            };
        }

        const tsSec = Number(tx.timestamp ?? tx.info?.timestamp ?? 0);
        const timestamp = tsSec > 0 ? new Date(tsSec * 1000).toISOString() : "";

        const transfers: WalletTxTransfer[] = [];

        const tokenTransfers = tx.tokenTransfers ?? [];
        for (const tt of tokenTransfers) {
            const mint = String(tt.mint ?? "").trim();
            const amount = Number(tt.tokenAmount ?? tt.amount ?? 0);
            if (!mint || amount <= 0) continue;

            transfers.push({
                from: String(tt.fromUserAccount ?? tt.fromWallet ?? ""),
                to: String(tt.toUserAccount ?? tt.toWallet ?? ""),
                mint,
                symbol: (tt.symbol ?? tt.tokenSymbol)?.toUpperCase() ?? null,
                name: null,
                logoUri: null,
                amount,
                amountUsd: null,
            });
        }

        const nativeTransfers = tx.nativeTransfers ?? [];
        const feeReceivers: WalletFeeReceiver[] = [];
        const feePayer = String(tx.feePayer ?? tx.info?.feePayer ?? address);
        for (const nt of nativeTransfers) {
            const amount = Number(nt.amount ?? 0);
            if (amount <= 0) continue;

            transfers.push({
                from: String(nt.fromUserAccount ?? nt.fromWallet ?? ""),
                to: String(nt.toUserAccount ?? nt.toWallet ?? ""),
                mint: SOL_MINT,
                symbol: "SOL",
                name: "Solana",
                logoUri: null,
                amount: amount / 1e9,
                amountUsd: null,
            });

            if (amount === tx.fee) {
                feeReceivers.push({
                    address: String(nt.toUserAccount ?? nt.toWallet ?? ""),
                    amount: amount / 1e9,
                    amountUsd: null,
                    label: String(nt.toUserAccount ?? nt.toWallet ?? ""),
                });
            }
        }

        const feePaid = Number(tx.fee ?? tx.info?.fee ?? 0);

        const soldSymbol = transfers.find((t) => t.from === address)?.symbol ?? null;
        const boughtSymbol = transfers.find((t) => t.to === address)?.symbol ?? null;
        const pair = [soldSymbol, boughtSymbol].filter(Boolean).join(" → ") || "Unknown";
        const action = boughtSymbol ? "buy" : "sell";

        return {
            transactionHash: signature,
            timestamp,
            pair,
            valueUsd: 0,
            action,
            transfers,
            feePaid,
            feePaidUsd: null,
            feePayer,
            feeReceivers,
        };
    } catch (error) {
        console.error("[getWalletTxDetail] failed", { address, signature, error });
        return {
            transactionHash: signature,
            timestamp: "",
            pair: "",
            valueUsd: 0,
            action: "buy",
            transfers: [],
            feePaid: 0,
            feePaidUsd: null,
            feePayer: address,
            feeReceivers: [],
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
