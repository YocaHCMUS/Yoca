import { z } from "zod";

const heliusNumberishSchema = z.union([z.number(), z.string()]);

export const hls_WalletBalancesSchema = z.object({
  balances: z.array(
    z.object({
      mint: z.string().nullish(),
      symbol: z.string().nullish(),
      name: z.string().nullish(),
      balance: heliusNumberishSchema.nullish(),
      pricePerToken: heliusNumberishSchema.nullish(),
      usdValue: heliusNumberishSchema.nullish(),
      logoURI: z.string().nullish(),
      logoUri: z.string().nullish(),
      logo_uri: z.string().nullish(),
      image: z.string().nullish(),
    }),
  ),
  pagination: z
    .object({
      page: heliusNumberishSchema.nullish(),
      hasMore: z.boolean().nullish(),
    })
    .nullish(),
});

export type HLS_WalletBalances = z.infer<typeof hls_WalletBalancesSchema>;

export const mbl_WalletAnalysisSchema = z.object({
  data: z.object({
    winRateDistribution: z.object({
      ">500%": z.number(),
      "200%-500%": z.number(),
      "50%-200%": z.number(),
      "0%-50%": z.number(),
      "-50%-0%": z.number(),
      "<-50%": z.number(),
    }),
    marketCapDistribution: z.object({
      ">1000M": z.number(),
      ">100M": z.number(),
      "10M-100M": z.number(),
      "1M-10M": z.number(),
      "100k-1M": z.number(),
      "<100k": z.number(),
    }),
    periodTimeframes: z.array(
      z.object({
        date: z.string(),
        realized: z.number(),
      }),
    ),
    calendarBreakdown: z
      .array(
        z.object({
          date: z.string(),
          volumeBuy: z.number(),
          volumeSell: z.number(),
          totalVolume: z.number(),
          buys: z.number(),
          sells: z.number(),
          realizedPnlUSD: z.number(),
        }),
      )
      .optional(),
    stat: z.object({
      totalValue: z.number(),
      periodTotalPnlUSD: z.number(),
      periodRealizedPnlUSD: z.number(),
      periodRealizedRate: z.number(),
      periodActiveTokensCount: z.number(),
      periodWinCount: z.number(),
      periodVolumeBuy: z.number(),
      periodVolumeSell: z.number(),
      periodBuys: z.number(),
      periodSells: z.number(),
      periodBuyTokens: z.number(),
      periodSellTokens: z.number(),
      periodTradingTokens: z.number(),
      holdingTokensCount: z.number(),
      holdingDuration: z.number(),
      tradingTimeFrames: z.number(),
      winRealizedPnl: z.number(),
      winRealizedPnlRate: z.number(),
      fundingInfo: z
        .object({
          from: z.string(),
          date: z.string(),
          chainId: z.string(),
          txHash: z.string(),
          amount: z.string(),
          fromWalletLogo: z.string().nullish(),
          fromWalletTag: z.string().nullish(),
        })
        .nullish(),
      nativeBalance: z
        .object({
          rawBalance: z.string(),
          formattedBalance: z.number(),
          assetId: z.number().nullable(),
          chainId: z.string(),
          address: z.string(),
          decimals: z.number(),
          name: z.string(),
          symbol: z.string(),
          logo: z.string().nullish(),
          price: z.number(),
          balanceUSD: z.number(),
        })
        .nullish(),
      winToken: z
        .object({
          address: z.string(),
          chainId: z.string(),
          name: z.string(),
          symbol: z.string(),
          logo: z.string().nullish(),
          decimals: z.number(),
        })
        .nullish(),
    }),
    labels: z.array(z.string()),
  }),
});

export type MBL_WalletAnalysis = z.infer<typeof mbl_WalletAnalysisSchema>;

export const mbl_WalletPositionsSchema = z.object({
  data: z.array(
    z.object({
      token: z.object({
        address: z.string(),
        symbol: z.string().nullish(),
      }),
      balance: z.number(),
      amountUSD: z.number(),
      buys: z.number(),
      sells: z.number(),
      volumeBuyToken: z.number(),
      volumeSellToken: z.number(),
      volumeBuy: z.number(),
      volumeSell: z.number(),
      avgBuyPriceUSD: z.number().nullish(),
      avgSellPriceUSD: z.number().nullish(),
      realizedPnlUSD: z.number(),
      unrealizedPnlUSD: z.number(),
      lastDate: z.string().nullish(),
    }),
  ),
  pagination: z.object({
    page: z.number(),
    offset: z.number(),
    limit: z.number(),
    pageEntries: z.number(),
  }),
});

export type MBL_WalletPositions = z.infer<typeof mbl_WalletPositionsSchema>;

export const mbl_WalletHistorySchema = z.object({
  data: z.object({
    wallets: z.array(z.string()),
    balance_usd: z.number(),
    balance_history: z.array(z.tuple([z.number(), z.number()])),
    backfill_status: z.enum(["processed", "processing", "pending"]).optional(),
  }),
});

export type MBL_WalletHistory = z.infer<typeof mbl_WalletHistorySchema>;

const mbl_WalletActivityAssetSchema = z.object({
  id: z.number().nullable(),
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  totalSupply: z.number(),
  circulatingSupply: z.number(),
  price: z.number(),
  liquidity: z.number(),
  priceChange24hPercent: z.number(),
  marketCapUsd: z.number(),
  logo: z.string().nullable(),
  contract: z.string(),
});

const mbl_WalletActivitySwapActionSchema = z.object({
  model: z.literal("swap"),
  swapType: z.string(),
  swapRawAmountOut: z.number(),
  swapRawAmountIn: z.number(),
  swapAmountOut: z.number(),
  swapAmountIn: z.number(),
  swapPriceUsdTokenOut: z.number(),
  swapPriceUsdTokenIn: z.number(),
  swapAmountUsd: z.number(),
  swapTransactionSenderAddress: z.string(),
  swapBaseAddress: z.string(),
  swapQuoteAddress: z.string(),
  swapAmountQuote: z.number(),
  swapAmountBase: z.number(),
  swapAssetIn: mbl_WalletActivityAssetSchema,
  swapAssetOut: mbl_WalletActivityAssetSchema,
  swapPlatform: z
    .object({
      id: z.string(),
      name: z.string(),
      logo: z.string().nullable(),
    })
    .nullable(),
  swapTotalFeesUsd: z.number().nullable(),
  swapGasFeesUsd: z.number().nullable(),
  swapPlatformFeesUsd: z.number().nullable(),
  swapMevFeesUsd: z.number().nullable(),
});

const mbl_WalletActivityTransferActionSchema = z.object({
  model: z.literal("transfer"),
  transferRawAmount: z.string(),
  transferAmount: z.number(),
  transferAmountUsd: z.number(),
  transferType: z.enum([
    "VAULT_DEPOSIT",
    "VAULT_WITHDRAW",
    "VAULT_UNSTAKE",
    "TOKEN_IN",
    "TOKEN_OUT",
    "NATIVE_IN",
    "NATIVE_OUT",
  ]),
  transferFromAddress: z.string().nullable(),
  transferToAddress: z.string().nullable(),
  transferAsset: mbl_WalletActivityAssetSchema,
});

export const mbl_WalletActivitySchema = z.object({
  data: z.array(
    z.object({
      chainId: z.string(),
      txDateMs: z.number(),
      txDateIso: z.string(),
      txHash: z.string(),
      txRawFeesNative: z.string(),
      txFeesNativeUsd: z.number(),
      txBlockNumber: z.number(),
      txIndex: z.number(),
      txAction: z.string().nullable(),
      actions: z.array(
        z.discriminatedUnion("model", [
          mbl_WalletActivitySwapActionSchema,
          mbl_WalletActivityTransferActionSchema,
        ]),
      ),
    }),
  ),
  pagination: z.object({
    page: z.number(),
    offset: z.number(),
    limit: z.number(),
    pageEntries: z.number(),
  }),
  backfillStatus: z.enum(["processed", "processing", "pending"]).optional(),
});

export type MBL_WalletActivity = z.infer<typeof mbl_WalletActivitySchema>;

export const bds_WalletFirstFundSchema = z.object({
  success: z.boolean(),
  data: z.record(
    z.string(),
    z.object({
      tx_hash: z.string(),
      block_unix_time: z.number(),
      block_number: z.number(),
      balance_change: z.string(),
      token_address: z.string(),
      token_decimals: z.number(),
    }),
  ),
});

export const bds_WalletTokenDetailsSchema = z.object({
  data: z.object({
    meta: z.object({
      address: z.string(),
      currency: z.string(),
      holding_check: z.boolean(),
      time: z.string(),
    }),
    tokens: z.array(
      z.object({
        address: z.string(),
        symbol: z.string(),
        decimals: z.number(),
        last_trade_unix_time: z.number(),
        counts: z.object({
          total_buy: z.number(),
          total_sell: z.number(),
          total_trade: z.number(),
        }),
        quantity: z.object({
          total_bought_amount: z.number(),
          total_sold_amount: z.number(),
          holding: z.number(),
        }),
        cashflow_usd: z.object({
          cost_of_quantity_sold: z.number(),
          total_invested: z.number(),
          total_sold: z.number(),
          current_value: z.number(),
        }),
        pnl: z.object({
          realized_profit_usd: z.number(),
          realized_profit_percent: z.number(),
          unrealized_usd: z.number(),
          unrealized_percent: z.number(),
          total_usd: z.number(),
          total_percent: z.number(),
          avg_profit_per_trade_usd: z.number(),
        }),
        pricing: z.object({
          current_price: z.number().nullable(),
          avg_buy_cost: z.number().nullable(),
          avg_sell_cost: z.number().nullable(),
        }),
      }),
    ),
    summary: z.object({
      unique_tokens: z.number(),
      counts: z.object({
        total_buy: z.number(),
        total_sell: z.number(),
        total_trade: z.number(),
        total_win: z.number(),
        total_loss: z.number(),
        win_rate: z.number(),
      }),
      cashflow_usd: z.object({
        total_invested: z.number(),
        total_sold: z.number(),
        current_value: z.number(),
      }),
      pnl: z.object({
        realized_profit_usd: z.number(),
        realized_profit_percent: z.number(),
        unrealized_usd: z.number(),
        total_usd: z.number(),
        avg_profit_per_trade_usd: z.number(),
      }),
    }),
  }),
});

export const mrl_WalletTokenSwapsSchema = z.object({
  cursor: z.string().nullable(),
  page: z.number(),
  pageSize: z.number(),
  result: z.array(
    z.object({
      transactionHash: z.string(),
      transactionType: z.enum(["buy", "sell"]),
      transactionIndex: z.number(),
      subCategory: z.string().nullable(),
      blockTimestamp: z.string(),
      blockNumber: z.number(),
      walletAddress: z.string(),
      pairAddress: z.string(),
      pairLabel: z.string(),
      exchangeAddress: z.string(),
      exchangeName: z.string().nullable(),
      exchangeLogo: z.string().nullable(),
      baseToken: z.string(),
      quoteToken: z.string(),
      bought: z.object({
        address: z.string(),
        name: z.string(),
        symbol: z.string(),
        logo: z.string().nullable(),
        amount: z.string(),
        usdPrice: z.number(),
        usdAmount: z.number(),
        tokenType: z.string(),
      }),
      sold: z.object({
        address: z.string(),
        name: z.string(),
        symbol: z.string(),
        logo: z.string().nullable(),
        amount: z.string(),
        usdPrice: z.number(),
        usdAmount: z.number(),
        tokenType: z.string(),
      }),
      baseQuotePrice: z.string(),
      totalValueUsd: z.number(),
    }),
  ),
});

export const bds_WalletSearchSchema = z.object({
  data: z.object({
    meta: z.object({
      address: z.string().trim().min(1),
    }),
  }),
});

export type BDS_WalletSearch = z.infer<typeof bds_WalletSearchSchema>;

export type BDS_WalletFirstFund = z.infer<typeof bds_WalletFirstFundSchema>;
export type BDS_WalletTokenDetails = z.infer<
  typeof bds_WalletTokenDetailsSchema
>;
export type MRL_WalletTokenSwaps = z.infer<typeof mrl_WalletTokenSwapsSchema>;

export const bds_WalletNetAssetsSchema = z.object({
  success: z.boolean(),
  data: z.object({
    wallet_address: z.string(),
    currency: z.string(),
    net_worth: z.number(),
    // Request and resolved timestamp are. server time not historical time of the wallet
    requested_timestamp: z.string(),
    resolved_timestamp: z.string(),
    net_assets: z.array(
      z.object({
        symbol: z.string(),
        token_address: z.string(),
        decimal: z.number(),
        balance: z.string(),
        price: z.number(),
        value: z.number(),
      }),
    ),
  }),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
  }),
});

export type BDS_WalletNetAssets = z.infer<typeof bds_WalletNetAssetsSchema>;

export const bds_WalletNetworthHistorySchema = z.object({
  success: z.boolean(),
  data: z.object({
    wallet_address: z.string(),
    currency: z.string(),
    current_timestamp: z.string(),
    past_timestamp: z.string(),
    history: z.array(
      z.object({
        timestamp: z.string(),
        net_worth: z.number(),
        net_worth_change: z.number(),
        net_worth_change_percent: z.number(),
      }),
    ),
  }),
});

export type BDS_WalletNetworthHistory = z.infer<
  typeof bds_WalletNetworthHistorySchema
>;

export const zrn_WalletBalanceChartSchema = z.object({
  links: z.object({ self: z.string() }),
  data: z.object({
    type: z.string(),
    id: z.string(),
    attributes: z.object({
      begin_at: z.string(),
      end_at: z.string(),
      points: z.array(z.tuple([z.number(), z.number()])),
    }),
  }),
});

export type ZRN_WalletBalanceChart = z.output<
  typeof zrn_WalletBalanceChartSchema
>;
