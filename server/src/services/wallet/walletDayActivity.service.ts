import type {
    WalletDayActivitySummary,
    WalletDaySwapSummary,
    WalletDayToken,
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

const SOL_MINT = "So11111111111111111111111111111111111111112";

function getUtcStartOfDayMs(tsMs: number): number {
    const d = new Date(tsMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export async function getWalletDayActivitySummary(
    address: string,
    dayMs: number,
): Promise<WalletDayActivitySummary> {
    const fromMs = getUtcStartOfDayMs(dayMs);
    const toMs = fromMs + 24 * 60 * 60 * 1000 - 1;

    const date = new Date(fromMs).toISOString().split("T")[0] ?? "";

    try {
        const [swapsRes, transfersRes] = await Promise.allSettled([
            getWalletSwaps(address, fromMs, toMs),
            getWalletTransfers(address, fromMs, toMs),
        ]);

        const swaps = swapsRes.status === "fulfilled" ? swapsRes.value.swaps : [];
        const transfers = transfersRes.status === "fulfilled" ? transfersRes.value.transfers : [];

        let buyVolumeUsd = 0;
        let sellVolumeUsd = 0;
        let buyTxCount = 0;
        let sellTxCount = 0;

        const tokenVolumeMap = new Map<string, { symbol: string; logoUri: string | null; volumeUsd: number }>();
        const swapsSummary: WalletDaySwapSummary[] = [];

        for (const swap of swaps) {
            const valueUsd = swap.totalValueUsd ?? 0;
            const isBuy = swap.transactionType?.toLowerCase() === "buy"
                || swap.bought?.address?.toLowerCase() === SOL_MINT;

            if (isBuy) {
                buyVolumeUsd += valueUsd;
                buyTxCount++;
            } else {
                sellVolumeUsd += valueUsd;
                sellTxCount++;
            }

            const soldSymbol = swap.sold?.symbol ?? null;
            const boughtSymbol = swap.bought?.symbol ?? null;
            const pair = [soldSymbol, boughtSymbol].filter(Boolean).join(" → ") || "Unknown";

            swapsSummary.push({
                transactionHash: swap.transactionHash,
                timestamp: swap.blockTimestampIso,
                pair,
                valueUsd,
                action: isBuy ? "buy" : "sell",
                soldSymbol,
                boughtSymbol,
            });

            if (swap.sold?.address) {
                const existing = tokenVolumeMap.get(swap.sold.address);
                if (existing) {
                    existing.volumeUsd += valueUsd;
                } else {
                    tokenVolumeMap.set(swap.sold.address, {
                        symbol: swap.sold.symbol ?? "Unknown",
                        logoUri: swap.sold.logoUri,
                        volumeUsd: valueUsd,
                    });
                }
            }
            if (swap.bought?.address) {
                const existing = tokenVolumeMap.get(swap.bought.address);
                if (existing) {
                    existing.volumeUsd += valueUsd;
                } else {
                    tokenVolumeMap.set(swap.bought.address, {
                        symbol: swap.bought.symbol ?? "Unknown",
                        logoUri: swap.bought.logoUri,
                        volumeUsd: valueUsd,
                    });
                }
            }
        }

        for (const transfer of transfers) {
            const valueUsd = transfer.amountUsd ?? 0;
            const isInflow = transfer.to === address;

            if (isInflow) {
                buyVolumeUsd += valueUsd;
            } else {
                sellVolumeUsd += valueUsd;
            }

            if (transfer.tokenAddress) {
                const existing = tokenVolumeMap.get(transfer.tokenAddress);
                if (existing) {
                    existing.volumeUsd += valueUsd;
                } else {
                    tokenVolumeMap.set(transfer.tokenAddress, {
                        symbol: transfer.tokenSymbol ?? "Unknown",
                        logoUri: transfer.tokenLogoUri ?? null,
                        volumeUsd: valueUsd,
                    });
                }
            }
        }

        const topTokens: WalletDayToken[] = Array.from(tokenVolumeMap.entries())
            .map(([address, data]) => ({
                address,
                symbol: data.symbol,
                logoUri: data.logoUri,
                volumeUsd: roundUsd(data.volumeUsd),
            }))
            .sort((a, b) => b.volumeUsd - a.volumeUsd)
            .slice(0, 3);

        swapsSummary.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

        return {
            walletAddress: address,
            date,
            buyVolumeUsd: roundUsd(buyVolumeUsd),
            sellVolumeUsd: roundUsd(sellVolumeUsd),
            buyTxCount,
            sellTxCount,
            topTokens,
            totalTokensTraded: tokenVolumeMap.size,
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
            topTokens: [],
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
                symbol: tt.symbol ?? tt.tokenSymbol ?? null,
                name: null,
                logoUri: null,
                amount,
                amountUsd: null,
            });
        }

        const nativeTransfers = tx.nativeTransfers ?? [];
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
        }

        const feePaid = Number(tx.fee ?? tx.info?.fee ?? 0);
        const feePayer = String(tx.feePayer ?? tx.info?.feePayer ?? address);

        const feeReceivers: WalletFeeReceiver[] = [];
        const instructions = tx.instructions ?? [];
        for (const ins of instructions) {
            const programId = String(ins.programId ?? "").trim();
            if (!programId) continue;

            const label = null;
            feeReceivers.push({
                address: programId,
                amount: 0,
                amountUsd: null,
                label,
            });
        }

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
