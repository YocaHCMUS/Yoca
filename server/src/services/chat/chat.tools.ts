import { getWalletOverview } from "@sv/services/wallet/walletOverview.service.js";
import { getWalletSwaps, getWalletTransfers } from "@sv/services/wallet/walletTransfersSwaps.service.js";
import { getWalletBalanceHistory, getCumulativePnL } from "@sv/services/wallet/walletCharts.service.js";
import { getWalletPortfolio } from "@sv/services/wallet/walletPortfolio.service.js";
import { getDailyTradingVolumeFromDb } from "@sv/services/charts/dailyTradingVolume.service.js";
import type { DailyTradingVolumeResponse } from "@sv/services/charts/dailyTradingVolume.service.js";
import type { ChatToolDefinition } from "./chat.types.js";
import { z } from "zod";

// ─── Tool Definitions ───────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: ChatToolDefinition[] = [
  {
    name: "get_wallet_overview",
    description:
      "Fetch portfolio summary for a wallet address: total balance in USD, 24h change, trading volume, PnL, token holdings count, and activity metrics across time periods (24H, 7D, 30D, 90D).",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_wallet_swaps",
    description:
      "Fetch recent swap transactions for a wallet. Returns list of trades with bought/sold token details, USD value, and timestamps.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        limit: { type: "number", description: "Max number of swaps to return (default 20)" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_wallet_transfers",
    description:
      "Fetch recent token transfers for a wallet. Returns incoming/outgoing transfers with amount, USD value, token info, and timestamps.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        limit: { type: "number", description: "Max number of transfers to return (default 20)" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_balance_history",
    description:
      "Fetch wallet balance over time (USD). Returns daily balance data points for a time period. Useful for balance trend charts.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        timePeriod: {
          type: "string",
          enum: ["7D", "30D"],
          description: "Time period for balance history (default 30D)",
        },
      },
      required: ["address"],
    },
  },
  // {
  //   name: "get_trading_volume",
  //   description:
  //     "Fetch daily trading volume (USD) for a wallet. Returns volume data series by date. Useful for volume trend charts.",
  //   input_schema: {
  //     type: "object",
  //     properties: {
  //       address: { type: "string", description: "Solana wallet address (base58)" },
  //       period: {
  //         type: "string",
  //         enum: ["7D", "30D", "60D", "90D", "1Y"],
  //         description: "Time period for volume data (default 30D)",
  //       },
  //     },
  //     required: ["address"],
  //   },
  // },
  {
    name: "get_wallet_pnl",
    description:
      "Fetch profit & loss breakdown for a wallet. Returns per-token realized PnL, trade counts, win rates, and top profitable/losing tokens.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_pnl_chart",
    description:
      "Fetch PnL time series data for a wallet. Returns daily PnL and cumulative PnL data points over a time period. Useful for PnL trend charts.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        timePeriod: {
          type: "string",
          enum: ["7D", "30D"],
          description: "Time period for PnL data (default 30D)",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "get_wallet_portfolio",
    description:
      "Fetch current token holdings for a wallet. Returns list of tokens with amount, USD value, and token metadata.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_historical_portfolio",
    description:
      "Fetch historical token holdings for a wallet. Returns list of tokens with amount, USD value, and token metadata at a past date.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        date: { type: "string", description: "Historical date for portfolio snapshot (YYYY-MM-DD)" },
      },
      required: ["address", "date"],
    },
  }

  // {
  //   name: "get_wallet_audit",
  //   description:
  //     "Run an AI forensic audit on a wallet. Returns behavioral persona classification, trust score, summary, observations, and red flags.",
  //   input_schema: {
  //     type: "object",
  //     properties: {
  //       address: { type: "string", description: "Solana wallet address (base58)" },
  //     },
  //     required: ["address"],
  //   },
  // },
];

// ─── Tool Execution ─────────────────────────────────────────────────────────

function extractSwapsForLLM(swaps: unknown, limit: number): unknown {
  if (!swaps || typeof swaps !== "object") return [];
  const s = swaps as { swaps?: unknown[] };
  if (!Array.isArray(s.swaps)) return [];
  return (s.swaps.slice(0, limit) as Record<string, unknown>[]).map((swap) => ({
    txHash: swap.transactionHash,
    timestamp: swap.blockTimestampIso,
    bought: swap.bought,
    sold: swap.sold,
    totalValueUsd: swap.totalValueUsd,
    dex: swap.subcategory,
  }));
}

function extractTransfersForLLM(transfers: unknown, limit: number): unknown {
  if (!transfers || typeof transfers !== "object") return [];
  const t = transfers as { transfers?: unknown[] };
  if (!Array.isArray(t.transfers)) return [];
  return (t.transfers.slice(0, limit) as Record<string, unknown>[]).map((tr) => ({
    from: tr.from,
    to: tr.to,
    amount: tr.amount,
    amountUsd: tr.amountUsd,
    token: tr.tokenSymbol,
    timestamp: tr.timestamp,
  }));
}

function extractPortfolioForLLM(portfolio: unknown): unknown {
  if (!Array.isArray(portfolio)) return [];
  return portfolio.slice(0, 20).map((item: Record<string, unknown>) => ({
    token: item.symbol,
    name: item.name,
    amount: item.amount,
    valueUsd: item.valueUsd,
    change24h: item.change24hPercent,
    address: item.tokenAddress,
  }));
}

function extractOverviewForLLM(overview: unknown): unknown {
  if (!overview || typeof overview !== "object") return null;
  const o = overview as Record<string, unknown>;
  return {
    totalBalance: o.totalAssetValueUsd,
    holdingsCount: o.tokensHoldingCount,
    tradingVolume24h: o.tradingVolumeUsd24h,
    pnlTotal: o.pnlUsdTotal,
    txCount24h: o.transactionCount24h,
    tokensTraded: o.tokensTradedCount,
    periods: o.periods,
  };
}

function extractBalanceHistoryForLLM(data: unknown): unknown {
  if (!Array.isArray(data)) return [];
  return data.map((point: Record<string, unknown>) => ({
    date: new Date(point.timestampMs as number).toISOString().slice(0, 10),
    value: point.usdValue,
  }));
}

function extractDailyVolumeForLLM(data: DailyTradingVolumeResponse | null, address: string): unknown {
  if (!data || !data.wallets) return [];
  const walletSeries = data.wallets.find((w) => w.walletAddress === address);
  if (!walletSeries) return [];
  return data.dates.map((date, i) => ({
    date,
    volume: walletSeries.volumes[i] ?? 0,
  }));
}

function extractPnLForLLM(data: unknown): unknown {
  if (!data || typeof data !== "object") return null;
  const p = data as Record<string, unknown>;
  return {
    dailyPnL: Array.isArray(p.dailyPnL)
      ? (p.dailyPnL as Array<Record<string, unknown>>).map((d) => ({
        date: new Date(d.timestamp as number).toISOString().slice(0, 10),
        pnl: d.value,
      }))
      : [],
    cumulativePnL: Array.isArray(p.cumulativePnL)
      ? (p.cumulativePnL as Array<Record<string, unknown>>).map((d) => ({
        date: new Date(d.timestamp as number).toISOString().slice(0, 10),
        pnl: d.value,
      }))
      : [],
    startBalance: p.startBalance,
    endBalance: p.endBalance,
  };
}

function extractSwapSummaryForLLM(data: unknown): unknown {
  if (!data || typeof data !== "object") return null;
  const s = data as Record<string, unknown>;
  const breakdowns = Array.isArray(s.allTokenBreakdowns)
    ? (s.allTokenBreakdowns as Array<Record<string, unknown>>).map((b) => ({
      token: b.symbol,
      name: b.name,
      pnlUsd: b.pnlUsd,
      trades: b.trades,
      wins: b.wins,
      totalEntered: b.totalEntered,
      totalExited: b.totalExited,
    }))
    : [];
  return {
    tradeCount: s.tradeCount,
    realizedPnlUsd: s.realizedPnlUsd,
    winRate: s.winningPercentage,
    totalBoughtUsd: s.totalBoughtUsd,
    totalSoldUsd: s.totalSoldUsd,
    topProfitable: s.topProfitable,
    topLoser: s.topLoser,
    tokenBreakdowns: breakdowns,
    summary: s.summary,
    riskNotes: s.riskNotes,
  };
}

function extractAuditForLLM(data: unknown): unknown {
  if (!data || typeof data !== "object") return null;
  const a = data as Record<string, unknown>;
  return {
    persona: a.persona,
    trustScore: a.trustScore,
    summary: a.summary,
    observations: a.observations,
    txCount: a.transactionCount,
  };
}

// ─── Handler Map ────────────────────────────────────────────────────────────

const limitSchema = z.object({
  address: z.string().min(1),
  limit: z.number().optional().default(20),
});

const periodSchema = z.object({
  address: z.string().min(1),
  timePeriod: z.enum(["7D", "30D", "60D", "90D", "1Y"]).optional().default("30D"),
});

const periodVolSchema = z.object({
  address: z.string().min(1),
  period: z.enum(["7D", "30D", "60D", "90D", "1Y"]).optional().default("30D"),
});

const addressOnlySchema = z.object({
  address: z.string().min(1),
});

export const TOOL_HANDLERS: Record<
  string,
  (input: Record<string, unknown>) => Promise<{ data: unknown; llmData: unknown }>
> = {
  get_wallet_overview: async (input) => {
    const { address } = addressOnlySchema.parse(input);
    const data = await getWalletOverview(address);
    return { data, llmData: extractOverviewForLLM(data) };
  },

  get_wallet_swaps: async (input) => {
    const { address, limit } = limitSchema.parse(input);
    const data = await getWalletSwaps(address);
    return { data, llmData: extractSwapsForLLM(data, limit) };
  },

  get_wallet_transfers: async (input) => {
    const { address, limit } = limitSchema.parse(input);
    const data = await getWalletTransfers(address);
    return { data, llmData: extractTransfersForLLM(data, limit) };
  },

  get_balance_history: async (input) => {
    const { address, timePeriod } = periodSchema.parse(input);
    const data = await getWalletBalanceHistory(address, timePeriod);
    return { data, llmData: extractBalanceHistoryForLLM(data) };
  },

  get_trading_volume: async (input) => {
    const { address, period } = periodVolSchema.parse(input);
    const data = await getDailyTradingVolumeFromDb(period, [address]);
    return { data, llmData: extractDailyVolumeForLLM(data, address) };
  },

  get_wallet_pnl: async (input) => {
    const { address } = addressOnlySchema.parse(input);
    const { getWalletAiSwapSummary } = await import(
      "@sv/services/wallet/walletAiSwapSummary.service.js"
    );
    const data = await getWalletAiSwapSummary(address);
    return { data, llmData: extractSwapSummaryForLLM(data) };
  },

  get_pnl_chart: async (input) => {
    const { address, timePeriod } = periodSchema.parse(input);
    const data = await getCumulativePnL(address, timePeriod);
    return { data, llmData: extractPnLForLLM(data) };
  },

  // get_top_tokens: async (input) => {
  //   const { address } = addressOnlySchema.parse(input);
  //   const data = await getWalletPortfolio(address);
  //   return { data, llmData: extractPortfolioForLLM(data) };
  // },

  get_wallet_audit: async (input) => {
    const { address } = addressOnlySchema.parse(input);
    const { getWalletAudit } = await import(
      "@sv/services/wallet/walletAudit.service.js"
    );
    const data = await getWalletAudit(address);
    return { data, llmData: extractAuditForLLM(data) };
  },

  get_wallet_portfolio: async (input) => {
    const { address } = addressOnlySchema.parse(input);
    const data = await getWalletPortfolio(address);
    return { data, llmData: extractPortfolioForLLM(data) };
  },

  get_historical_portfolio: async (input) => {
    const { address, date } = z.object({
      address: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input);
    const { getHistoricalPortfolio } = await import(
      "@sv/services/wallet/walletHistoricalPortfolio.service.js"
    );
    const data = await getHistoricalPortfolio(address, date);
    return { data, llmData: extractPortfolioForLLM(data) };
  }
};

// ─── Router ─────────────────────────────────────────────────────────────────

export function findTool(name: string): ChatToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

export function hasTool(name: string): boolean {
  return name in TOOL_HANDLERS;
}
