/**
 * Mock Chart Data Generator
 * 
 * Provides mock data for chart components during development
 * when the backend API is not available.
 * 
 * @module mockChartData
 */

import type { BalanceTrendResponse, AssetDistributionResponse } from '../../types/chart-api.types';
import type { TimePeriod } from '../../types/chart-filters.types';

/**
 * Calculate start timestamp based on time period
 */
function getStartTimestamp(timePeriod: TimePeriod): number {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  switch (timePeriod) {
    case '7D':
      return now - (7 * day);
    case '30D':
      return now - (30 * day);
    case '60D':
      return now - (60 * day);
    case '90D':
      return now - (90 * day);
    case '1Y':
      return now - (365 * day);
    case 'All':
      return now - (730 * day); // 2 years of data
    default:
      return now - (30 * day);
  }
}

/**
 * Determine aggregation interval based on time period
 */
function getAggregationInterval(timePeriod: TimePeriod): 'hourly' | 'daily' | 'weekly' | 'monthly' {
  switch (timePeriod) {
    case '7D':
      return 'hourly';
    case '30D':
    case '60D':
      return 'daily';
    case '90D':
    case '1Y':
      return 'weekly';
    case 'All':
      return 'monthly';
    default:
      return 'daily';
  }
}

/**
 * Get interval in milliseconds
 */
function getIntervalMs(aggregation: 'hourly' | 'daily' | 'weekly' | 'monthly'): number {
  switch (aggregation) {
    case 'hourly':
      return 60 * 60 * 1000; // 1 hour
    case 'daily':
      return 24 * 60 * 60 * 1000; // 1 day
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000; // 1 week
    case 'monthly':
      return 30 * 24 * 60 * 60 * 1000; // ~1 month
    default:
      return 24 * 60 * 60 * 1000;
  }
}

/**
 * Generate mock balance trend data
 * 
 * Creates realistic-looking portfolio balance data with:
 * - Upward trend over time
 * - Daily volatility patterns
 * - Random noise for realism
 */
export function generateMockBalanceTrend(
  timePeriod: TimePeriod = '30D',
  tokens?: string
): BalanceTrendResponse {
  const now = Date.now();
  const startTimestamp = getStartTimestamp(timePeriod);
  const aggregation = getAggregationInterval(timePeriod);
  const intervalMs = getIntervalMs(aggregation);
  
  const dataPoints: Array<{ timestamp: number; value: number }> = [];
  
  // Base portfolio value
  const baseValue = 50000;
  
  // Generate data points
  let currentTimestamp = startTimestamp;
  while (currentTimestamp <= now) {
    // Calculate progress (0 to 1)
    const progress = (currentTimestamp - startTimestamp) / (now - startTimestamp);
    
    // Upward trend component
    const trend = progress * 20000; // Gain $20k over the period
    
    // Daily/weekly volatility cycle
    const cycleLength = 7 * 24 * 60 * 60 * 1000; // Weekly cycle
    const volatility = Math.sin((currentTimestamp / cycleLength) * 2 * Math.PI) * 5000;
    
    // Random walk component
    const noise = (Math.random() - 0.5) * 3000;
    
    // Combine components
    const value = baseValue + trend + volatility + noise;
    
    dataPoints.push({
      timestamp: currentTimestamp,
      value: Math.max(1000, value), // Ensure non-negative with minimum
    });
    
    currentTimestamp += intervalMs;
  }
  
  // Determine token name
  const tokenName = tokens ? tokens.split(',').join(', ') : 'Total';
  
  return {
    series: [
      {
        name: tokenName,
        data: dataPoints,
      },
    ],
    metadata: {
      aggregation,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: 'USD',
    },
  };
}

/**
 * Simulate API delay for realistic behavior
 */
export async function delay(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock fetch balance trend with simulated network delay
 */
export async function mockFetchBalanceTrend(params?: {
  timePeriod?: TimePeriod;
  tokens?: string;
  timezone?: string;
}): Promise<BalanceTrendResponse> {
  // Simulate network delay
  await delay(300 + Math.random() * 200);
  
  // Randomly fail 5% of requests to test error handling
  if (Math.random() < 0.05) {
    throw new Error('Mock API error: Failed to fetch balance data');
  }
  
  return generateMockBalanceTrend(
    params?.timePeriod || '30D',
    params?.tokens
  );
}

/**
 * Asset color palette for visualization
 */
const ASSET_COLORS = [
  '#5470C6', // Blue
  '#91CC75', // Green
  '#FAC858', // Yellow
  '#EE6666', // Red
  '#73C0DE', // Light Blue
  '#3BA272', // Dark Green
  '#FC8452', // Orange
  '#9A60B4', // Purple
  '#EA7CCC', // Pink
];

/**
 * Generate mock asset distribution data
 * 
 * Creates realistic-looking asset allocation data with:
 * - Multiple cryptocurrencies
 * - Realistic percentage distributions
 * - Color assignments
 */
export function generateMockAssetDistribution(
  _period?: string,
  _wallets?: string
): AssetDistributionResponse {
  // Base asset allocations (will be adjusted based on randomness)
  const baseAssets = [
    { name: 'BTC', baseValue: 45000 },
    { name: 'ETH', baseValue: 28000 },
    { name: 'USDT', baseValue: 15000 },
    { name: 'BNB', baseValue: 8000 },
    { name: 'SOL', baseValue: 6000 },
    { name: 'ADA', baseValue: 4500 },
    { name: 'XRP', baseValue: 3000 },
    { name: 'DOT', baseValue: 2500 },
  ];
  
  // Add some randomness to values (±20%)
  const assets = baseAssets.map((asset, index) => {
    const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    const value = asset.baseValue * randomFactor;
    
    return {
      name: asset.name,
      value,
      color: ASSET_COLORS[index % ASSET_COLORS.length],
    };
  });
  
  // Calculate total value
  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
  
  // Calculate percentages
  const dataWithPercentages = assets.map(asset => ({
    ...asset,
    percentage: (asset.value / totalValue) * 100,
  }));
  
  return {
    data: dataWithPercentages,
    totalValue,
    metadata: {
      currency: 'USD',
      timestamp: Date.now(),
    },
  };
}

/**
 * Mock fetch asset distribution with simulated network delay
 */
export async function mockFetchAssetDistribution(params?: {
  period?: string;
  wallets?: string;
}): Promise<AssetDistributionResponse> {
  // Simulate network delay
  await delay(300 + Math.random() * 200);
  
  // Randomly fail 5% of requests to test error handling
  if (Math.random() < 0.05) {
    throw new Error('Mock API error: Failed to fetch distribution data');
  }
  
  return generateMockAssetDistribution(
    params?.period || '30D',
    params?.wallets
  );
}
