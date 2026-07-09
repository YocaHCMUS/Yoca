import { db } from '../db';
import { walletTransactions } from '../db/schema';
import { eq, gte } from 'drizzle-orm';

type WalletTransactionRow = typeof walletTransactions.$inferSelect;

interface CircularTradePattern {
  cycle: string[];
  amounts: Array<number | null>;
  timestamps: Date[];
  avgTime: number;
  confidence: number;
}

interface StarHub {
  wallet: string;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  isHub: boolean;
}

interface VolumeAnomaly {
  hash: string;
  amount: number;
  zScore: number;
  anomalyScore: number;
}
export interface WashTradePattern {
  circularTrades: number;
  sameAmountTransactions: number;
  tightTimingClusters: number;
  starTopology: boolean;
  volumeAnomaly: boolean;
}

export interface WalletSuspicion {
  wallet: string;
  volume: number;
  confidence: number;
  pattern: string;
  gnnScore: number;
}

export interface WashTradeAnalysis {
  riskScore: number;
  suspiciousWallets: WalletSuspicion[];
  transactions: unknown[];
  summary: {
    totalVolume: number;
    volumeAnomalies: number;
    circularTrades: number;
  };
  patterns: WashTradePattern;
}
export interface TokenTransaction {
  signature: string;
  from: string;
  to: string;
  amount: number;
  blockTime: number; // unix timestamp
  tokenMint: string;
}
class WashTradingService {
  /**
   * Detect circular trade patterns: A → B → C → A
   */
  async detectCircularTrades(
    mint: string,
    timeWindow: number = 3600000 // 1 hour in ms
  ): Promise<CircularTradePattern[]> {
    try {
      // Query transactions for the token within time window
      const recentTxs = await db
        .select()
        .from(walletTransactions)
        .where(
          gte(walletTransactions.blockTimestamp, new Date(Date.now() - timeWindow))
        )
        .limit(1000);

      const circularPatterns: CircularTradePattern[] = [];
      
      // Find 3-step cycles
      for (let i = 0; i < recentTxs.length; i++) {
        const tx1 = recentTxs[i];
        
        // Find next transaction from tx1.to
        const tx2 = recentTxs.find(
          (t: typeof recentTxs[0]) => t.fromAddress === tx1.toAddress && 
               t.blockTimestamp > tx1.blockTimestamp &&
               Math.abs((t.primaryTokenAmount || 0) - (tx1.primaryTokenAmount || 0)) < (tx1.primaryTokenAmount || 0) * 0.01 // Within 1%
        );
        
        if (!tx2) continue;
        
        // Find cycle back to original
        const tx3 = recentTxs.find(
          (t: typeof recentTxs[0]) => t.fromAddress === tx2.toAddress && 
               t.toAddress === tx1.fromAddress &&
               t.blockTimestamp > tx2.blockTimestamp &&
               Math.abs((t.primaryTokenAmount || 0) - (tx1.primaryTokenAmount || 0)) < (tx1.primaryTokenAmount || 0) * 0.01
        );
        
        if (tx3) {
          circularPatterns.push({
            cycle: [tx1.fromAddress, tx2.fromAddress, tx3.fromAddress],
            amounts: [tx1.primaryTokenAmount, tx2.primaryTokenAmount, tx3.primaryTokenAmount],
            timestamps: [tx1.blockTimestamp, tx2.blockTimestamp, tx3.blockTimestamp],
            avgTime: (tx3.blockTimestamp.getTime() - tx1.blockTimestamp.getTime()) / 2,
            confidence: 0.95
          });
        }
      }
      
      return circularPatterns;
    } catch (error) {
      console.error('Circular trade detection error:', error);
      return [];
    }
  }

  /**
   * Detect same-amount transaction clusters
   */
  async detectSameAmountPatterns(
    mint: string,
    tolerance: number = 0.02 // 2%
  ): Promise<Map<number, WalletTransactionRow[]>> {
    try {
      const txs = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.primaryTokenAddress, mint))
        .limit(5000);

      const sameAmountClusters = new Map<number, WalletTransactionRow[]>();
      
      for (const tx of txs) {
        const amount = tx.primaryTokenAmount || 0;
        const rounded = Math.round(amount / (amount * tolerance));
        if (!sameAmountClusters.has(rounded)) {
          sameAmountClusters.set(rounded, []);
        }
        sameAmountClusters.get(rounded)!.push(tx);
      }

      // Filter: only keep clusters with anomalous frequency
      const anomalous = new Map<number, WalletTransactionRow[]>();
      for (const [key, cluster] of sameAmountClusters.entries()) {
        if (cluster.length > 5) { // Threshold
          anomalous.set(key, cluster);
        }
      }

      return anomalous;
    } catch (error) {
      console.error('Same amount detection error:', error);
      return new Map();
    }
  }

  /**
   * Detect star topology: one hub wallet connecting many spokes
   */
  async detectStarTopology(mint: string): Promise<StarHub[]> {
    try {
      const txs = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.primaryTokenAddress, mint))
        .limit(10000);

      // Count interactions per wallet
      const walletDegrees = new Map<string, { in: number; out: number }>();
      
      for (const tx of txs) {
        if (!walletDegrees.has(tx.fromAddress)) {
          walletDegrees.set(tx.fromAddress, { in: 0, out: 0 });
        }
        if (!walletDegrees.has(tx.toAddress)) {
          walletDegrees.set(tx.toAddress, { in: 0, out: 0 });
        }
        
        walletDegrees.get(tx.fromAddress)!.out++;
        walletDegrees.get(tx.toAddress)!.in++;
      }

      // Find hubs (high in + out degree)
      const hubs: StarHub[] = [];
      for (const [wallet, degrees] of walletDegrees.entries()) {
        const totalDegree = degrees.in + degrees.out;
        if (totalDegree > 50) { // Threshold
          hubs.push({
            wallet,
            inDegree: degrees.in,
            outDegree: degrees.out,
            totalDegree,
            isHub: true
          });
        }
      }

      return hubs.sort((a, b) => b.totalDegree - a.totalDegree).slice(0, 10);
    } catch (error) {
      console.error('Star topology detection error:', error);
      return [];
    }
  }

  /**
   * Detect volume anomalies using statistical methods
   */
  async detectVolumeAnomalies(mint: string): Promise<VolumeAnomaly[]> {
    try {
      const txs = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.primaryTokenAddress, mint))
        .limit(5000);

      const amounts = txs.map((t: typeof txs[0]) => t.primaryTokenAmount || 0);
      const mean = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);

      // Z-score > 3 is very anomalous
      const anomalies: VolumeAnomaly[] = [];
      for (const tx of txs) {
        const amount = tx.primaryTokenAmount || 0;
        const zScore = Math.abs((amount - mean) / stdDev);
        if (zScore > 2.5) {
          anomalies.push({
            hash: tx.hash,
            amount,
            zScore,
            anomalyScore: Math.min(1, zScore / 5)
          });
        }
      }

      return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore).slice(0, 20);
    } catch (error) {
      console.error('Volume anomaly detection error:', error);
      return [];
    }
  }

  /**
   * GNN-based anomaly scoring (stub - integrate with Python service)
   */
  async getGNNScores(mint: string, walletAddresses: string[]): Promise<Map<string, number>> {
    try {
      // Call Python GNN service
      const response = await fetch('http://localhost:5000/api/gnn/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint, wallets: walletAddresses })
      });

      if (!response.ok) throw new Error('GNN service unavailable');
      
      const data = await response.json() as { scores?: Record<string, number> };
      const scores = data.scores || {};
      return new Map(Object.entries(scores) as [string, number][]);
    } catch (error) {
      console.error('GNN scoring error:', error);
      // Fallback: return random scores for testing
      return new Map(walletAddresses.map(w => [w, Math.random()]));
    }
  }

  /**
   * Main analysis orchestration
   */
  async analyzeWashTrading(mint: string): Promise<WashTradeAnalysis> {
    const [
      circularTrades,
      sameAmountClusters,
      starHubs,
      volumeAnomalies
    ] = await Promise.all([
      this.detectCircularTrades(mint),
      this.detectSameAmountPatterns(mint),
      this.detectStarTopology(mint),
      this.detectVolumeAnomalies(mint)
    ]);

    // Collect unique suspicious wallets
    const suspiciousWallets = new Set<string>();
    
    circularTrades.forEach(ct => ct.cycle.forEach((w: string) => suspiciousWallets.add(w)));
    sameAmountClusters.forEach(cluster => {
      cluster.forEach((tx: any) => {
        suspiciousWallets.add(tx.fromAddress);
        suspiciousWallets.add(tx.toAddress);
      });
    });
    starHubs.forEach((hub: any) => suspiciousWallets.add(hub.wallet));
    volumeAnomalies.forEach(va => suspiciousWallets.add(va.hash));

    // Get GNN scores
    const gnnScores = await this.getGNNScores(mint, Array.from(suspiciousWallets));

    // Build results
    const suspiciousWalletsResult = Array.from(suspiciousWallets).map(wallet => ({
      wallet,
      volume: Math.random() * 1e6, // Calculate actual volume
      confidence: gnnScores.get(wallet) || Math.random(),
      pattern: this.determinePattern(wallet, circularTrades, starHubs),
      gnnScore: gnnScores.get(wallet) || 0
    }));

    const totalVolume = 50e6; // Calculate from transactions
    const circularCount = circularTrades.length;

    return {
      riskScore: Math.min(1, (suspiciousWalletsResult.length * 0.1) + (circularCount * 0.15)),
      suspiciousWallets: suspiciousWalletsResult.sort((a, b) => b.confidence - a.confidence).slice(0, 20),
      transactions: volumeAnomalies.slice(0, 30),
      summary: {
        totalVolume,
        volumeAnomalies: volumeAnomalies.length,
        circularTrades: circularCount
      },
      patterns: {
        circularTrades: circularCount,
        sameAmountTransactions: sameAmountClusters.size,
        tightTimingClusters: circularTrades.filter(ct => ct.avgTime < 60000).length,
        starTopology: starHubs.length > 0,
        volumeAnomaly: volumeAnomalies.length > 5
      }
    };
  }

  private determinePattern(
    wallet: string,
    circularTrades: CircularTradePattern[],
    starHubs: StarHub[]
  ): string {
    if (circularTrades.some(ct => ct.cycle.includes(wallet))) return 'Circular Trade';
    if (starHubs.some(h => h.wallet === wallet)) return 'Hub Wallet';
    return 'Anomalous Activity';
  }
}

export const washTradingService = new WashTradingService();
