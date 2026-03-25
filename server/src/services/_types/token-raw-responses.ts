import type { MarketGetResponse } from "@coingecko/coingecko-typescript/resources/coins.mjs";
import { z } from "zod";
export interface CG_Token {
  id: string;
  name: string;
  symbol: string;
  platforms: { solana?: string };
}

export interface CG_TokenMarketChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

// https://docs.coingecko.com/v3.0.1/reference/coins-markets
type MarketItem = MarketGetResponse[number];
// The coingecko library does not return results for optional parameters
export interface MarketGet extends MarketItem {
  // When: price_change_percentage = "1h,24h,7d,14d,30d,200d,1y"
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
  price_change_percentage_14d_in_currency: number | null;
  price_change_percentage_30d_in_currency: number | null;
  price_change_percentage_200d_in_currency: number | null;
  price_change_percentage_1y_in_currency: number | null;
  // When: sparkline = true
  sparkline_in_7d: { price: number[] };
}

export type BDS_TrendingList = {
  success: boolean;
  data: {
    updateUnixTime: number;
    updateTime: string;
    tokens: Array<{
      address: string;
      decimals: number;
      liquidity: number;
      logoURI: string;
      name: string;
      symbol: string;
      volume24hUSD: number;
      volume24hChangePercent: number;
      rank: number;
      price: number;
      price24hChangePercent: number;
      fdv: number;
      marketcap: number;
    }>;
    total: number;
  };
};

export type CG_CoinMarkets = Array<MarketGet>;

export type CG_TopPoolData = {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      base_token_price_usd: string;
      base_token_price_native_currency: string;
      quote_token_price_usd: string;
      quote_token_price_native_currency: string;
      base_token_price_quote_token: string;
      quote_token_price_base_token: string;
      address: string;
      name: string;
      pool_created_at: string;
      token_price_usd: string;
      fdv_usd: string;
      market_cap_usd: string;
      price_change_percentage: {
        m5: string;
        m15: string;
        m30: string;
        h1: string;
        h6: string;
        h24: string;
      };
      transactions: {
        m5: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        m15: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        m30: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        h1: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        h6: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        h24: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
      };
      volume_usd: {
        m5: string;
        m15: string;
        m30: string;
        h1: string;
        h6: string;
        h24: string;
      };
      reserve_in_usd: string;
    };
    relationships: {
      base_token: {
        data: {
          id: string;
          type: string;
        };
      };
      quote_token: {
        data: {
          id: string;
          type: string;
        };
      };
      dex: {
        data: {
          id: string;
          type: string;
        };
      };
    };
  }>;
  included: Array<{
    id: string;
    type: string;
    attributes: {
      address?: string;
      name: string;
      symbol?: string;
      decimals?: number;
      image_url?: string;
      coingecko_coin_id?: string;
    };
  }>;
};

export type CG_24hPoolTrades = {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      block_number: number;
      tx_hash: string;
      tx_from_address: string;
      from_token_amount: string;
      to_token_amount: string;
      price_from_in_currency_token: string;
      price_to_in_currency_token: string;
      price_from_in_usd: string;
      price_to_in_usd: string;
      block_timestamp: string;
      kind: string;
      volume_in_usd: string;
      from_token_address: string;
      to_token_address: string;
    };
  }>;
};
export type CG_PoolData = {
  data: {
    id: string;
    type: string;
    attributes: {
      base_token_price_usd: string;
      base_token_price_native_currency: string;
      base_token_balance: string;
      base_token_liquidity_usd: string;
      quote_token_price_usd: string;
      quote_token_price_native_currency: string;
      quote_token_balance: string;
      quote_token_liquidity_usd: string;
      base_token_price_quote_token: string;
      quote_token_price_base_token: string;
      address: string;
      name: string;
      pool_name: string;
      pool_fee_percentage: any;
      pool_created_at: string;
      fdv_usd: string;
      market_cap_usd: string;
      price_change_percentage: {
        m5: string;
        m15: string;
        m30: string;
        h1: string;
        h6: string;
        h24: string;
      };
      transactions: {
        m5: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        m15: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        m30: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        h1: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        h6: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        h24: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
      };
      volume_usd: {
        m5: string;
        m15: string;
        m30: string;
        h1: string;
        h6: string;
        h24: string;
      };
      net_buy_volume_usd: {
        m5: string;
        m15: string;
        m30: string;
        h1: string;
        h6: string;
        h24: string;
      };
      buy_volume_usd: {
        m5: string;
        m15: string;
        m30: string;
        h1: string;
        h6: string;
        h24: string;
      };
      sell_volume_usd: {
        m5: string;
        m15: string;
        m30: string;
        h1: string;
        h6: string;
        h24: string;
      };
      reserve_in_usd: string;
      locked_liquidity_percentage: any;
    };
    relationships: {
      base_token: {
        data: {
          id: string;
          type: string;
        };
      };
      quote_token: {
        data: {
          id: string;
          type: string;
        };
      };
      dex: {
        data: {
          id: string;
          type: string;
        };
      };
    };
  };
  included: Array<{
    id: string;
    type: string;
    attributes: {
      address?: string;
      name: string;
      symbol?: string;
      decimals?: number;
      image_url?: string;
      coingecko_coin_id?: string;
    };
  }>;
};

export type MRL_TopHolders = {
  result: Array<{
    balance: string;
    balanceFormatted: string;
    isContract: string;
    ownerAddress: string;
    usdValue: string;
    percentageRelativeToTotalSupply: string;
  }>;
  cursor: string;
  page: string;
  pageSize: string;
  totalSupply: string;
};

export const tokenSideSchema = z.object({
  symbol: z.string(),
  address: z.string(),
  decimals: z.number(),
  price: z.number(),
  amount: z.string(),
  ui_amount: z.number(),
  ui_change_amount: z.number(),
  type_swap: z.enum(["from", "to"]),
  is_scaled_ui_token: z.boolean(),
  multiplier: z.number().nullable(),
});

export const swapItemSchema = z.object({
  base: tokenSideSchema,
  quote: tokenSideSchema,
  tx_type: z.literal("swap"),
  tx_hash: z.string(),
  ins_index: z.number(),
  inner_ins_index: z.number().nullable(),
  block_unix_time: z.number(),
  block_number: z.number(),
  volume_usd: z.number(),
  volume: z.number(),
  owner: z.string(),
  signers: z.array(z.string()),
  source: z.string(),
  interacted_program_id: z.string(),
  pool_id: z.string(),
});

export const bds_RecentTradesSchema = z.object({
  data: z.object({
    items: z.array(swapItemSchema),
  }),
});

export type BDS_RecentTrades = z.infer<typeof bds_RecentTradesSchema>;
