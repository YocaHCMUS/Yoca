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

// API response types
interface ApiMarketData {
  address: string;
  priceUsd: number;
  priceChangePercentage24h: number;
  volume24h: number;
  marketCap: number;
  circulatingSupply: number;
}

interface ApiMetaData {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
}

// Top Solana tokens for heatmap (verified addresses)
const HEATMAP_TOKEN_ADDRESSES = [
  'So11111111111111111111111111111111111111112',  // Wrapped SOL
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // Jupiter (JUP)
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', // Jito (JTO)
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk (BONK)
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // Dogwifhat (WIF)
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH Network (PYTH)
  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux', // Helium (HNT)
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // Raydium (RAY)
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', // Orca (ORCA)
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', // Render (RNDR)
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // Marinade SOL (mSOL)
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // Samoyedcoin (SAMO)
];

/**
 * Fetch real heatmap data from API
 */
export async function fetchRealHeatmapData(): Promise<HeatmapCell[]> {
  const apiDomain = import.meta.env?.CLIENT_API_DOMAIN || 'http://localhost:4000';
  const addressesParam = HEATMAP_TOKEN_ADDRESSES.join(',');

  try {
    // Fetch market data and meta data in parallel
    const [marketResp, metaResp] = await Promise.all([
      fetch(`${apiDomain}/api/tokens/markets/${addressesParam}`),
      fetch(`${apiDomain}/api/tokens/meta/${addressesParam}`),
    ]);

    if (!marketResp.ok || !metaResp.ok) {
      console.warn('Failed to fetch heatmap data, falling back to mock');
      return generateHeatmapData();
    }

    const marketData = (await marketResp.json()) as ApiMarketData[];
    const metaData = (await metaResp.json()) as ApiMetaData[];

    if (!Array.isArray(marketData) || !Array.isArray(metaData) || marketData.length === 0) {
      console.warn('Invalid heatmap data format, falling back to mock');
      return generateHeatmapData();
    }

    // Create meta lookup
    const metaLookup = new Map(metaData.map(m => [m.address, m]));

    // Convert to heatmap data format, sorted by market cap
    const heatmapData: HeatmapCell[] = marketData
      .filter(m => m && m.address && m.marketCap > 0)
      .map(market => {
        const meta = metaLookup.get(market.address);
        return {
          symbol: meta?.symbol?.toUpperCase() || '???',
          name: meta?.name || 'Unknown',
          value: Number(market.marketCap) || 0,
          change: Number(market.priceChangePercentage24h) || 0,
          price: Number(market.priceUsd) || 0,
          volume: Number(market.volume24h) || 0,
        };
      })
      .sort((a, b) => b.value - a.value); // Sort by market cap (largest first)

    return heatmapData;
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    return generateHeatmapData();
  }
}