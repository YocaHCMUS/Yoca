export interface CG_Token {
  id: string;
  name: string;
  symbol: string;
  platforms: { solana?: string };
}

export interface CG_TokenMeta {
  id: string,
  platforms: {
    solana: string;
  };
  name: string;
  description?: {
    en?: string;
  };
  symbol: string;
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  links?: {
    homepage?: string[];
    chat_url?: string[];
    twitter_screen_name?: string;
  };
}

export interface CG_TokenMarketData {
  id: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  // These fields only available if price_percentage_change is set accordingly
  price_change_percentage_1h_in_currency: number;
  price_change_percentage_24h_in_currency: number;
  price_change_percentage_14d_in_currency: number;
  price_change_percentage_30d_in_currency: number;
  price_change_percentage_200d_in_currency: number;
  price_change_percentage_1y_in_currency: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_date: string;
  ath_change_percentage: number;
  atl: number;
  atl_date: string;
  atl_change_percentage: number;
}

export interface CG_TokenMarketChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}
