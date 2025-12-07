import { WALLET_BALANCES_TTL_MS } from "@/config/constants.js";
import { db } from "@/db/index.js";
import {
  walletBalances,
  wallets,
  type WalletBalanceInsert,
} from "@/db/schema.js";
import { excluded } from "@/util/orm-sql.js";
import * as sim from "@/util/util-sim.js";
import { eq } from "drizzle-orm";

interface SIM_Balance {
  name: string;
  symbol: string;
  address: string;
  // in lamports
  amount: number;
  // in lamports
  balance: string;
  value_usd: number;
  // in lamports
  raw_balance: string;
  decimals: number;
}

interface SIM_BalancesResponse {
  balances: SIM_Balance[];
}

async function fetchWalletBalances(walletAddress: string) {
  const simEndpoint = sim.getEndpoint(`/balances/${walletAddress}`);
  simEndpoint.search = new URLSearchParams({
    chains: "solana",
  }).toString();

  const req = new Request(simEndpoint, {
    method: "GET",
    headers: sim.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (resp.ok) {
    const data: SIM_BalancesResponse = await resp.json();
    console.log(data);

    const balanceList: WalletBalanceInsert[] = data.balances.map(
      (rawBalance) => ({
        address: walletAddress,
        tokenAddress: rawBalance.address,
        amount: rawBalance.amount / 10 ** rawBalance.decimals,
        valueUsd: rawBalance.value_usd,
        totalValueUsd: rawBalance.value_usd,
      }),
    );

    await db
      .insert(wallets)
      .values({
        address: walletAddress,
        balanceCount: balanceList.length,
      })
      .onConflictDoUpdate({
        target: [wallets.address],
        set: {
          balanceCount: excluded(wallets.balanceCount),
        },
      });

    if (balanceList.length > 0) {
      return await db
        .insert(walletBalances)
        .values(balanceList)
        .onConflictDoUpdate({
          target: [walletBalances.address, walletBalances.tokenAddress],
          set: {
            amount: excluded(walletBalances.amount),
            valueUsd: excluded(walletBalances.valueUsd),
            totalValueUsd: excluded(walletBalances.totalValueUsd),
          },
        })
        .returning();
    }

    return balanceList;
  }

  return null;
}

export async function getWalletBalances(walletAddress: string) {
  const thresholdDate = new Date(Date.now() - WALLET_BALANCES_TTL_MS);

  // Check if wallet exists and if data is fresh
  const walletData = await db
    .select()
    .from(wallets)
    .where(eq(wallets.address, walletAddress))
    .limit(1);

  if (walletData.length == 0 || walletData[0].updatedAt < thresholdDate) {
    // Data is stale or doesn't exist, fetch new data
    return await fetchWalletBalances(walletAddress);
  }

  // Data is fresh, return cached balances
  const res = await db
    .select()
    .from(walletBalances)
    .where(eq(walletBalances.address, walletAddress));

  return res;
}
