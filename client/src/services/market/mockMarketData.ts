/**
 * Mock Market Data Generator
 * Provides realistic mock data for market components
 */

export interface TokenMarketData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  supply: number;
}

export interface HeatmapCell {
  symbol: string;
  name: string;
  value: number; // Market cap
  change: number; // 24h change percentage
  price: number;
  volume: number;
}

/**
 * Generate mock token market data
 */
export function generateMockTokenMarketData(): TokenMarketData[] {
  const tokens = [
    { symbol: 'SOL', name: 'Solana', basePrice: 189.45, baseMcap: 89400000000 },
    { symbol: 'JTO', name: 'Jito', basePrice: 3.21, baseMcap: 450000000 },
    { symbol: 'BONK', name: 'Bonk', basePrice: 0.000034, baseMcap: 2100000000 },
    { symbol: 'JUP', name: 'Jupiter', basePrice: 0.89, baseMcap: 1200000000 },
    { symbol: 'WIF', name: 'dogwifhat', basePrice: 2.45, baseMcap: 2450000000 },
    { symbol: 'RAY', name: 'Raydium', basePrice: 1.87, baseMcap: 890000000 },
    { symbol: 'ORCA', name: 'Orca', basePrice: 3.56, baseMcap: 670000000 },
    { symbol: 'MNGO', name: 'Mango', basePrice: 0.045, baseMcap: 120000000 },
    { symbol: 'SRM', name: 'Serum', basePrice: 0.67, baseMcap: 340000000 },
    { symbol: 'PYTH', name: 'Pyth Network', basePrice: 0.42, baseMcap: 1500000000 },
    { symbol: 'RNDR', name: 'Render', basePrice: 7.23, baseMcap: 2800000000 },
    { symbol: 'HNT', name: 'Helium', basePrice: 4.12, baseMcap: 780000000 },
    { symbol: 'STEP', name: 'Step Finance', basePrice: 0.089, baseMcap: 45000000 },
    { symbol: 'COPE', name: 'Cope', basePrice: 0.034, baseMcap: 28000000 },
    { symbol: 'FIDA', name: 'Bonfida', basePrice: 0.23, baseMcap: 67000000 },
  ];

  return tokens.map(token => {
    const priceVariation = 0.9 + Math.random() * 0.2;
    const price = token.basePrice * priceVariation;
    const change24h = (Math.random() - 0.4) * 35;
    const marketCap = token.baseMcap * priceVariation;
    const volume24h = marketCap * (0.05 + Math.random() * 0.25);
    const supply = marketCap / price;

    return {
      symbol: token.symbol,
      name: token.name,
      price,
      change24h,
      marketCap,
      volume24h,
      supply,
    };
  });
}

/**
 * Generate heatmap data structure
 */
export function generateHeatmapData(): HeatmapCell[] {
  const marketData = generateMockTokenMarketData();
  
  return marketData.map(token => ({
    symbol: token.symbol,
    name: token.name,
    value: token.marketCap,
    change: token.change24h,
    price: token.price,
    volume: token.volume24h,
  }));
}

/**
 * Get color based on percentage change
 */
export function getChangeColor(change: number): string {
  if (change >= 10) return '#24A148'; // Strong green
  if (change >= 5) return '#42BE65'; // Green
  if (change >= 0) return '#6FDC8C'; // Light green
  if (change >= -5) return '#FF832B'; // Light red
  if (change >= -10) return '#FA4D56'; // Red
  return '#DA1E28'; // Strong red
}

/**
 * Format large numbers (market cap, volume)
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

/**
 * Format price based on value
 */
export function formatPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}

/**
 * Simulate API delay
 */
export async function delay(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock fetch heatmap data with network delay
 */
export async function mockFetchHeatmapData(): Promise<HeatmapCell[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return generateHeatmapData();
}