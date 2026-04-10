export interface MoralisSwapResponseRoot {
  page: number;
  pageSize: number;
  cursor: string;
  result: MoralisSwapResult[];
}

export interface MoralisSwapResult {
  transactionHash: string;
  transactionIndex: number;
  transactionType: string;
  blockNumber: number;
  blockTimestamp: string;
  subCategory: string;
  walletAddress: string;
  pairAddress: string;
  pairLabel: string;
  exchangeAddress: string;
  exchangeName: string;
  exchangeLogo: string;
  baseToken: string;
  quoteToken: string;
  bought: MoralisTradeLeg;
  sold: MoralisTradeLeg;
  baseQuotePrice: string;
  totalValueUsd: number;
}

export interface MoralisTradeLeg {
  address: string;
  name: string;
  symbol: string;
  logo: string;
  amount: string;
  usdPrice: number;
  usdAmount: number;
  tokenType: string;
}
