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
import type { ChatToolDefinition } from "./chat.types.js";
import { isBaseAsset } from "@sv/services/wallet/walletDayActivity.service.js";
import { z } from "zod";

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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
        limit: { type: "number", description: "Max number of swaps to return (default 20)" },
        tokenAddress: { type: "string", description: "Token mint address (base58) to filter swaps. NOT the symbol/name. Example: 'So11111111111111111111111111111111111111112' for SOL. Call search_token first if you only have a symbol." },
        type: { type: "string", enum: ["buy", "sell"], description: "Filter by swap direction: buy = token enters wallet, sell = token leaves wallet" },
        fromMs: { type: "number", description: "Start of time window (milliseconds since epoch). Defaults to 30 days ago." },
        toMs: { type: "number", description: "End of time window (milliseconds since epoch). Defaults to now." },
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
        limit: { type: "number", description: "Max number of transfers to return (default 20)" },
        tokenAddress: { type: "string", description: "Token mint address (base58) to filter transfers. NOT the symbol/name. Example: 'So11111111111111111111111111111111111111112' for SOL. Call search_token first if you only have a symbol." },
        direction: { type: "string", enum: ["in", "out"], description: "Filter by transfer direction: in = funds arriving, out = funds leaving" },
        fromMs: { type: "number", description: "Start of time window (milliseconds since epoch). Defaults to 30 days ago." },
        toMs: { type: "number", description: "End of time window (milliseconds since epoch). Defaults to now." },
        minAmountUsd: { type: "number", description: "Minimum USD value to include (skips dust transfers)" },
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
      "Fetch profit & loss breakdown for a wallet. Returns per-token realized PnL, trade counts, win rates, and top profitable/losing tokens. Optionally filter by time range or a specific token address.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address (base58)" },
        fromMs: { type: "number", description: "Start time (epoch ms) — only swaps after this time are included in PnL computation" },
        toMs: { type: "number", description: "End time (epoch ms) — only swaps before this time are included in PnL computation" },
        tokenAddress: { type: "string", description: "Token mint address (base58) to filter PnL. NOT the symbol/name. Example: 'So11111111111111111111111111111111111111112' for SOL. Call search_token first if you only have a symbol." },
      },
      required: ["address"],
    },
  },
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
];

// ─── Tool Execution ─────────────────────────────────────────────────────────

function extractSwapsForLLM(
  swaps: unknown,
  limit: number,
  type?: "buy" | "sell",
): unknown {
  if (!swaps || typeof swaps !== "object") return [];
  const s = swaps as { swaps?: unknown[] };
  if (!Array.isArray(s.swaps)) return [];

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

  return filtered.slice(0, limit).map((swap) => ({
    txHash: swap.transactionHash,
    timestamp: swap.blockTimestampIso,
    bought: swap.bought,
    sold: swap.sold,
    totalValueUsd: swap.totalValueUsd,
    dex: swap.subcategory,
  }));
}

function extractTransfersForLLM(
  transfers: unknown,
  limit: number,
): unknown {
  if (!transfers || typeof transfers !== "object") return [];
  const t = transfers as { transfers?: unknown[] };
  if (!Array.isArray(t.transfers)) return [];

  return t.transfers.slice(0, limit).map((tr) => ({
    from: (tr as Record<string, unknown>).from,
    to: (tr as Record<string, unknown>).to,
    amount: (tr as Record<string, unknown>).amount,
    amountUsd: (tr as Record<string, unknown>).amountUsd,
    token: (tr as Record<string, unknown>).tokenSymbol,
    tokenAddress: (tr as Record<string, unknown>).tokenAddress,
    timestamp: (tr as Record<string, unknown>).timestamp,
  }));
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
  limit: z.number().optional().default(3000),
  tokenAddress: z.string().regex(BASE58_REGEX, "Must be a valid base58 token mint address").optional(),
  type: z.enum(["buy", "sell"]).optional(),
  fromMs: z.number().optional(),
  toMs: z.number().optional(),
});

const transfersFilterSchema = z.object({
  address: z.string().min(1),
  limit: z.number().optional().default(3000),
  tokenAddress: z.string().regex(BASE58_REGEX, "Must be a valid base58 token mint address").optional(),
  direction: z.enum(["in", "out"]).optional(),
  fromMs: z.number().optional(),
  toMs: z.number().optional(),
  minAmountUsd: z.number().optional(),
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
    const { address, limit, tokenAddress, type, fromMs, toMs } = swapsFilterSchema.parse(input);
    const data = await getWalletSwaps(address, fromMs, toMs, tokenAddress);
    return { data, llmData: extractSwapsForLLM(data, limit, type) };
  },

  get_wallet_transfers: async (input) => {
    const { address, limit, tokenAddress, direction, fromMs, toMs, minAmountUsd } = transfersFilterSchema.parse(input);
    const data = await getWalletTransfers(address, fromMs, toMs, tokenAddress, direction, minAmountUsd);
    return { data, llmData: extractTransfersForLLM(data, limit) };
  },

  get_balance_history: async (input) => {
    const { address, timePeriod } = periodSchema.parse(input);
    const data = await getWalletBalanceHistory(address, timePeriod);
    return { data, llmData: extractBalanceHistoryForLLM(data, address) };
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
  }
};

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
  "get_balance_history",
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
