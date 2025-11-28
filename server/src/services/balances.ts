import { db } from "@db/index.js";
import { walletBalances, wallets } from "@db/schema.js";
import { eq } from "drizzle-orm";
import * as sim from "@util/util-sim.js";
import { WALLET_BALANCES_TTL_MS } from "../config/constants.js";

interface SIM_Balance {
  name: string;
  symbol: string;
  address: string;
  amount: number;
  balance: string;
  value_usd: number;
  raw_balance: string;
  decimals: number;
}

interface SIM_BalancesResponse {
  balances: SIM_Balance[];
}

const defaultLimit = 100;

async function fetchWalletBalances(walletAddress: string) {
  const simEndpoint = sim.getEndpoint(`/balances/${walletAddress}`);
  simEndpoint.search = new URLSearchParams({
    chains: "solana",
    limit: defaultLimit.toString(),
  }).toString();

  const req = new Request(simEndpoint, {
    method: "GET",
    headers: sim.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (resp.ok) {
    const data: SIM_BalancesResponse = await resp.json();

    const balancesList = data.balances.map((rawBalance) => ({
      walletAddress: walletAddress,
      tokenAddress: rawBalance.address,
      amount: rawBalance.amount,
      valueUsd: rawBalance.value_usd,
      totalValueUsd: rawBalance.value_usd,
    }));

    // Update wallet entry
    await db
      .insert(wallets)
      .values({
        address: walletAddress,
        balanceCount: balancesList.length,
      })
      .onConflictDoUpdate({
        target: wallets.address,
        set: {
          balanceCount: balancesList.length,
          updatedAt: new Date(),
        },
      });

    // Insert or update balances
    if (balancesList.length > 0) {
      return await db
        .insert(walletBalances)
        .values(balancesList)
        .onConflictDoUpdate({
          target: [walletBalances.walletAddress, walletBalances.tokenAddress],
          set: {
            amount: balancesList[0].amount,
            valueUsd: balancesList[0].valueUsd,
            totalValueUsd: balancesList[0].totalValueUsd,
            updatedAt: new Date(),
          },
        })
        .returning();
    }
    return balancesList;
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

  if (walletData.length === 0 || walletData[0].updatedAt < thresholdDate) {
    // Data is stale or doesn't exist, fetch new data
    return await fetchWalletBalances(walletAddress);
  }

  // Data is fresh, return cached balances
  const res = await db
    .select()
    .from(walletBalances)
    .where(eq(walletBalances.walletAddress, walletAddress));

  return res;
}
