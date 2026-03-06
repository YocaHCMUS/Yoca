import { getEndpoint, getRequiredHeaders } from "@sv/util/util-helius.js";
import type { WalletPortfolioItem, WalletSwap, WalletTransaction, WalletTransfer } from "@sv/services/wallet/dtos/walletDataObjects.js";

export async function fetchHeliusSolanaPortfolio(
  address: string,
): Promise<WalletPortfolioItem[]> {
  const portfolio: WalletPortfolioItem[] = [];

  let page = 1;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = getEndpoint(`/v1/wallet/${address}/balances`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("showZeroBalance", "false");
    url.searchParams.set("showNative", "true");
    // NFTs are not our current focus; exclude them to reduce payload size.
    url.searchParams.set("showNfts", "false");

    let json: any;
    try {
      const headers = getRequiredHeaders();
      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          "Helius wallet balances error",
          resp.status,
          resp.statusText,
        );
        break;
      }

      json = await resp.json();
    } catch (err) {
      console.error("Helius wallet balances request failed", err);
      break;
    }

    const balances: any[] = Array.isArray(json?.balances) ? json.balances : [];

    for (const token of balances) {
      const amount = Number(token.balance ?? 0);
      if (!(amount > 0) || Number.isNaN(amount)) continue;

      const pricePerToken =
        token.pricePerToken != null && !Number.isNaN(Number(token.pricePerToken))
          ? Number(token.pricePerToken)
          : undefined;
      const usdValue =
        token.usdValue != null && !Number.isNaN(Number(token.usdValue))
          ? Number(token.usdValue)
          : pricePerToken != null
          ? amount * pricePerToken
          : 0;

      portfolio.push({
        tokenAddress: String(token.mint ?? ""),
        symbol: String(token.symbol ?? ""),
        name: token.name ? String(token.name) : undefined,
        amount,
        priceUsd: pricePerToken,
        valueUsd: usdValue,
      });
    }

    const pagination = json?.pagination;
    hasMore = Boolean(pagination?.hasMore);
    page = (pagination?.page ?? page) + 1;
  }

  return portfolio;
}

export async function fetchHeliusSolanaTransactions(
  address: string,
  maxCount: number,
): Promise<WalletTransaction[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const ONE_MONTH_SEC = 30 * 24 * 60 * 60;
  const fromSec = nowSec - ONE_MONTH_SEC;

  const transactions: WalletTransaction[] = [];
  let cursor: string | null = null;

  const walletLower = address.toLowerCase();

  // Helper to safely extract a public key string from accountKeys entries
  function toPubkey(entry: any): string {
    if (!entry) return "";
    if (typeof entry === "string") return entry;
    if (typeof entry.pubkey === "string") return entry.pubkey;
    return "";
  }

  // Fetch pages until we hit maxCount, run out of data, or reach beyond 1 month.
  // Uses Wallet API: GET /v1/wallet/{wallet}/transfers (available on free plan).
  while (transactions.length < maxCount) {
    const url = getEndpoint(`/v1/wallet/${address}/transfers`);
    url.searchParams.set("limit", String(Math.min(100, maxCount - transactions.length)));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    let json: any = null;
    try {
      const headers = getRequiredHeaders();
      const resp = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          "Helius wallet transfers error",
          resp.status,
          resp.statusText,
        );
        break;
      }

      json = await resp.json();
    } catch (err) {
      console.error("Helius wallet transfers request failed", err);
      break;
    }

    const data: any[] = Array.isArray(json?.data) ? json.data : [];

    if (data.length === 0) {
      break;
    }

    for (const entry of data) {
      if (transactions.length >= maxCount) break;

      const tsSec =
        typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
          ? entry.timestamp
          : null;
      if (tsSec == null || tsSec < fromSec) {
        // Older than our 1-month window; stop collecting further pages
        return transactions;
      }

      const timestamp = tsSec
        ? new Date(tsSec * 1000).toISOString()
        : new Date().toISOString();

      let direction: WalletTransaction["direction"] = "unknown";
      if (entry.direction === "in" || entry.direction === "out") {
        direction = entry.direction;
      }
      const counterparty = typeof entry.counterparty === "string" ? entry.counterparty : "";

      let from = address;
      let to = address;
      if (direction === "in") {
        from = counterparty || address;
        to = address;
      } else if (direction === "out") {
        from = address;
        to = counterparty || address;
      }

      const mint = typeof entry.mint === "string" ? entry.mint : "";
      const amountRaw = 
        typeof entry.amountRaw === "number" && Number.isFinite(entry.amountRaw) 
          ? entry.amountRaw
          : undefined
      const decimal = 
        typeof entry.decimal === "number" && Number.isFinite(entry.decimal) 
          ? entry.decimal
          : undefined
        
      const amount = 
        (typeof amountRaw === "number" && typeof decimal === "number")
          ? amountRaw /  10 ** decimal
          : entry.amount
      // const amount =
      //   typeof entry.amount === "number" && Number.isFinite(entry.amount)
      //     ? entry.amount
      //     : undefined;
      const symbol =
        entry.symbol != null && entry.symbol !== ""
          ? String(entry.symbol)
          : undefined;

      const hash = String(entry.signature ?? "");
      if (!hash) continue;

      const txObj: WalletTransaction = {
        hash,
        timestamp,
        from,
        to,
        status: true,
        fee: undefined,
        mainAction: undefined,
        direction,
        tokens: mint ? [mint] : undefined,
        primaryTokenSymbol: symbol != null ? symbol : mint || undefined,
        primaryTokenAmount: amount,
        primaryTokenAddress: mint || undefined,
        priceUsd: undefined, // Will be populated after fetching market data
        totalUsd: undefined,
      };

      transactions.push(txObj);
    }

    const hasMore = Boolean(json?.pagination?.hasMore);
    cursor =
      typeof json?.pagination?.nextCursor === "string" &&
      json.pagination.nextCursor.length > 0
        ? json.pagination.nextCursor
        : null;

    if (!hasMore || !cursor) {
      break;
    }
  }

  return transactions;
}



// function toPubkey(entry: any): string {
//     if (!entry) return "";
//     if (typeof entry === "string") return entry;
//     if (typeof entry.pubkey === "string") return entry.pubkey;
//     return "";
// }

export async function fetchHeliusSolanaTransfers(
  address: string,
  maxCount: number,
): Promise<WalletTransfer[]> {
    const nowSec = Math.floor(Date.now() / 1000);
    const ONE_MONTH_SEC = 30 * 24 * 60 * 60;
    const fromSec = nowSec - ONE_MONTH_SEC;

    const transfers: WalletTransfer[] = [];
    let cursor: string | null = null;


    // Fetch pages until we hit maxCount, run out of data, or reach beyond 1 month.
    // Uses Wallet API: GET /v1/wallet/{wallet}/transfers (available on free plan).
    while (transfers.length < maxCount) {
        const url = getEndpoint(`/v1/wallet/${address}/transfers`);
        url.searchParams.set("limit", String(Math.min(100, maxCount - transfers.length)));
        if (cursor) {
        url.searchParams.set("cursor", cursor);
        }

        let json: any = null;
        try {
            const headers = getRequiredHeaders();
            const resp = await fetch(url, {
                method: "GET",
                headers,
            });

            if (!resp.ok) {
                console.error(
                "Helius wallet transfers error",
                resp.status,
                resp.statusText,
                );
                break;
            }

            json = await resp.json();
        } catch (err) {
            console.error("Helius wallet transfers request failed", err);
            break;
        }

        const data: any[] = Array.isArray(json?.data) ? json.data : [];

        if (data.length === 0) {
            break;
        }

        for (const entry of data) {
            if (transfers.length >= maxCount) break;

            const direction = entry.direction;
            let from = '';
            let to = '';

            if (direction === 'in') {
                from = String(entry.counterparty ?? "");
                to = address;
            } else {
                from = address;
                to = String(entry.counterparty ?? "");
            }

            const amountRaw = 
                typeof entry.amountRaw === "number" && Number.isFinite(entry.amountRaw) 
                ? entry.amountRaw
                : undefined

            const decimal = 
                typeof entry.decimal === "number" && Number.isFinite(entry.decimal) 
                ? entry.decimal
                : undefined
            
            const amount = 
                (typeof amountRaw === "number" && typeof decimal === "number")
                ? amountRaw /  10 ** decimal
                : entry.amount

            const transferEntry: WalletTransfer = {
                from: from,
                to: to,
                // In the according token units
                amount: amount,
                timestamp: entry.timestamp,
                tokenAddress: entry.mint,
                tokenSymbol: entry.symbol,
                transactionSignature: entry.signature,
                instructionIndex: 0, // what is this even for?
            };

            transfers.push(transferEntry);
        }

        const hasMore = Boolean(json?.pagination?.hasMore);
        cursor =
            typeof json?.pagination?.nextCursor === "string" &&
            json.pagination.nextCursor.length > 0
                ? json.pagination.nextCursor
                : null;

        if (!hasMore || !cursor) {
            break;
        }
    }

    return transfers;
}

export async function fetchHeliusSolanaSwap(
    address: string,
    maxCount: number,
): Promise<WalletSwap[]> {
    const nowSec = Math.floor(Date.now() / 1000);
    const ONE_MONTH_SEC = 30 * 24 * 60 * 60;
    const fromSec = nowSec - ONE_MONTH_SEC;

    const swaps: WalletSwap[] = [];
    let cursor: string | null = null;

    // Fetch pages until we hit maxCount, run out of data, or reach beyond 1 month.
    // Uses Wallet API: GET /v1/wallet/{wallet}/history (available on free plan).
    while (swaps.length < maxCount) {
        const url = getEndpoint(`/v1/wallet/${address}/history?type=SWAP&tokenAccounts=balanceChanged`);
      url.searchParams.set("limit", String(Math.min(100, maxCount - swaps.length)));
        if (cursor) {
            url.searchParams.set("cursor", cursor);
        }

        let json: any = null;
        try {
            const headers = getRequiredHeaders();
            const resp = await fetch(url, {
                method: "GET",
                headers,
            });

            if (!resp.ok) {
                console.error(
                "Helius wallet transaction error",
                resp.status,
                resp.statusText,
                );
                break;
            }

            json = await resp.json();
        } catch (err) {
            console.error("Helius wallet transaction request failed", err);
            break;
        }

        const data: any[] = Array.isArray(json?.data) ? json.data : [];

        if (data.length === 0) {
        break;
        }

        for (const entry of data) {
            if (swaps.length >= maxCount) break;

            const tsSec =
                typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
                ? entry.timestamp
                : null;

            if (tsSec == null || tsSec < fromSec) {
                return swaps;
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

          // First two entries represent swap legs; remaining entries are fee-related movements.
            const swapBalanceChanges = mappedBalanceChanges.slice(0, 2);

            const txObj: WalletSwap = {
                walletAddress: address,
                signature: String(entry.signature ?? ""),
                timestamp: new Date(tsSec * 1000).toISOString(),
                slot: Number(entry.slot ?? 0),
                fee: Number(entry.fee ?? 0),
                feePayer: String(entry.feePayer ?? ""),
                balanceChanges: swapBalanceChanges,
            };

          swaps.push(txObj);
        }

        const hasMore = Boolean(json?.pagination?.hasMore);
        cursor =
            typeof json?.pagination?.nextCursor === "string"
            && json.pagination.nextCursor.length > 0
                ? json.pagination.nextCursor
                : null;

        if (!hasMore || !cursor) {
            break;
        }
    }

    return swaps;
}