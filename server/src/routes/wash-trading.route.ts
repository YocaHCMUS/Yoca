import { Router } from 'express';
import { washTradingService } from '../services/wash-trading.service';
import { validateTokenAddress } from '../middlewares/validation';

const router = Router();

/**
 * POST /api/v1/wash-trading/analyze
 * Main endpoint for wash trading analysis
 * Query: token (mint address)
 * Returns: WashTradeAnalysis object with all findings
 */
router.get('/analyze', validateTokenAddress, async (req, res) => {
  try {
    const { token } = req.query as { token: string };
    
    console.log(`[Wash Trading] Analyzing token: ${token}`);
    
    // Run comprehensive analysis
    const analysis = await washTradingService.analyzeWashTrading(token);
    
    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    console.error('[Wash Trading] Analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/wash-trading/circular-trades
 * Detect only circular trade patterns
 */
router.get('/circular-trades', validateTokenAddress, async (req, res) => {
  try {
    const { token, timeWindow } = req.query as { token: string; timeWindow?: string };
    
    const circular = await washTradingService.detectCircularTrades(
      token,
      timeWindow ? parseInt(timeWindow) : 3600000
    );
    
    res.json({
      success: true,
      data: circular,
      count: circular.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Detection failed' });
  }
});

/**
 * POST /api/v1/wash-trading/same-amount
 * Detect same-amount transaction patterns
 */
router.get('/same-amount', validateTokenAddress, async (req, res) => {
  try {
    const { token, tolerance } = req.query as { token: string; tolerance?: string };
    
    const patterns = await washTradingService.detectSameAmountPatterns(
      token,
      tolerance ? parseFloat(tolerance) : 0.02
    );
    
    res.json({
      success: true,
      data: Array.from(patterns.entries()).map(([key, cluster]) => ({
        amountGroup: key,
        count: cluster.length,
        sample: cluster.slice(0, 3)
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Detection failed' });
  }
});

/**
 * POST /api/v1/wash-trading/star-topology
 * Detect star topology (hub & spoke) patterns
 */
router.get('/star-topology', validateTokenAddress, async (req, res) => {
  try {
    const { token } = req.query as { token: string };
    
    const hubs = await washTradingService.detectStarTopology(token);
    
    res.json({
      success: true,
      data: hubs,
      count: hubs.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Detection failed' });
  }
});

/**
 * POST /api/v1/wash-trading/volume-anomalies
 * Detect statistical volume anomalies
 */
router.get('/volume-anomalies', validateTokenAddress, async (req, res) => {
  try {
    const { token } = req.query as { token: string };
    
    const anomalies = await washTradingService.detectVolumeAnomalies(token);
    
    res.json({
      success: true,
      data: anomalies,
      count: anomalies.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Detection failed' });
  }
});

export default router;
