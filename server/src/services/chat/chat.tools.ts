import { getWalletOverview } from "@sv/services/wallet/walletOverview.service.js";
import { getWalletSwaps, getWalletTransfers } from "@sv/services/wallet/walletTransfersSwaps.service.js";
import { getWalletBalanceHistory, getCumulativePnL } from "@sv/services/wallet/walletCharts.service.js";
import { getWalletPortfolio } from "@sv/services/wallet/walletPortfolio.service.js";
import { getWinrateData } from "@sv/services/charts/winrate.service.js";
import { getTokenMarketData } from "@sv/services/tokens/token-market-data.js";
import { getTokenMeta, getTokenDetails } from "@sv/services/tokens/token-info.js";
import { searchToken } from "./chat-token-search.js";
import { searchNews, searchWeb } from "./chat-web-search.js";
import { getBirdeyeChartData } from "@sv/services/wallet/providers/birdeye-chart-data.js";
import {
  getEndpoint as getBirdeyeEndpoint,
  getRequiredHeaders as getBirdeyeHeaders,
} from "@sv/util/util-birdeye.js";
import type { ChatToolDefinition, ToolCachePolicy } from "./chat.types.js";
import { isBaseAsset, getWalletTxDetail } from "@sv/services/wallet/walletDayActivity.service.js";
import { compactWalletSwaps, compactWalletTransfers } from "@sv/services/wallet/walletTxCompaction.service.js";
import { z } from "zod";

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DETAILED_TX_LIMIT = 100;
const COMPACT_TX_LIMIT = 500;

interface TransactionCoverage {
  limit: number;
  availableCount: number;
  analyzedCount: number;
  returnedCount: number;
  isCapped: boolean;
  scope: "complete_filtered_result" | "limited_filtered_sample";
  note: string;
}

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
      "Fetch recent swap transactions for a wallet. Returns list of trades with bought/sold token details, USD value, and timestamps. Supports filtering by token, swap direction, and time range to narrow results.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        limit: { type: "number", description: "Max number of swaps to return (default 20, max 100)" },
        tokenAddress: { type: "string", description: "Token mint address (base58) to filter swaps. NOT the symbol/name. Example: 'So11111111111111111111111111111111111111112' for SOL. Call search_token first if you only have a symbol." },
        type: { type: "string", enum: ["buy", "sell"], description: "Filter by swap direction: buy = token enters wallet, sell = token leaves wallet" },
        fromMs: { type: "number", description: "Start of time window (milliseconds since epoch). Defaults to 30 days ago." },
        toMs: { type: "number", description: "End of time window (milliseconds since epoch). Defaults to now." },
        minAmountUsd: { type: "number", description: "Minimum USD value to include (skips dust transfers)" },
        maxAmountUsd: { type: "number", description: "Maximum USD value to include (excludes large outliers)" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_wallet_transfers",
    description:
      "Fetch recent token transfers for a wallet. Returns incoming/outgoing transfers with amount, USD value, token info, and timestamps. Supports filtering by token, direction, amount, and time range to narrow results.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        limit: { type: "number", description: "Max number of transfers to return (default 20, max 100)" },
        tokenAddress: { type: "string", description: "Token mint address (base58) to filter transfers. NOT the symbol/name. Example: 'So11111111111111111111111111111111111111112' for SOL. Call search_token first if you only have a symbol." },
        direction: { type: "string", enum: ["in", "out"], description: "Filter by transfer direction: in = funds arriving, out = funds leaving" },
        fromMs: { type: "number", description: "Start of time window (milliseconds since epoch). Defaults to 30 days ago." },
        toMs: { type: "number", description: "End of time window (milliseconds since epoch). Defaults to now." },
        minAmountUsd: { type: "number", description: "Minimum USD value to include (skips dust transfers)" },
        maxAmountUsd: { type: "number", description: "Maximum USD value to include (excludes large outliers)" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_wallet_swaps_compact",
    description:
      "Fetch up to 500 wallet swaps and return a compact aggregate overview by token and buy/sell action. Prefer this for broad trading activity analysis, token summaries, and overview questions instead of raw trade rows.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        limit: { type: "number", description: "Max number of swaps to analyze (default 500, max 500)" },
        tokenAddress: { type: "string", description: "Token mint address (base58) to filter swaps. Call search_token first if you only have a symbol." },
        type: { type: "string", enum: ["buy", "sell"], description: "Filter by swap direction" },
        fromMs: { type: "number", description: "Start of absolute historical time window (milliseconds since epoch)." },
        toMs: { type: "number", description: "End of absolute historical time window (milliseconds since epoch)." },
        minAmountUsd: { type: "number", description: "Minimum USD value to include" },
        maxAmountUsd: { type: "number", description: "Maximum USD value to include" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_wallet_transfers_compact",
    description:
      "Fetch up to 500 wallet transfers and return a compact aggregate overview by token and direction. Prefer this for broad transfer activity analysis and overview questions instead of raw transfer rows.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        limit: { type: "number", description: "Max number of transfers to analyze (default 500, max 500)" },
        tokenAddress: { type: "string", description: "Token mint address (base58) to filter transfers. Call search_token first if you only have a symbol." },
        direction: { type: "string", enum: ["in", "out"], description: "Filter by transfer direction" },
        fromMs: { type: "number", description: "Start of absolute historical time window (milliseconds since epoch)." },
        toMs: { type: "number", description: "End of absolute historical time window (milliseconds since epoch)." },
        minAmountUsd: { type: "number", description: "Minimum USD value to include" },
        maxAmountUsd: { type: "number", description: "Maximum USD value to include" },
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
    name: "get_drawdown_chart",
    description:
      "Fetch drawdown (peak-to-trough decline) chart data for a wallet over time. Returns daily drawdown percentages showing how far the balance has fallen from its most recent peak. Useful for risk assessment and drawdown trend charts.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        timePeriod: {
          type: "string",
          enum: ["7D", "30D"],
          description: "Time period for drawdown data (default 30D)",
        },
      },
      required: ["address"],
    },
  },
  // {
  //   name: "get_wallet_pnl",
  //   description:
  //     "Fetch profit & loss breakdown for a wallet. Returns per-token realized PnL, trade counts, win rates, and top profitable/losing tokens. Optionally filter by time range or a specific token address.",
  //   input_schema: {
  //     type: "object",
  //     properties: {
  //       address: { type: "string", description: "Solana wallet address (base58)" },
  //       fromMs: { type: "number", description: "Start time (epoch ms) — only swaps after this time are included in PnL computation" },
  //       toMs: { type: "number", description: "End time (epoch ms) — only swaps before this time are included in PnL computation" },
  //       tokenAddress: { type: "string", description: "Token mint address (base58) to filter PnL. NOT the symbol/name. Example: 'So11111111111111111111111111111111111111112' for SOL. Call search_token first if you only have a symbol." },
  //     },
  //     required: ["address"],
  //   },
  // },
  {
    name: "get_wallet_winrate",
    description:
      "Fetch winrate (win/loss ratio) for a wallet. Returns winrate %, total trades, winning/losing trade counts, and average win/loss amounts in USD. Data sourced from Birdeye for comprehensive coverage across all tokens ever traded. Supports time periods: 24H, 7D, 30D, All.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        period: { type: "string", enum: ["24H", "7D", "30D", "All"], description: "Time period for winrate calculation (default 30D)" },
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
      "Fetch current token holdings for a wallet. Returns list of tokens with amount, USD value, and token metadata. Supports filtering by minimum value and token search.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        minValueUsd: { type: "number", description: "Only include holdings above this USD value threshold" },
        search: { type: "string", description: "Search token by symbol or name (case-insensitive substring)" },
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
  },
  {
    name: "get_token_price",
    description:
      "Fetch current market data for a token: price in USD, 24h change percentage, market cap, 24h volume, and market cap rank. Covers all Solana tokens via Birdeye (primary) + CoinGecko (fallback). When showing this data in a chart spec, PREFER type 'geckoterminal' over 'line'/'area'.",
    input_schema: {
      type: "object",
      properties: {
        tokenAddress: { type: "string", description: "Token mint address (base58)" },
      },
      required: ["tokenAddress"],
    },
  },
  {
    name: "get_token_price_24h",
    description:
      "Fetch 24-hour intra-day price chart for a token. Returns timestamp-price points. In the chart spec, ALWAYS use type 'geckoterminal' (not 'line'/'area') — set tokenAddress to show an interactive iframe. Covers all Solana tokens via Birdeye (primary) + CoinGecko (fallback).",
    input_schema: {
      type: "object",
      properties: {
        tokenAddress: { type: "string", description: "Token mint address (base58)" },
      },
      required: ["tokenAddress"],
    },
  },
  {
    name: "get_token_price_hourly",
    description:
      "Fetch hourly price chart for a token over a number of days (max 90). Returns hourly timestamp-price points. In the chart spec, ALWAYS use type 'geckoterminal' (not 'line'/'area') — set tokenAddress to show an interactive iframe. Covers all Solana tokens via Birdeye (primary) + CoinGecko (fallback).",
    input_schema: {
      type: "object",
      properties: {
        tokenAddress: { type: "string", description: "Token mint address (base58)" },
        days: { type: "number", description: "Number of days of hourly data (max 90)" },
      },
      required: ["tokenAddress"],
    },
  },
  {
    name: "get_token_price_daily",
    description:
      "Fetch daily price chart for a token over a number of days (max 365). Returns daily timestamp-price points. In the chart spec, ALWAYS use type 'geckoterminal' (not 'line'/'area') — set tokenAddress to show an interactive iframe. Covers all Solana tokens via Birdeye (primary) + CoinGecko (fallback).",
    input_schema: {
      type: "object",
      properties: {
        tokenAddress: { type: "string", description: "Token mint address (base58)" },
        days: { type: "number", description: "Number of days of daily data (max 365)" },
      },
      required: ["tokenAddress"],
    },
  },
  {
    name: "get_token_meta",
    description:
      "Fetch token metadata (name, symbol, logo image URL) for a token mint address. Useful for resolving what a token address represents.",
    input_schema: {
      type: "object",
      properties: {
        tokenAddress: {
          type: "string",
          description: "Token mint address (base58)",
        },
      },
      required: ["tokenAddress"],
    },
  },
  {
    name: "get_token_details",
    description:
      "Fetch detailed token information including description, links (homepage, discord, twitter, telegram), categories, decimals, and metadata (name, symbol, logo) for a token address.",
    input_schema: {
      type: "object",
      properties: {
        tokenAddress: {
          type: "string",
          description: "Token mint address (base58)",
        },
      },
      required: ["tokenAddress"],
    },
  },
  {
    name: "search_token",
    description:
      "Search for a Solana token by symbol or name (case-insensitive). Returns matching tokens with their base58 mint address, symbol, name, and image URL. Use this when you need to resolve a token symbol (e.g. 'SOL', 'USDC', 'BONK') to a base58 mint address before calling other tools.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Token symbol or name to search for (e.g. 'SOL', 'USDC', 'BONK', 'Wojak'). Case-insensitive." },
      },
      required: ["query"],
    },
  },
  {
    name: "search_news",
    description:
      "Search cryptocurrency news articles for current events about a token, project, or market topic. Returns news headlines with links and publication dates. Use this when you need recent news context about a token or project the wallet holds. Not for general web content — use search_web for that.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "News search query (e.g. 'Jupiter aggregator latest news 2025', 'Solana DeFi updates')" },
        count: { type: "number", description: "Number of results (max 10, default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_web",
    description:
      "Search the web for any topic — token analysis, project documentation, market research, technical info, or general knowledge. Returns web page snippets with links. Use this for general web content that news articles wouldn't cover — e.g. project docs, GitHub repos, analysis pieces, announcements. For recent news, prefer search_news.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Web search query (e.g. 'Jupiter DEX documentation', 'BONK tokenomics analysis', 'Solana staking guide 2025')" },
        count: { type: "number", description: "Number of results (max 10, default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "navigate_to_page",
    description:
      "Suggest navigating the user to another page on the site. Call this when the user asks to 'go to', 'show me', 'open', or 'take me to' a wallet, token, market, or transactions page. Returns a suggested navigation action for the frontend to render as a clickable button.",
    input_schema: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: ["wallet", "token", "token_history", "market", "transactions"],
          description: "Target page type",
        },
        params: {
          type: "object",
          description: "Route parameters as JSON (e.g. {\"address\": \"...\"} for wallet/token pages, {\"txHash\": \"...\"} for transactions page)",
        },
      },
      required: ["page"],
    },
  },
  {
    name: "get_tx_detail",
    description:
      "Fetch full detail for a specific transaction by signature: all token transfers within the tx, fee breakdown (base + priority), fee payer, and fee receivers. Use this when the user asks about a specific swap or transfer they saw in a table, or wants to drill into a transaction. NOT for listing — use get_wallet_swaps or get_wallet_transfers for lists.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        signature: { type: "string", description: "Transaction signature (base58) from a swap or transfer entry" },
      },
      required: ["address", "signature"],
    },
  },
];

// ─── Tool Allowed Keys (derived from definitions) ──────────────────────────

const MULTI_ADDRESS_TOOLS = new Set([
  "get_wallet_swaps", "get_wallet_transfers",
  "get_wallet_swaps_compact", "get_wallet_transfers_compact",
  "get_balance_history", "get_drawdown_chart",
  "get_wallet_pnl", "get_wallet_winrate", "get_pnl_chart",
  "get_wallet_portfolio", "get_historical_portfolio",
  "get_tx_detail",
]);

const EXTRA_ALLOWED_KEYS: Record<string, readonly string[]> = {
  // get_wallet_pnl is commented out in TOOL_DEFINITIONS but still has a handler
  get_wallet_pnl: ["address", "addresses", "fromMs", "toMs", "tokenAddress"],
};

export const TOOL_ALLOWED_KEYS: Record<string, readonly string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const def of TOOL_DEFINITIONS) {
    if (!def.name) continue;
    const keys = Object.keys(def.input_schema.properties);
    if (MULTI_ADDRESS_TOOLS.has(def.name) && !keys.includes("addresses")) {
      keys.push("addresses");
    }
    map[def.name] = keys;
  }
  for (const [name, keys] of Object.entries(EXTRA_ALLOWED_KEYS)) {
    map[name] = [...keys];
  }
  return map;
})();

// ─── Tool Execution ─────────────────────────────────────────────────────────

function extractSwapsForLLM(
  swaps: unknown,
  limit: number,
  type?: "buy" | "sell",
): unknown {
  if (!swaps || typeof swaps !== "object") return { coverage: buildTransactionCoverage(0, limit), swaps: [] };
  const s = swaps as { swaps?: unknown[] };
  if (!Array.isArray(s.swaps)) return { coverage: buildTransactionCoverage(0, limit), swaps: [] };

  let filtered = s.swaps as Record<string, unknown>[];

  if (type) {
    filtered = filtered.filter((swap) => {
      const boughtAddr = (swap.bought as Record<string, unknown> | undefined)?.address as string | undefined;
      const soldAddr = (swap.sold as Record<string, unknown> | undefined)?.address as string | undefined;
      const isBuy = !isBaseAsset(boughtAddr) && isBaseAsset(soldAddr);
      const isSell = isBaseAsset(boughtAddr) && !isBaseAsset(soldAddr);
      if (type === "buy" && !isBuy) return false;
      if (type === "sell" && !isSell) return false;
      return true;
    });
  }

  return {
    coverage: buildTransactionCoverage(filtered.length, limit),
    swaps: filtered.slice(0, limit).map((swap) => ({
      txHash: swap.transactionHash,
      timestamp: swap.blockTimestampIso,
      bought: swap.bought,
      sold: swap.sold,
      totalValueUsd: swap.totalValueUsd,
      dex: swap.subcategory,
    })),
  };
}
function extractTransfersForLLM(
  transfers: unknown,
  limit: number,
): unknown {
  if (!transfers || typeof transfers !== "object") return { coverage: buildTransactionCoverage(0, limit), transfers: [] };
  const t = transfers as { transfers?: unknown[] };
  if (!Array.isArray(t.transfers)) return { coverage: buildTransactionCoverage(0, limit), transfers: [] };

  return {
    coverage: buildTransactionCoverage(t.transfers.length, limit),
    transfers: t.transfers.slice(0, limit).map((tr) => ({
      from: (tr as Record<string, unknown>).from,
      to: (tr as Record<string, unknown>).to,
      amount: (tr as Record<string, unknown>).amount,
      amountUsd: (tr as Record<string, unknown>).amountUsd,
      token: (tr as Record<string, unknown>).tokenSymbol,
      tokenAddress: (tr as Record<string, unknown>).tokenAddress,
      timestamp: (tr as Record<string, unknown>).timestamp,
    })),
  };
}

export function buildTransactionCoverage(availableCount: number, limit: number): TransactionCoverage {
  const analyzedCount = Math.min(availableCount, limit);
  const isCapped = availableCount > limit;
  return {
    limit,
    availableCount,
    analyzedCount,
    returnedCount: analyzedCount,
    isCapped,
    scope: isCapped ? "limited_filtered_sample" : "complete_filtered_result",
    note: isCapped
      ? `Analyzed ${analyzedCount} of at least ${availableCount} filtered rows returned for this query window. Do not treat ${analyzedCount} as the complete wallet history.`
      : `Analyzed all ${analyzedCount} filtered rows returned for this query window.`,
  };
}
function extractPortfolioForLLM(
  portfolio: unknown,
  filters?: {
    minValueUsd?: number;
    search?: string;
  },
): unknown {
  if (!Array.isArray(portfolio)) return [];

  let filtered = portfolio as Record<string, unknown>[];

  if (filters?.minValueUsd != null || filters?.search != null) {
    filtered = filtered.filter((item) => {
      if (filters?.minValueUsd != null) {
        const value = item.valueUsd as number | undefined;
        if (value == null || value < filters.minValueUsd) return false;
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const symbol = (item.symbol as string ?? "").toLowerCase();
        const name = (item.name as string ?? "").toLowerCase();
        if (!symbol.includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
  }

  return filtered.slice(0, 20).map((item) => ({
    token: item.symbol,
    name: item.name,
    amount: item.amount,
    valueUsd: item.valueUsd,
    change24h: item.change24hPercent,
    address: item.tokenAddress,
  }));
}

function extractOverviewForLLM(overview: unknown, address: string): unknown {
  if (!overview || typeof overview !== "object") return null;
  const o = overview as Record<string, unknown>;
  return {
    address,
    totalBalance: o.totalAssetValueUsd,
    holdingsCount: o.tokensHoldingCount,
    tradingVolume24h: o.tradingVolumeUsd24h,
    pnlTotal: o.pnlUsdTotal,
    txCount24h: o.transactionCount24h,
    tokensTraded: o.tokensTradedCount,
    periods: o.periods,
  };
}

function extractBalanceHistoryForLLM(data: unknown, address: string): unknown {
  if (!Array.isArray(data)) return { address, points: [] };
  return {
    address,
    points: data.map((point: Record<string, unknown>) => ({
      date: new Date(point.timestampMs as number).toISOString().slice(0, 10),
      value: point.usdValue,
    })),
  };
}

function extractDrawdownForLLM(data: unknown): unknown {
  if (!Array.isArray(data)) return null;
  const typed = data as Array<{ timestamp: number; value: number; drawdown: number }>;
  if (typed.length === 0) return null;
  const maxDrawdown = Math.min(...typed.map((p) => p.drawdown));
  const latestDrawdown = typed[typed.length - 1]?.drawdown ?? 0;
  return {
    dataPoints: typed.map((p) => ({
      date: new Date(p.timestamp).toISOString().slice(0, 10),
      drawdownPercent: p.drawdown,
    })),
    maxDrawdownPercent: maxDrawdown,
    currentDrawdownPercent: latestDrawdown,
    startDate: new Date(typed[0].timestamp).toISOString().slice(0, 10),
    endDate: new Date(typed[typed.length - 1].timestamp).toISOString().slice(0, 10),
  };
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

function extractPnLComputedForLLM(data: unknown): unknown {
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

function extractTokenPriceForLLM(data: unknown): unknown {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) return null;
  const tokenAddress = keys[0];
  const entry = record[tokenAddress] as Record<string, unknown> | undefined;
  if (!entry) return null;
  return {
    tokenAddress,
    priceUsd: entry.priceUsd,
    change24hPercent: entry.priceChangePercentage24h,
    marketCap: entry.marketCap,
    volume24hUsd: entry.volume24h,
    marketCapRank: entry.marketCapRank,
  };
}

function extractChartForLLM(data: unknown, tokenAddress?: string): unknown {
  if (!Array.isArray(data)) return { tokenAddress, points: [] };
  return {
    tokenAddress,
    points: data.slice(0, 500).map((point: Record<string, unknown>) => ({
      timestamp: point.unixTimestampMs,
      price: point.price,
      marketCap: point.marketCap,
      volume: point.totalVolume,
    })),
  };
}

async function fetchBirdeyeCurrentPrice(tokenAddress: string): Promise<Record<string, unknown> | null> {
  if (!process.env.BIRDEYE_API_KEY || !process.env.BIRDEYE_API_BASE_URL) return null;
  try {
    const endpoint = getBirdeyeEndpoint("/defi/token_overview");
    endpoint.searchParams.set("address", tokenAddress);
    const response = await fetch(endpoint, {
      method: "GET",
      headers: getBirdeyeHeaders(),
    });
    if (!response.ok) return null;
    const json = await response.json() as {
      success?: boolean;
      data?: { price?: number; priceChange24hPercent?: number; marketCap?: number; volume24h?: number };
    };
    if (!json.success || !json.data) return null;
    const price = Number(json.data.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) return null;
    const wrapped = {
      [tokenAddress]: {
        priceUsd: price,
        priceChangePercentage24h: json.data.priceChange24hPercent ?? null,
        marketCap: json.data.marketCap ?? null,
        volume24h: json.data.volume24h ?? null,
        marketCapRank: null,
        updatedAt: new Date().toISOString(),
      },
    } as Record<string, unknown>;
    return wrapped;
  } catch {
    return null;
  }
}

function extractWinrateForLLM(data: unknown): unknown {
  if (!data || typeof data !== "object") return null;
  const r = data as { wallets?: unknown[] };
  if (!Array.isArray(r.wallets) || r.wallets.length === 0) return null;
  const w = r.wallets[0] as Record<string, unknown>;
  return {
    winrate: w.winrate,
    totalTrades: w.totalTrades,
    winningTrades: w.winningTrades,
    losingTrades: w.losingTrades,
    avgWinUsd: w.avgWinUsd,
    avgLossUsd: w.avgLossUsd,
  };
}

const ROUTE_MAP: Record<string, (params?: Record<string, string>) => { path: string; label: string }> = {
  wallet: (params) => ({ path: `/wallets/${params?.address ?? ""}`, label: "View Wallet" }),
  token: (params) => ({ path: `/tokens/${params?.address ?? ""}`, label: "View Token" }),
  token_history: (params) => ({ path: `/historical-data/${params?.address ?? ""}`, label: "View Historical Data" }),
  market: () => ({ path: "/market", label: "Go to Market" }),
  transactions: (params) => ({
    path: params?.txHash ? `/transactions/${params.txHash}` : "/transactions",
    label: params?.txHash ? "View Transaction" : "View Transactions",
  }),
};

function extractNavigationForLLM(data: unknown): unknown {
  if (!data || typeof data !== "object") return null;
  const d = data as { path?: string; label?: string };
  return { path: d.path ?? "", label: d.label ?? "" };
}

function extractTxDetailForLLM(data: unknown, walletAddress: string): unknown {
  if (!data || typeof data !== "object") return null;
  const d = data as {
    transactionHash?: string;
    timestamp?: string;
    pair?: string;
    action?: string;
    transfers?: Array<Record<string, unknown>>;
    feePaid?: number;
    feePayer?: string;
    feeReceivers?: Array<Record<string, unknown>>;
  };
  if (!d.transactionHash) return null;

  const transfers = (d.transfers ?? []).map((t) => {
    const from = String(t.from ?? "");
    const to = String(t.to ?? "");
    const isOut = from === walletAddress;
    const isIn = to === walletAddress;
    let direction = "internal";
    if (isOut && !isIn) direction = "out";
    else if (isIn && !isOut) direction = "in";
    return {
      from,
      to,
      mint: t.mint,
      symbol: t.symbol,
      amount: t.amount,
      direction,
    };
  });

  const feeLamports = Number(d.feePaid ?? 0);
  const BASE_FEE = 5_000;
  const priorityFee = Math.max(0, feeLamports - BASE_FEE);

  return {
    txHash: d.transactionHash,
    timestamp: d.timestamp,
    pair: d.pair,
    action: d.action,
    tokenTransfers: transfers,
    fees: {
      feePaidSol: feeLamports / 1e9,
      baseFeeSol: BASE_FEE / 1e9,
      priorityFeeSol: priorityFee / 1e9,
    },
    feePayer: d.feePayer,
    feeReceivers: (d.feeReceivers ?? []).map((r) => ({
      address: r.address,
      amount: r.amount,
    })),
  };
}

function extractTokenMetaForLLM(data: unknown): unknown {
  if (!Array.isArray(data)) return [];
  return data.map((m: Record<string, unknown>) => ({
    address: m.address,
    name: m.name,
    symbol: m.symbol,
    imageUrl: m.imageUrl,
  }));
}

function extractTokenDetailsForLLM(data: unknown): unknown {
  if (!Array.isArray(data) || data.length === 0) return null;
  const item = data[0] as Record<string, unknown> | undefined;
  if (!item) return null;
  const meta = item.meta as Record<string, unknown> | undefined;
  const details = item.details as Record<string, unknown> | undefined;
  if (!meta || !details) return null;
  return {
    address: meta.address,
    name: meta.name,
    symbol: meta.symbol,
    imageUrl: meta.imageUrl,
    decimals: details.decimals,
    description: details.description,
    homepage: details.linkHomepage,
    discord: details.linkDiscord,
    twitter: details.twitterScreenName,
    telegram: details.telegramChannel,
    categories: details.categories,
  };
}

// ─── Handler Map ────────────────────────────────────────────────────────────

const swapsFilterSchema = z.object({
  address: z.string().min(1),
  limit: z.number().int().positive().max(DETAILED_TX_LIMIT).optional().default(20),
  tokenAddress: z.string().regex(BASE58_REGEX, "Must be a valid base58 token mint address").optional(),
  type: z.enum(["buy", "sell"]).optional(),
  fromMs: z.number().optional(),
  toMs: z.number().optional(),
  minAmountUsd: z.number().optional(),
  maxAmountUsd: z.number().optional(),
});

const transfersFilterSchema = z.object({
  address: z.string().min(1),
  limit: z.number().int().positive().max(DETAILED_TX_LIMIT).optional().default(20),
  tokenAddress: z.string().regex(BASE58_REGEX, "Must be a valid base58 token mint address").optional(),
  direction: z.enum(["in", "out"]).optional(),
  fromMs: z.number().optional(),
  toMs: z.number().optional(),
  minAmountUsd: z.number().optional(),
  maxAmountUsd: z.number().optional(),
});

const compactSwapsFilterSchema = swapsFilterSchema.extend({
  limit: z.number().int().positive().max(COMPACT_TX_LIMIT).optional().default(COMPACT_TX_LIMIT),
});

const compactTransfersFilterSchema = transfersFilterSchema.extend({
  limit: z.number().int().positive().max(COMPACT_TX_LIMIT).optional().default(COMPACT_TX_LIMIT),
});

const portfolioFilterSchema = z.object({
  address: z.string().min(1),
  minValueUsd: z.number().optional(),
  search: z.string().optional(),
});

const periodSchema = z.object({
  address: z.string().min(1),
  timePeriod: z.enum(["7D", "30D", "60D", "90D", "1Y"]).optional().default("30D"),
});

const addressOnlySchema = z.object({
  address: z.string().min(1),
});

const tokenAddressSchema = z.object({
  tokenAddress: z.string().regex(BASE58_REGEX, "Must be a valid base58 token mint address"),
});

const tokenAddressDaysSchema = z.object({
  tokenAddress: z.string().regex(BASE58_REGEX, "Must be a valid base58 token mint address"),
  days: z.number().int().positive().max(365).optional().default(7),
});

const txDetailSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
});

const navigatePageSchema = z.object({
  page: z.enum(["wallet", "token", "token_history", "market", "transactions"]),
  params: z.object({
    address: z.string().optional(),
    txHash: z.string().optional(),
  }).optional().default({}),
});

export const TOOL_HANDLERS: Record<
  string,
  (input: Record<string, unknown>) => Promise<{ data: unknown; llmData: unknown }>
> = {
  get_wallet_overview: async (input) => {
    const { address } = addressOnlySchema.parse(input);
    const data = await getWalletOverview(address);
    return { data, llmData: extractOverviewForLLM(data, address) };
  },

  get_wallet_swaps: async (input) => {
    const { address, limit, tokenAddress, type, fromMs, toMs, minAmountUsd, maxAmountUsd } = swapsFilterSchema.parse(input);
    const data = await getWalletSwaps(address, fromMs, toMs, tokenAddress, type, minAmountUsd, maxAmountUsd);
    const coverage = buildTransactionCoverage(data.swaps.length, limit);
    const limited = data.swaps.slice(0, limit);
    return { data: { ...data, swaps: limited, coverage }, llmData: extractSwapsForLLM(data, limit, type) };
  },

  get_wallet_transfers: async (input) => {
    const { address, limit, tokenAddress, direction, fromMs, toMs, minAmountUsd, maxAmountUsd } = transfersFilterSchema.parse(input);
    const data = await getWalletTransfers(address, fromMs, toMs, tokenAddress, direction, minAmountUsd, maxAmountUsd);
    const coverage = buildTransactionCoverage(data.transfers.length, limit);
    const limited = data.transfers.slice(0, limit);
    return { data: { ...data, transfers: limited, coverage }, llmData: extractTransfersForLLM(data, limit) };
  },

  get_wallet_swaps_compact: async (input) => {
    const { address, limit, tokenAddress, type, fromMs, toMs, minAmountUsd, maxAmountUsd } = compactSwapsFilterSchema.parse(input);
    const data = await getWalletSwaps(address, fromMs, toMs, tokenAddress, type, minAmountUsd, maxAmountUsd);
    const coverage = buildTransactionCoverage(data.swaps.length, limit);
    const limited = data.swaps.slice(0, limit);
    const compact = { ...compactWalletSwaps(limited), coverage, analyzedTrades: coverage.analyzedCount, availableTrades: coverage.availableCount };
    return { data: { ...data, swaps: limited, coverage, compact }, llmData: compact };
  },
  get_wallet_transfers_compact: async (input) => {
    const { address, limit, tokenAddress, direction, fromMs, toMs, minAmountUsd, maxAmountUsd } = compactTransfersFilterSchema.parse(input);
    const data = await getWalletTransfers(address, fromMs, toMs, tokenAddress, direction, minAmountUsd, maxAmountUsd);
    const coverage = buildTransactionCoverage(data.transfers.length, limit);
    const limited = data.transfers.slice(0, limit);
    const compact = { ...compactWalletTransfers(limited, address), coverage, analyzedTransfers: coverage.analyzedCount, availableTransfers: coverage.availableCount };
    return { data: { ...data, transfers: limited, coverage, compact }, llmData: compact };
  },
  get_balance_history: async (input) => {
    const { address, timePeriod } = periodSchema.parse(input);
    const data = await getWalletBalanceHistory(address, timePeriod);
    return { data, llmData: extractBalanceHistoryForLLM(data, address) };
  },

  get_drawdown_chart: async (input) => {
    const { address, timePeriod } = periodSchema.parse(input);
    const balanceHistory = await getWalletBalanceHistory(address, timePeriod);
    if (!balanceHistory?.length) {
      return { data: [], llmData: null };
    }

    let peak = balanceHistory[0].usdValue;
    let trough = balanceHistory[0].usdValue;
    const data = balanceHistory.map((point) => {
      if (point.usdValue > peak) { peak = point.usdValue; trough = point.usdValue; }
      if (point.usdValue < trough) { trough = point.usdValue; }
      const drawdown = peak === 0 ? 0 : (point.usdValue - peak) / peak;
      return {
        timestamp: point.timestampMs,
        date: new Date(point.timestampMs).toISOString(),
        value: point.usdValue,
        drawdown,
      };
    });

    return { data, llmData: extractDrawdownForLLM(data) };
  },

  get_wallet_pnl: async (input) => {
    const { address, fromMs, toMs, tokenAddress } = z.object({
      address: z.string().min(1),
      fromMs: z.number().optional(),
      toMs: z.number().optional(),
      tokenAddress: z.string().regex(BASE58_REGEX, "Must be a valid base58 token mint address").optional(),
    }).parse(input);
    const { getWalletPnLComputed } = await import(
      "@sv/services/wallet/walletAiSwapSummary.service.js"
    );
    const data = await getWalletPnLComputed(address, { fromMs, toMs, tokenAddress });
    return { data, llmData: extractPnLComputedForLLM(data) };
  },

  get_wallet_winrate: async (input) => {
    const { address, period } = z.object({
      address: z.string().min(1),
      period: z.enum(["24H", "7D", "30D", "All"]).optional().default("30D"),
    }).parse(input);
    const data = await getWinrateData([address], period);
    return { data, llmData: extractWinrateForLLM(data) };
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
    const { address, minValueUsd, search } = portfolioFilterSchema.parse(input);
    const data = await getWalletPortfolio(address);
    return { data, llmData: extractPortfolioForLLM(data, { minValueUsd, search }) };
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
  },

  get_token_price: async (input) => {
    const { tokenAddress } = tokenAddressSchema.parse(input);
    const data = await getTokenMarketData([tokenAddress]);
    const priceRecord = data && typeof data === "object"
      ? (data as Record<string, Record<string, unknown>>)[tokenAddress]
      : undefined;
    if (priceRecord && Number(priceRecord.priceUsd) > 0) {
      return { data, llmData: extractTokenPriceForLLM(data) };
    }
    const birdeyeData = await fetchBirdeyeCurrentPrice(tokenAddress);
    if (birdeyeData) {
      return { data: birdeyeData, llmData: extractTokenPriceForLLM(birdeyeData) };
    }
    return { data, llmData: extractTokenPriceForLLM(data) };
  },

  get_token_price_24h: async (input) => {
    const { tokenAddress } = tokenAddressSchema.parse(input);
    const data = await getBirdeyeChartData(tokenAddress, "15m", 1);
    return { data, llmData: extractChartForLLM(data, tokenAddress) };
  },

  get_token_price_hourly: async (input) => {
    const { tokenAddress, days } = tokenAddressDaysSchema.parse(input);
    const data = await getBirdeyeChartData(tokenAddress, "1H", days);
    return { data, llmData: extractChartForLLM(data, tokenAddress) };
  },

  get_token_price_daily: async (input) => {
    const { tokenAddress, days } = tokenAddressDaysSchema.parse(input);
    const data = await getBirdeyeChartData(tokenAddress, "1D", days);
    return { data, llmData: extractChartForLLM(data, tokenAddress) };
  },

  get_token_meta: async (input) => {
    const { tokenAddress } = tokenAddressSchema.parse(input);
    const data = await getTokenMeta([tokenAddress]);
    return { data, llmData: extractTokenMetaForLLM(data) };
  },

  get_token_details: async (input) => {
    const { tokenAddress } = tokenAddressSchema.parse(input);
    const data = await getTokenDetails([tokenAddress]);
    return { data, llmData: extractTokenDetailsForLLM(data) };
  },

  search_token: async (input) => {
    const { query } = z.object({
      query: z.string().min(1, "Search query is required"),
    }).parse(input);
    const data = await searchToken(query);
    return { data, llmData: data };
  },

  search_news: async (input) => {
    const { query, count } = z.object({
      query: z.string().min(1, "Search query is required"),
      count: z.number().int().min(1).max(10).optional().default(5),
    }).parse(input);
    const data = await searchNews(query, count);
    return { data, llmData: data.articles };
  },

  search_web: async (input) => {
    const { query, count } = z.object({
      query: z.string().min(1, "Search query is required"),
      count: z.number().int().min(1).max(10).optional().default(5),
    }).parse(input);
    const data = await searchWeb(query, count);
    return { data, llmData: data.articles };
  },

  navigate_to_page: async (input) => {
    const { page, params } = navigatePageSchema.parse(input);
    const resolved = ROUTE_MAP[page](params);
    return { data: resolved, llmData: extractNavigationForLLM(resolved) };
  },
  get_tx_detail: async (input) => {
    const { address, signature } = txDetailSchema.parse(input);
    const data = await getWalletTxDetail(address, signature);
    return { data, llmData: extractTxDetailForLLM(data, address) };
  }
};

// ─── Cache Policy ────────────────────────────────────────────────────────────

/**
 * Per-tool cache TTL + cacheability policy.
 * Used by chat.cache.ts to compute effective cache expiry.
 */
export const TOOL_CACHE_POLICY: Record<string, ToolCachePolicy> = {
  // Price data — very volatile
  get_token_price: { ttlMs: 10_000, cacheable: true },
  get_token_price_24h: { ttlMs: 30_000, cacheable: true },
  get_token_price_hourly: { ttlMs: 60_000, cacheable: true },
  get_token_price_daily: { ttlMs: 120_000, cacheable: true },
  // Web/news — live external, never cache
  search_web: { ttlMs: 0, cacheable: false },
  search_news: { ttlMs: 0, cacheable: false },
  // On-chain wallet data — stable, medium TTL
  get_wallet_swaps: { ttlMs: 300_000, cacheable: true },
  get_wallet_transfers: { ttlMs: 300_000, cacheable: true },
  get_wallet_swaps_compact: { ttlMs: 300_000, cacheable: true },
  get_wallet_transfers_compact: { ttlMs: 300_000, cacheable: true },
  get_wallet_pnl: { ttlMs: 300_000, cacheable: true },
  get_wallet_winrate: { ttlMs: 300_000, cacheable: true },
  get_pnl_chart: { ttlMs: 300_000, cacheable: true },
  get_historical_portfolio: { ttlMs: 300_000, cacheable: true },
  get_wallet_audit: { ttlMs: 300_000, cacheable: true },
  // Birdeye-sourced — short TTL
  get_wallet_overview: { ttlMs: 60_000, cacheable: true },
  get_balance_history: { ttlMs: 60_000, cacheable: true },
  get_wallet_portfolio: { ttlMs: 30_000, cacheable: true },
  // Token metadata — very stable
  get_token_meta: { ttlMs: 600_000, cacheable: true },
  get_token_details: { ttlMs: 600_000, cacheable: true },
  search_token: { ttlMs: 600_000, cacheable: true },
  // Navigation — static
  navigate_to_page: { ttlMs: 600_000, cacheable: true },
  // Tx detail — fairly stable per tx
  get_tx_detail: { ttlMs: 300_000, cacheable: true },
};

/**
 * Compute effective cache TTL from a set of tools used.
 * Returns null if any tool is uncacheable.
 */
export function getEffectiveCacheTtl(tools: string[]): number | null {
  if (tools.length === 0) return 30_000; // direct-answer TTL
  let minTtl = Infinity;
  for (const name of tools) {
    const policy = TOOL_CACHE_POLICY[name];
    if (!policy || !policy.cacheable) return null;
    if (policy.ttlMs < minTtl) minTtl = policy.ttlMs;
  }
  return minTtl;
}

/**
 * Returns true if the set of tools includes any uncacheable tool.
 */
export function hasUncacheableTools(tools: string[]): boolean {
  return tools.some((name) => {
    const policy = TOOL_CACHE_POLICY[name];
    return !policy || !policy.cacheable;
  });
}

// ─── Router ─────────────────────────────────────────────────────────────────

export function findTool(name: string): ChatToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

export function hasTool(name: string): boolean {
  return name in TOOL_HANDLERS;
}

const WALLET_SCOPED_TOOLS = new Set([
  "get_wallet_overview",
  "get_wallet_swaps",
  "get_wallet_transfers",
  "get_wallet_swaps_compact",
  "get_wallet_transfers_compact",
  "get_balance_history",
  "get_drawdown_chart",
  "get_wallet_pnl",
  "get_wallet_winrate",
  "get_pnl_chart",
  "get_wallet_portfolio",
  "get_historical_portfolio",
  "get_wallet_audit",
]);

export function isWalletTool(name: string): boolean {
  return WALLET_SCOPED_TOOLS.has(name);
}
