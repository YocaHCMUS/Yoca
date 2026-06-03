import { Hono } from 'hono';
import { z } from 'zod';
import { washTradingService } from '../services/wash-trading.service.js';

// Schema for token address validation
const tokenQuerySchema = z.object({
  mint: z.string().trim().min(1, 'Token mint address required'),
});

const circularTradesSchema = z.object({
  mint: z.string().trim().min(1),
  timeWindow: z.string().optional(),
});

const sameAmountSchema = z.object({
  mint: z.string().trim().min(1),
  tolerance: z.string().optional(),
});

export type WashTradingAppType = typeof app;

const app = new Hono()
  /**
   * GET /api/v1/wash-trading/analyze
   * Main endpoint for wash trading analysis
   * Query: mint (token mint address)
   * Returns: WashTradeAnalysis object with all findings
   */
  .get('/analyze', async (c) => {
    try {
      const mint = c.req.query('mint');
      
      if (!mint) {
        return c.json(
          { success: false, error: 'Token mint address required' },
          400
        );
      }
      
      console.log(`[Wash Trading] Analyzing token: ${mint}`);
      
      // Run comprehensive analysis
      const analysis = await washTradingService.analyzeWashTrading(mint);
      
      return c.json({
        success: true,
        data: analysis,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    } catch (error) {
      console.error('[Wash Trading] Analysis error:', error);
      return c.json(
        {
          success: false,
          error: 'Analysis failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  })

  /**
   * GET /api/v1/wash-trading/circular-trades
   * Detect only circular trade patterns
   */
  .get('/circular-trades', async (c) => {
    try {
      const mint = c.req.query('mint');
      const timeWindowStr = c.req.query('timeWindow');
      
      if (!mint) {
        return c.json(
          { success: false, error: 'Token mint address required' },
          400
        );
      }
      
      const timeWindow = timeWindowStr ? parseInt(timeWindowStr) : 3600000;
      const circular = await washTradingService.detectCircularTrades(mint, timeWindow);
      
      return c.json({
        success: true,
        data: circular,
        count: circular.length
      });
    } catch (error) {
      console.error('[Wash Trading] Circular trade detection error:', error);
      return c.json(
        { success: false, error: 'Detection failed' },
        500
      );
    }
  })

  /**
   * GET /api/v1/wash-trading/same-amount
   * Detect same-amount transaction patterns
   */
  .get('/same-amount', async (c) => {
    try {
      const mint = c.req.query('mint');
      const toleranceStr = c.req.query('tolerance');
      
      if (!mint) {
        return c.json(
          { success: false, error: 'Token mint address required' },
          400
        );
      }
      
      const tolerance = toleranceStr ? parseFloat(toleranceStr) : 0.02;
      const patterns = await washTradingService.detectSameAmountPatterns(mint, tolerance);
      
      return c.json({
        success: true,
        data: Array.from(patterns.entries()).map(([key, cluster]) => ({
          amountGroup: key,
          count: cluster.length,
          sample: cluster.slice(0, 3)
        }))
      });
    } catch (error) {
      console.error('[Wash Trading] Same amount detection error:', error);
      return c.json(
        { success: false, error: 'Detection failed' },
        500
      );
    }
  })

  /**
   * GET /api/v1/wash-trading/star-topology
   * Detect star topology (hub & spoke) patterns
   */
  .get('/star-topology', async (c) => {
    try {
      const mint = c.req.query('mint');
      
      if (!mint) {
        return c.json(
          { success: false, error: 'Token mint address required' },
          400
        );
      }
      
      const hubs = await washTradingService.detectStarTopology(mint);
      
      return c.json({
        success: true,
        data: hubs,
        count: hubs.length
      });
    } catch (error) {
      console.error('[Wash Trading] Star topology detection error:', error);
      return c.json(
        { success: false, error: 'Detection failed' },
        500
      );
    }
  })

  /**
   * GET /api/v1/wash-trading/volume-anomalies
   * Detect statistical volume anomalies
   */
  .get('/volume-anomalies', async (c) => {
    try {
      const mint = c.req.query('mint');
      
      if (!mint) {
        return c.json(
          { success: false, error: 'Token mint address required' },
          400
        );
      }
      
      const anomalies = await washTradingService.detectVolumeAnomalies(mint);
      
      return c.json({
        success: true,
        data: anomalies,
        count: anomalies.length
      });
    } catch (error) {
      console.error('[Wash Trading] Volume anomaly detection error:', error);
      return c.json(
        { success: false, error: 'Detection failed' },
        500
      );
    }
  });

export default app;
