import type {
  WalletSwap,
  WalletTransfer,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import type { HeliusEnhancedTransaction } from "@sv/services/transactions.js";
import { fetchHeliusAddressTransactions } from "./helius-tx-fetcher.js";
import { mapHeliusTxsToSwaps } from "./helius-to-swap.js";
import { mapHeliusTxsToTransfers } from "./helius-to-transfer.js";

export type HeliusProviderResult = {
  swaps: WalletSwap[];
  transfers: WalletTransfer[];
  cursor: string | null;
  hasMore: boolean;
};

export async function fetchAndProcessWalletTransactions(
  address: string,
  options?: {
    limit?: number;
    before?: string;
    fromMs?: number;
    toMs?: number;
  },
): Promise<HeliusProviderResult> {
  const { transactions, cursor, hasMore } = await fetchHeliusAddressTransactions(
    address,
    {
      limit: options?.limit,
      before: options?.before,
      fromMs: options?.fromMs,
      toMs: options?.toMs,
    },
  );

  if (transactions.length === 0) {
    return { swaps: [], transfers: [], cursor: null, hasMore: false };
  }

  const swaps = mapHeliusTxsToSwaps(transactions, address);
  const transfers = mapHeliusTxsToTransfers(transactions, address);

  return { swaps, transfers, cursor, hasMore };
}

export type { HeliusEnhancedTransaction };
