/**
 * Distribution Chart API Route
 * 
 * Endpoint for fetching asset distribution data with percentage calculations
 * 
 * @module routes/charts/distribution.route
 */

import { Hono } from 'hono';
import { z } from 'zod';

/**
 * Request parameter schema for distribution endpoint
 */
const distributionRequestSchema = z.object({
  period: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  wallets: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : undefined),
});

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
 * Generate mock distribution data for demonstration
 * TODO: Replace with actual database query in production
 */
function generateMockDistributionData(
  _period: string,
  _wallets?: string[]
): Array<{ name: string; value: number; color?: string }> {
  // Mock data representing asset distribution
  const mockAssets = [
    { name: 'BTC', value: 45000 },
    { name: 'ETH', value: 28000 },
    { name: 'USDT', value: 15000 },
    { name: 'BNB', value: 8000 },
    { name: 'SOL', value: 6000 },
    { name: 'ADA', value: 4500 },
    { name: 'XRP', value: 3000 },
    { name: 'DOT', value: 2500 },
  ];
  
  // Assign colors to each asset
  return mockAssets.map((asset, index) => ({
    ...asset,
    color: ASSET_COLORS[index % ASSET_COLORS.length],
  }));
}

/**
 * Calculate total value and percentages for distribution data
 */
function calculateDistributionPercentages(
  data: Array<{ name: string; value: number; color?: string }>
): {
  data: Array<{ name: string; value: number; percentage: number; color?: string }>;
  totalValue: number;
} {
  // Calculate total value
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  
  // Add percentage to each item
  const dataWithPercentages = data.map(item => ({
    ...item,
    percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
  }));
  
  return {
    data: dataWithPercentages,
    totalValue,
  };
}

/**
 * Distribution chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/distribution
   * 
   * Fetch asset distribution data with percentage calculations
   * 
   * Query Parameters:
   * - period: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - wallets: Comma-separated wallet addresses (optional, default: all wallets)
   * 
   * Response:
   * {
   *   data: Array<{
   *     name: string,
   *     value: number,
   *     percentage: number,
   *     color?: string
   *   }>,
   *   totalValue: number,
   *   metadata: {
   *     currency: string,
   *     timestamp: number
   *   }
   * }
   */
  .get('/', async (c) => {
    try {
      // Validate query parameters
      const params = distributionRequestSchema.parse({
        period: c.req.query('period'),
        wallets: c.req.query('wallets'),
      });
      
      // TODO: Fetch actual distribution data from database
      // For now, generate mock data
      const rawData = generateMockDistributionData(params.period, params.wallets);
      
      // Calculate percentages and total value
      const { data, totalValue } = calculateDistributionPercentages(rawData);
      
      // Return response in the expected format
      return c.json({
        data,
        totalValue,
        metadata: {
          currency: 'USD',
          timestamp: Date.now(),
        },
      }, 200);
      
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Validation error',
          details: error.issues,
        }, 400);
      }
      
      // Handle other errors
      console.error('[DistributionChart] Error fetching distribution data:', error);
      return c.json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

export default app;
