import { getTokenMeta } from "../tokens/token-info.js";
import { getTokenMarketData } from "../tokens/token-market-data.js";
import type { WalletTransaction, WalletTransfer, WalletSwap } from "./dtos/walletDataObjects.js";
import { SOL_MINT } from "./wallet.constants.js";
import { isMissingPortfolioLogoUri, isValidPortfolioTokenAddress, normalizePortfolioAddressKey, normalizePortfolioLookupAddress, normalizePortfolioText, shouldFillPortfolioText } from "./walletData.core.js";

export async function enrichWithSolanaTokenPrices(
    transactions: WalletTransaction[] | WalletTransfer[] | WalletSwap[],
): Promise<void> {
    const isWalletTransaction = (
        tx: WalletTransaction | WalletTransfer | WalletSwap,
    ): tx is WalletTransaction => "hash" in tx;

    const isWalletTransfer = (
        tx: WalletTransaction | WalletTransfer | WalletSwap,
    ): tx is WalletTransfer => "transactionSignature" in tx;

    const isWalletSwap = (
        tx: WalletTransaction | WalletTransfer | WalletSwap,
    ): tx is WalletSwap =>
        ("bought" in tx && "sold" in tx);

    const candidateAddressesByKey = new Map<string, string>();

    const resolveLookupAddress = (
        rawTokenAddress: string,
        rawTokenSymbol?: string,
    ): string | undefined => {
        const normalizedSymbol = normalizePortfolioText(rawTokenSymbol);
        if (normalizedSymbol?.toLowerCase() === "sol") {
            return SOL_MINT;
        }

        const normalizedAddress = normalizePortfolioText(rawTokenAddress);
        if (!normalizedAddress) {
            return undefined;
        }

        const lookupAddress = normalizePortfolioLookupAddress(normalizedAddress);
        if (!isValidPortfolioTokenAddress(lookupAddress)) {
            return undefined;
        }

        return lookupAddress;
    };

    const getAddressKey = (
        rawTokenAddress: string,
        rawTokenSymbol?: string,
    ): string | undefined => {
        const lookupAddress = resolveLookupAddress(rawTokenAddress, rawTokenSymbol);
        return lookupAddress ? normalizePortfolioAddressKey(lookupAddress) : undefined;
    };

    for (const tx of transactions) {
        if (isWalletTransaction(tx)) {
            const lookupAddress = resolveLookupAddress(
                tx.primaryTokenAddress || "",
                tx.primaryTokenSymbol,
            );
            if (lookupAddress) {
                candidateAddressesByKey.set(
                    normalizePortfolioAddressKey(lookupAddress),
                    lookupAddress,
                );
            }
            continue;
        }

        if (isWalletTransfer(tx)) {
            const lookupAddress = resolveLookupAddress(tx.tokenAddress, tx.tokenSymbol);
            if (lookupAddress) {
                candidateAddressesByKey.set(
                    normalizePortfolioAddressKey(lookupAddress),
                    lookupAddress,
                );
            }
            continue;
        }

        if (isWalletSwap(tx)) {
            const swapChanges = [
                // Prefer `bought`/`sold` shape, fall back to legacy `baseToken`/`quoteToken`.
                (tx as any).bought,
                (tx as any).sold,
            ];

            for (const change of swapChanges) {
                if (!change) continue;

                const lookupAddress = resolveLookupAddress(change.address);
                if (!lookupAddress) {
                    continue;
                }

                candidateAddressesByKey.set(
                    normalizePortfolioAddressKey(lookupAddress),
                    lookupAddress,
                );
            }
        }
    }

    console.log(
        `[enrichWithSolanaTokenPrices] Processing ${transactions.length} records with ${candidateAddressesByKey.size} unique tokens`,
    );

    if (candidateAddressesByKey.size === 0) {
        // No tokens to enrich.
        return;
    }

    try {
        type TokenMetaRow = {
            address?: unknown;
            symbol?: unknown;
            name?: unknown;
            imageUrl?: unknown;
        };

        const candidateAddresses = Array.from(candidateAddressesByKey.values());

        const tokenMetaByKey = new Map<
            string,
            {
                symbol?: string;
                name?: string;
                logoUri?: string;
            }
        >();
        const marketPriceByKey = new Map<string, number>();

        try {
            const tokenMeta = await getTokenMeta(candidateAddresses) as TokenMetaRow[];
            for (const meta of tokenMeta) {
                const address = normalizePortfolioText(meta.address);
                if (!address) {
                    continue;
                }

                const lookupAddress = normalizePortfolioLookupAddress(address);
                if (!isValidPortfolioTokenAddress(lookupAddress)) {
                    continue;
                }

                tokenMetaByKey.set(normalizePortfolioAddressKey(lookupAddress), {
                    symbol: normalizePortfolioText(meta.symbol),
                    name: normalizePortfolioText(meta.name),
                    logoUri: normalizePortfolioText(meta.imageUrl),
                });
            }
        } catch (err) {
            console.warn("[enrichWithSolanaTokenPrices] Token metadata enrichment failed", err);
        }

        try {
            const marketData = await getTokenMarketData(candidateAddresses);
            for (const [rawAddress, data] of Object.entries(marketData ?? {})) {
                const normalizedAddress = normalizePortfolioText(rawAddress);
                if (!normalizedAddress) {
                    continue;
                }

                const lookupAddress = normalizePortfolioLookupAddress(normalizedAddress);
                if (!isValidPortfolioTokenAddress(lookupAddress)) {
                    continue;
                }

                const priceUsd = Number(data?.priceUsd);
                if (!Number.isFinite(priceUsd)) {
                    continue;
                }

                marketPriceByKey.set(normalizePortfolioAddressKey(lookupAddress), priceUsd);
            }
        } catch (err) {
            console.warn("[enrichWithSolanaTokenPrices] Token market-data enrichment failed", err);
        }

        const resolvePriceUsd = (addressKey: string | undefined): number | undefined => {
            if (!addressKey) {
                return undefined;
            }

            const priceUsd = marketPriceByKey.get(addressKey);
            return Number.isFinite(priceUsd) ? priceUsd : undefined;
        };

        let transactionEnrichedCount = 0;
        let transferEnrichedCount = 0;
        let swapEnrichedCount = 0;

        for (const tx of transactions) {
            if (isWalletTransaction(tx)) {
                const addressKey = getAddressKey(
                    tx.primaryTokenAddress || "",
                    tx.primaryTokenSymbol || "",
                );

                if (!addressKey) {
                    tx.priceUsd = undefined;
                    tx.totalUsd = undefined;
                    continue;
                }

                const priceUsd = resolvePriceUsd(addressKey);
                if (priceUsd == null) {
                    tx.priceUsd = undefined;
                    tx.totalUsd = undefined;
                    continue;
                }

                tx.priceUsd = priceUsd;
                tx.totalUsd =
                    tx.primaryTokenAmount != null ? priceUsd * tx.primaryTokenAmount : undefined;
                transactionEnrichedCount += 1;
                continue;
            }

            if (isWalletTransfer(tx)) {
                let changed = false;

                const addressKey = getAddressKey(tx.tokenAddress, tx.tokenSymbol);
                if (addressKey) {
                    const tokenMeta = tokenMetaByKey.get(addressKey);
                    if (tokenMeta) {
                        const shouldFillSymbol = shouldFillPortfolioText(tx.tokenSymbol) && Boolean(tokenMeta.symbol);
                        const shouldFillName = shouldFillPortfolioText(tx.tokenName) && Boolean(tokenMeta.name);
                        const shouldFillLogo = isMissingPortfolioLogoUri(tx.tokenLogoUri) && Boolean(tokenMeta.logoUri);

                        if (shouldFillSymbol) {
                            tx.tokenSymbol = String(tokenMeta.symbol);
                            changed = true;
                        }

                        if (shouldFillName) {
                            tx.tokenName = String(tokenMeta.name);
                            changed = true;
                        }

                        if (shouldFillLogo) {
                            tx.tokenLogoUri = String(tokenMeta.logoUri);
                            changed = true;
                        }
                    }

                    const priceUsd = resolvePriceUsd(addressKey);
                    if (priceUsd != null) {
                        const hasPriceUsd = tx.priceUsd != null && Number.isFinite(Number(tx.priceUsd));
                        if (!hasPriceUsd) {
                            tx.priceUsd = priceUsd;
                            changed = true;
                        }

                        const amountUsd = Number(tx.amount) * Number(tx.priceUsd ?? priceUsd);
                        const hasAmountUsd = tx.amountUsd != null && Number.isFinite(Number(tx.amountUsd));
                        if (!hasAmountUsd && Number.isFinite(amountUsd)) {
                            tx.amountUsd = amountUsd;
                            changed = true;
                        }
                    }
                }

                if (changed) {
                    transferEnrichedCount += 1;
                }
                continue;
            }

            if (!isWalletSwap(tx)) {
                continue;
            }

            let changed = false;

            const enrichSwapChange = (change: WalletSwap["bought"] | WalletSwap["sold"]) => {
                if (!change) {
                    return;
                }

                const addressKey = getAddressKey(change.address);
                if (!addressKey) {
                    return;
                }

                const tokenMeta = tokenMetaByKey.get(addressKey);
                if (tokenMeta) {
                    const shouldFillSymbol = shouldFillPortfolioText(change.symbol ?? undefined) && Boolean(tokenMeta.symbol);
                    const shouldFillName = shouldFillPortfolioText(change.name ?? undefined) && Boolean(tokenMeta.name);
                    const shouldFillLogo = isMissingPortfolioLogoUri(change.logoUri ?? undefined) && Boolean(tokenMeta.logoUri);

                    if (shouldFillSymbol) {
                        change.symbol = String(tokenMeta.symbol);
                        changed = true;
                    }

                    if (shouldFillName) {
                        change.name = String(tokenMeta.name);
                        changed = true;
                    }

                    if (shouldFillLogo) {
                        change.logoUri = String(tokenMeta.logoUri);
                        changed = true;
                    }
                }

                const priceUsd = resolvePriceUsd(addressKey);
                if (priceUsd == null) {
                    return;
                }

                const hasPriceUsd = change.priceUsd != null && Number.isFinite(Number(change.priceUsd));
                if (!hasPriceUsd) {
                    change.priceUsd = priceUsd;
                    changed = true;
                }

                const hasValueUsd = change.valueUsd != null && Number.isFinite(Number(change.valueUsd));
                if (!hasValueUsd) {
                    const computedValueUsd = Math.abs(Number(change.amount)) * Number(change.priceUsd ?? priceUsd);
                    if (Number.isFinite(computedValueUsd)) {
                        change.valueUsd = computedValueUsd;
                        changed = true;
                    }
                }
            };

            enrichSwapChange(tx.bought);
            enrichSwapChange(tx.sold);

            const hasTotalValueUsd = tx.totalValueUsd != null && Number.isFinite(Number(tx.totalValueUsd));
            if (!hasTotalValueUsd) {
                const fallbackCandidates = [
                    Number(tx.bought?.valueUsd),
                    Number(tx.sold?.valueUsd),
                ];

                const derivedTotalValueUsd = fallbackCandidates.find(
                    (value) => Number.isFinite(value) && value > 0,
                );

                if (derivedTotalValueUsd != null) {
                    tx.totalValueUsd = derivedTotalValueUsd;
                    changed = true;
                }
            }

            if (changed) {
                swapEnrichedCount += 1;
            }
        }

        console.log("[enrichWithSolanaTokenPrices] Enrichment summary", {
            processed: transactions.length,
            tokenMetaCount: tokenMetaByKey.size,
            marketPriceCount: marketPriceByKey.size,
            transactionEnrichedCount,
            transferEnrichedCount,
            swapEnrichedCount,
        });
    } catch (err) {
        console.error(
            "Failed to enrich transactions with Solana token prices",
            err,
        );
        // Only transaction DTOs include output price fields.
        for (const tx of transactions) {
            if (isWalletTransaction(tx)) {
                tx.priceUsd = undefined;
                tx.totalUsd = undefined;
            }
        }
    }
}