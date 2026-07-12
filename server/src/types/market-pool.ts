export interface MarketPoolItem {
  id: string;
  poolAddress: string;
  poolName: string;
  dexId: string;
  dexName: string;
  baseAddress: string;
  baseName: string;
  baseSymbol: string;
  baseImageUrl: string | null;
  quoteAddress: string;
  quoteName: string;
  quoteSymbol: string;
  quoteImageUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  txns24h: number | null;
  volume24h: number | null;
  priceChange5m: number | null;
  priceChange1h: number | null;
  priceChange6h: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  poolCreatedAt: string | null;
}
