type DataTransformer = (fullData: unknown) => unknown;

const balanceHistoryTransformer: DataTransformer = (data) => {
  const points = Array.isArray(data) ? data : [];
  return {
    labels: (points as Array<{ usdValue: number; timestampMs: number }>).map((p) =>
      new Date(p.timestampMs).toISOString().slice(0, 10),
    ),
    datasets: [
      {
        name: "Balance",
        values: (points as Array<{ usdValue: number }>).map((p) => p.usdValue),
      },
    ],
  };
};

const pnlChartTransformer: DataTransformer = (data) => {
  const d = (data as { dailyPnL?: Array<{ timestamp: number; value: number }>; cumulativePnL?: Array<{ timestamp: number; value: number }> }) ?? {};
  const daily = d.dailyPnL ?? [];
  const cumulative = d.cumulativePnL ?? [];
  const allTimestamps = [...new Set([...daily.map((p) => p.timestamp), ...cumulative.map((p) => p.timestamp)])].sort();
  return {
    labels: allTimestamps.map((ts) => new Date(ts).toISOString().slice(0, 10)),
    datasets: [
      {
        name: "Daily PnL",
        values: allTimestamps.map((ts) => daily.find((p) => p.timestamp === ts)?.value ?? null),
      },
      {
        name: "Cumulative PnL",
        values: allTimestamps.map((ts) => cumulative.find((p) => p.timestamp === ts)?.value ?? null),
      },
    ],
  };
};

const tokenPrice24hTransformer: DataTransformer = (data) => {
  const points = Array.isArray(data) ? data : [];
  const typed = points as Array<{ unixTimestampMs: number; price: number }>;
  return {
    labels: typed.map((p) => new Date(p.unixTimestampMs).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })),
    datasets: [{ name: "Price", values: typed.map((p) => p.price) }],
  };
};

const tokenPriceDailyTransformer: DataTransformer = (data) => {
  const points = Array.isArray(data) ? data : [];
  const typed = points as Array<{ unixTimestampMs: number; price: number }>;
  return {
    labels: typed.map((p) => new Date(p.unixTimestampMs).toISOString().slice(0, 10)),
    datasets: [{ name: "Price", values: typed.map((p) => p.price) }],
  };
};

const swapFieldMap: Record<string, string> = {
  transactionHash: "txHash",
  blockTimestampIso: "timestamp",
  subcategory: "dex",
};

const transferFieldMap: Record<string, string> = {
  tokenSymbol: "token",
};

const portfolioFieldMap: Record<string, string> = {
  symbol: "token",
  change24hPercent: "change24h",
  tokenAddress: "address",
};

function normalizeArray(arr: unknown[], fieldMap: Record<string, string>): unknown[] {
  return (arr as Record<string, unknown>[]).map((item) => {
    const copy = { ...item };
    for (const [from, to] of Object.entries(fieldMap)) {
      if (from in copy && !(to in copy)) {
        copy[to] = copy[from];
      }
    }
    return copy;
  });
}

const swapsTransformer: DataTransformer = (data) => {
  const d = data as { swaps?: unknown[] } | null;
  const arr = d?.swaps ?? [];
  return normalizeArray(arr, swapFieldMap);
};

const transfersTransformer: DataTransformer = (data) => {
  const d = data as { transfers?: unknown[] } | null;
  const arr = d?.transfers ?? [];
  return normalizeArray(arr, transferFieldMap);
};

const portfolioTransformer: DataTransformer = (data) => {
  if (!Array.isArray(data)) return [];
  return normalizeArray(data, portfolioFieldMap);
};

export const DATA_TRANSFORMERS: Record<string, DataTransformer> = {
  get_balance_history: balanceHistoryTransformer,
  get_pnl_chart: pnlChartTransformer,
  get_token_price_24h: tokenPrice24hTransformer,
  get_token_price_hourly: tokenPrice24hTransformer,
  get_token_price_daily: tokenPriceDailyTransformer,
  get_wallet_swaps: swapsTransformer,
  get_wallet_transfers: transfersTransformer,
  get_wallet_portfolio: portfolioTransformer,
  get_historical_portfolio: portfolioTransformer,
};
