import type { MarketGetResponse } from "@coingecko/coingecko-typescript/resources/coins.mjs";

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
export interface MarketGet extends MarketItem {
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
  price_change_percentage_14d_in_currency: number | null;
  price_change_percentage_30d_in_currency: number | null;
  price_change_percentage_200d_in_currency: number | null;
  price_change_percentage_1y_in_currency: number | null;
}

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

type TokenSide = {
  symbol: string;
  address: string;
  decimals: number;
  price: number;
  amount: string;
  ui_amount: number;
  ui_change_amount: number;
  type_swap: "from" | "to";
  is_scaled_ui_token: boolean;
  multiplier: number | null;
};

type SwapItem = {
  base: TokenSide;
  quote: TokenSide;

  tx_type: "swap";
  tx_hash: string;

  ins_index: number;
  inner_ins_index: number | null;

  block_unix_time: number;
  block_number: number;

  volume_usd: number;
  volume: number;

  owner: string;
  signers: string[];

  source: string;
  interacted_program_id: string;
  pool_id: string;
};

export type BDS_RecentTrades = {
  data: {
    items: SwapItem[];
  };
};
