/**
 * Balance Chart API Route
 * 
 * Endpoint for fetching balance trend data with time-based aggregation
 * 
 * @module routes/charts/balance.route
 */

import { Hono } from 'hono';
import { z } from 'zod';

/**
 * Request parameter schema for balance trend endpoint
 */
const balanceRequestSchema = z.object({
  timePeriod: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  tokens: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : undefined),
  timezone: z.string().optional().default('UTC'),
});

/**
 * Aggregation interval based on time period
 */
function getAggregationInterval(timePeriod: string): 'hourly' | 'daily' | 'weekly' | 'monthly' {
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
 * Calculate start timestamp based on time period
 */
function getStartTimestamp(timePeriod: string): number {
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
      return 0; // Beginning of time
    default:
      return now - (30 * day);
  }
}

/**
 * Aggregate balance data points based on interval
 */
function aggregateBalanceData(
  data: Array<{ timestamp: number; value: number }>,
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly'
): Array<{ timestamp: number; value: number }> {
  if (data.length === 0) return [];
  
  // Determine bucket size in milliseconds
  const bucketSize = (() => {
    switch (interval) {
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
  })();
  
  // Group data into buckets
  const buckets = new Map<number, { sum: number; count: number }>();
  
  data.forEach(point => {
    const bucketKey = Math.floor(point.timestamp / bucketSize) * bucketSize;
    const bucket = buckets.get(bucketKey) || { sum: 0, count: 0 };
    bucket.sum += point.value;
    bucket.count += 1;
    buckets.set(bucketKey, bucket);
  });
  
  // Calculate averages and return sorted
  return Array.from(buckets.entries())
    .map(([timestamp, { sum, count }]) => ({
      timestamp,
      value: sum / count,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Generate mock balance data for demonstration
 * TODO: Replace with actual database query in production
 */
function generateMockBalanceData(
  startTimestamp: number,
  _tokens?: string[]
): Array<{ timestamp: number; value: number }> {
  const now = Date.now();
  const dataPoints: Array<{ timestamp: number; value: number }> = [];
  
  // Generate data points every hour from start to now
  const hourMs = 60 * 60 * 1000;
  let currentTimestamp = startTimestamp || (now - 30 * 24 * hourMs);
  const baseValue = 50000; // Base portfolio value
  
  while (currentTimestamp <= now) {
    // Simulate price fluctuation with some randomness and trend
    const progress = (currentTimestamp - startTimestamp) / (now - startTimestamp);
    const trend = progress * 20000; // Upward trend
    const volatility = Math.sin(currentTimestamp / (24 * hourMs)) * 5000; // Daily cycle
    const noise = (Math.random() - 0.5) * 3000; // Random noise
    
    const value = baseValue + trend + volatility + noise;
    
    dataPoints.push({
      timestamp: currentTimestamp,
      value: Math.max(0, value), // Ensure non-negative
    });
    
    currentTimestamp += hourMs;
  }
  
  return dataPoints;
}

/**
 * Balance chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/balance
   * 
   * Fetch balance trend data with time-based aggregation
   * 
   * Query Parameters:
   * - timePeriod: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - tokens: Comma-separated token symbols (optional, default: all tokens)
   * - timezone: IANA timezone string (optional, default: 'UTC')
   * 
   * Response:
   * {
   *   data: Array<{ timestamp: number, value: number }>,
   *   metadata: {
   *     timePeriod: string,
   *     tokens: string[] | undefined,
   *     aggregation: 'hourly' | 'daily' | 'weekly' | 'monthly',
   *     dataPoints: number
   *   }
   * }
   */
  .get('/', async (c) => {
    try {
      // Validate query parameters
      const params = balanceRequestSchema.parse({
        timePeriod: c.req.query('timePeriod'),
        tokens: c.req.query('tokens'),
        timezone: c.req.query('timezone'),
      });
      
      // Determine aggregation interval
      const aggregation = getAggregationInterval(params.timePeriod);
      
      // Get start timestamp
      const startTimestamp = getStartTimestamp(params.timePeriod);
      
      // TODO: Fetch actual balance data from database
      // For now, generate mock data
      const rawData = generateMockBalanceData(startTimestamp, params.tokens);
      
      // Aggregate data based on interval
      const aggregatedData = aggregateBalanceData(rawData, aggregation);
      
      // Return response in the expected format
      return c.json({
        series: [
          {
            name: 'Total',
            data: aggregatedData,
          },
        ],
        metadata: {
          timePeriod: params.timePeriod,
          tokens: params.tokens,
          aggregation,
          dataPoints: aggregatedData.length,
          timezone: params.timezone,
          currency: 'USD',
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
      console.error('[BalanceChart] Error fetching balance data:', error);
      return c.json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

export default app;
