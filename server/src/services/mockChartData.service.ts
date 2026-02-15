/**
 * Mock Chart Data Service
 * 
 * Server-side mock data generators for chart endpoints
 * Ported from client-side mockChartData.ts
 * 
 * @module services/mockChartData.service
 */

/**
 * Time period type
 */
type TimePeriod = '7D' | '30D' | '60D' | '90D' | '1Y' | 'All';

/**
 * Transaction type
 */
type TransactionType = 'all' | 'deposits' | 'withdrawals' | 'trades';

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
 * Get time period details (days and data points)
 */
function getTimePeriodDetails(timePeriod: TimePeriod): { days: number; dataPoints: number } {
  switch (timePeriod) {
    case '7D':
      return { days: 7, dataPoints: 168 }; // Hourly
    case '30D':
      return { days: 30, dataPoints: 30 }; // Daily
    case '60D':
      return { days: 60, dataPoints: 60 }; // Daily
    case '90D':
      return { days: 90, dataPoints: 13 }; // Weekly
    case '1Y':
      return { days: 365, dataPoints: 52 }; // Weekly
    case 'All':
      return { days: 730, dataPoints: 24 }; // Monthly
    default:
      return { days: 30, dataPoints: 30 }; // Default to 30 days
  }
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
 * Generate mock balance trend data
 */
export function generateBalanceTrend(
  timePeriod: TimePeriod = '30D',
  tokens?: string,
  wallets?: string
) {
  const now = Date.now();
  const startTimestamp = getStartTimestamp(timePeriod);
  const aggregation = getAggregationInterval(timePeriod);
  const intervalMs = getIntervalMs(aggregation);
  
  // Parse wallets if provided
  const walletAddresses = wallets ? wallets.split(',') : [];
  const isMultiWallet = walletAddresses.length > 1;
  
  // Generate series based on wallet count
  const series = [];
  
  if (isMultiWallet) {
    // Generate separate series for each wallet
    for (let walletIndex = 0; walletIndex < walletAddresses.length; walletIndex++) {
      const walletAddress = walletAddresses[walletIndex];
      const dataPoints: Array<{ timestamp: number; value: number }> = [];
      
      // Use wallet index to vary the base values
      const baseValue = 30000 + (walletIndex * 15000);
      const trendMultiplier = 1 + (walletIndex * 0.3);
      
      // Generate data points for this wallet
      let currentTimestamp = startTimestamp;
      while (currentTimestamp <= now) {
        const progress = (currentTimestamp - startTimestamp) / (now - startTimestamp);
        
        // Upward trend component (varies per wallet)
        const trend = progress * 20000 * trendMultiplier;
        
        // Daily/weekly volatility cycle (phase shifted per wallet)
        const cycleLength = 7 * 24 * 60 * 60 * 1000;
        const phaseShift = walletIndex * Math.PI / 3;
        const volatility = Math.sin((currentTimestamp / cycleLength) * 2 * Math.PI + phaseShift) * 5000;
        
        // Random walk component (seeded by wallet index for consistency)
        const noise = (Math.sin(currentTimestamp + walletIndex * 1000) * 0.5) * 3000;
        
        // Combine components
        const value = baseValue + trend + volatility + noise;
        
        dataPoints.push({
          timestamp: currentTimestamp,
          value: Math.max(1000, value),
        });
        
        currentTimestamp += intervalMs;
      }
      
      series.push({
        name: `Wallet ${walletAddress.substring(0, 8)}...`,
        data: dataPoints,
      });
    }
  } else {
    // Single wallet or aggregated view
    const dataPoints: Array<{ timestamp: number; value: number }> = [];
    const baseValue = 50000;
    
    let currentTimestamp = startTimestamp;
    while (currentTimestamp <= now) {
      const progress = (currentTimestamp - startTimestamp) / (now - startTimestamp);
      const trend = progress * 20000;
      const cycleLength = 7 * 24 * 60 * 60 * 1000;
      const volatility = Math.sin((currentTimestamp / cycleLength) * 2 * Math.PI) * 5000;
      const noise = (Math.random() - 0.5) * 3000;
      const value = baseValue + trend + volatility + noise;
      
      dataPoints.push({
        timestamp: currentTimestamp,
        value: Math.max(1000, value),
      });
      
      currentTimestamp += intervalMs;
    }
    
    const seriesName = tokens ? tokens.split(',').join(', ') : 'Total';
    
    series.push({
      name: seriesName,
      data: dataPoints,
    });
  }
  
  return {
    series,
    wallets: isMultiWallet ? walletAddresses : undefined,
    metadata: {
      aggregation,
      timezone: 'UTC',
      currency: 'USD',
    },
  };
}

/**
 * Generate mock asset distribution data for a single wallet
 */
function generateSingleWalletDistribution(walletAddress: string, seed: number) {
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
  
  // Use seed for consistent but different values per wallet
  const seededRandom = (index: number) => {
    const x = Math.sin(seed + index) * 10000;
    return x - Math.floor(x);
  };
  
  // Add some randomness to values (±30%) based on wallet seed
  const assets = baseAssets.map((asset, index) => {
    const randomFactor = 0.7 + seededRandom(index) * 0.6; // 0.7 to 1.3
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
    walletAddress,
    data: dataWithPercentages,
    totalValue,
  };
}

/**
 * Generate mock asset distribution data
 * Returns per-wallet data if wallets specified, otherwise aggregated data
 */
export function generateAssetDistribution(
  _period?: string,
  wallets?: string
) {
  // Parse wallet addresses
  const walletAddresses = wallets ? wallets.split(',').map(w => w.trim()) : [];
  
  if (walletAddresses.length === 0) {
    // Generate aggregated data for all wallets
    const aggregated = generateSingleWalletDistribution('all', 12345);
    return {
      data: aggregated.data,
      totalValue: aggregated.totalValue,
      metadata: {
        currency: 'USD',
        timestamp: Date.now(),
      },
    };
  }
  
  // Generate per-wallet data
  const walletData = walletAddresses.map((walletAddress, index) => {
    const seed = walletAddress.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index;
    return generateSingleWalletDistribution(walletAddress, seed);
  });
  
  return {
    wallets: walletData,
    metadata: {
      currency: 'USD',
      timestamp: Date.now(),
    },
  };
}

/**
 * Generate mock P&L data
 */
export function generatePnLData(
  timePeriod: TimePeriod = '30D',
  aggregation: 'daily' | 'weekly' | 'monthly' = 'daily'
) {
  const now = Date.now();
  const startTimestamp = getStartTimestamp(timePeriod);
  
  // Determine interval based on aggregation
  const intervalMs = aggregation === 'daily' ? 24 * 60 * 60 * 1000
    : aggregation === 'weekly' ? 7 * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000; // monthly
  
  const dailyPnL: Array<{ timestamp: number; value: number }> = [];
  const cumulativePnL: Array<{ timestamp: number; value: number }> = [];
  
  let cumulativeTotal = 0;
  let currentTimestamp = startTimestamp;
  
  // Generate data points
  while (currentTimestamp <= now) {
    // Generate daily P&L with 60% win rate
    const isWin = Math.random() < 0.6;
    
    // Base P&L value
    const basePnL = isWin 
      ? 500 + Math.random() * 1500  // Wins: $500 to $2000
      : -(300 + Math.random() * 1200); // Losses: -$300 to -$1500
    
    // Add some market volatility
    const volatility = (Math.random() - 0.5) * 400;
    const dailyValue = basePnL + volatility;
    
    // Update cumulative total
    cumulativeTotal += dailyValue;
    
    dailyPnL.push({
      timestamp: currentTimestamp,
      value: dailyValue,
    });
    
    cumulativePnL.push({
      timestamp: currentTimestamp,
      value: cumulativeTotal,
    });
    
    currentTimestamp += intervalMs;
  }
  
  // Calculate start and end balance
  const startBalance = 100000;
  const endBalance = startBalance + cumulativeTotal;
  
  return {
    dailyPnL,
    cumulativePnL,
    metadata: {
      currency: 'USD',
      startBalance,
      endBalance,
    },
  };
}

/**
 * Generate mock exchange comparison data
 */
export function generateExchangeData(
  timePeriod: TimePeriod = '30D',
  metric: 'count' | 'volume' = 'count'
) {
  // Define major exchanges
  const exchanges = [
    { name: 'Binance', tier: 1 },
    { name: 'Coinbase', tier: 1 },
    { name: 'Kraken', tier: 2 },
    { name: 'KuCoin', tier: 2 },
    { name: 'Gemini', tier: 2 },
    { name: 'Bitfinex', tier: 3 },
    { name: 'Gate.io', tier: 3 },
  ];
  
  const exchangeData = exchanges.map(exchange => {
    // Tier 1 exchanges have higher activity
    const activityMultiplier = exchange.tier === 1 ? 1.5 : exchange.tier === 2 ? 1.0 : 0.6;
    
    // Generate counts with some variation
    const baseDeposits = Math.floor((50 + Math.random() * 150) * activityMultiplier);
    const baseWithdrawals = Math.floor((40 + Math.random() * 120) * activityMultiplier);
    
    // Generate volumes (counts * avg transaction size)
    const avgDepositSize = 1000 + Math.random() * 4000; // $1k to $5k
    const avgWithdrawalSize = 1200 + Math.random() * 3800; // $1.2k to $5k
    
    return {
      name: exchange.name,
      deposits: baseDeposits,
      withdrawals: baseWithdrawals,
      depositsVolume: baseDeposits * avgDepositSize,
      withdrawalsVolume: baseWithdrawals * avgWithdrawalSize,
    };
  });
  
  return {
    exchanges: exchangeData,
    metadata: {
      period: timePeriod,
      metric,
    },
  };
}

/**
 * Generate mock counterparty activity data
 */
export function generateCounterpartyData(
  timePeriod: TimePeriod = '30D',
  transactionType: TransactionType = 'all',
  limit: number = 10
) {
  // Mock counterparty data with realistic names and addresses
  const allCounterparties = [
    { name: 'Binance Hot Wallet', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' },
    { name: 'Coinbase Exchange', address: '0x503828976D22510aad0201ac7EC88293211D23Da' },
    { name: 'Kraken Exchange', address: '0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2' },
    { name: 'Uniswap Router', address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
    { name: '1inch Exchange', address: '0x111111125421cA6dc452d289314280a0f8842A65' },
    { name: 'SushiSwap Router', address: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F' },
    { name: 'DeFi Whale #1', address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199' },
    { name: 'DeFi Whale #2', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' },
    { name: 'NFT Marketplace', address: '0x00000000006c3852cbEf3e08E8dF289169EdE581' },
    { name: 'Lending Protocol', address: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9' },
    { name: 'Bridge Contract', address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640' },
    { name: 'DAO Treasury', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
    { name: 'Staking Contract', address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' },
    { name: 'Yield Aggregator', address: '0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE' },
    { name: 'OTC Desk #1', address: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8' },
    { name: 'OTC Desk #2', address: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696' },
    { name: 'Payment Processor', address: '0x28C6c06298d514Db089934071355E5743bf21d60' },
    { name: 'Smart Contract Wallet', address: '0xBA12222222228d8Ba445958a75a0704d566BF2C8' },
    { name: 'DEX Aggregator', address: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF' },
    { name: 'Multi-sig Treasury', address: '0x5f65f7b609678448494De4C87521CdF6cEf1e932' },
  ];

  // Generate activity data for each counterparty
  const counterpartyActivity = allCounterparties.map((cp, index) => {
    // Base transaction count decreases with rank
    const baseCount = 500 - (index * 20);
    const randomFactor = 0.8 + Math.random() * 0.4; // ±20% variation
    const transactionCount = Math.floor(baseCount * randomFactor);
    
    // Volume correlates with transaction count but with variation
    const avgTxVolume = 1000 + Math.random() * 9000; // $1K - $10K per transaction
    const totalVolume = transactionCount * avgTxVolume;
    
    return {
      id: cp.address,
      name: cp.name,
      transactionCount,
      totalVolume,
    };
  });

  // Sort by total volume descending
  counterpartyActivity.sort((a, b) => b.totalVolume - a.totalVolume);

  // Apply limit
  const topCounterparties = counterpartyActivity.slice(0, limit);

  return {
    counterparties: topCounterparties,
    metadata: {
      period: timePeriod,
      transactionType,
      limit,
    },
  };
}

/**
 * Generate mock volume benchmark comparison data
 */
export function generateVolumeBenchmark(
  timePeriod: TimePeriod,
  walletIds: string[] = [],
  timezone: string = 'UTC'
) {
  // Define default wallets if none specified
  const allWallets = [
    { id: 'wallet-1', name: 'Main Wallet' },
    { id: 'wallet-2', name: 'Trading Wallet' },
    { id: 'wallet-3', name: 'Cold Storage' },
    { id: 'wallet-4', name: 'DeFi Wallet' },
    { id: 'wallet-5', name: 'NFT Wallet' },
  ];
  
  // Filter wallets if specific IDs provided
  const selectedWallets = walletIds.length > 0
    ? allWallets.filter(w => walletIds.includes(w.id))
    : allWallets;
  
  // Calculate time range and data points
  const { days, dataPoints: pointCount } = getTimePeriodDetails(timePeriod);
  const now = Date.now();
  const startTime = now - (days * 24 * 60 * 60 * 1000);
  const interval = (now - startTime) / pointCount;
  
  // Generate volume data for each wallet
  const wallets = selectedWallets.map((wallet, walletIndex) => {
    // Each wallet has different base volume and growth pattern
    const baseVolume = 50000 + (walletIndex * 30000); // $50K - $170K base
    const growthRate = 0.02 + (Math.random() * 0.03); // 2-5% growth trend
    const volatility = 0.15 + (Math.random() * 0.15); // 15-30% volatility
    
    const dataPoints = [];
    
    for (let i = 0; i < pointCount; i++) {
      const timestamp = startTime + (i * interval);
      const progress = i / pointCount;
      
      // Trend component: gradual growth
      const trend = baseVolume * (1 + (growthRate * progress));
      
      // Cyclical component: weekly trading patterns
      const dayOfWeek = new Date(timestamp).getDay();
      const weekdayFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0; // Lower weekend volume
      
      // Random noise component
      const noise = (Math.random() - 0.5) * volatility;
      
      // Occasional spikes (10% chance)
      const spike = Math.random() < 0.1 ? 1.5 : 1.0;
      
      // Calculate final volume
      const volume = trend * weekdayFactor * (1 + noise) * spike;
      
      dataPoints.push({
        timestamp: Math.floor(timestamp),
        volume: Math.round(volume * 100) / 100, // Round to 2 decimals
      });
    }
    
    return {
      id: wallet.id,
      name: wallet.name,
      dataPoints,
    };
  });
  
  return {
    wallets,
    metadata: {
      period: timePeriod,
      currency: 'USD',
      timezone,
    },
  };
}

/**
 * Generate mock transaction distribution data
 */
export function generateTransactionDistribution(
  timePeriod: TimePeriod,
  transactionType: TransactionType,
  walletIds: string[]
) {
  const startTimestamp = getStartTimestamp(timePeriod);
  const aggregation = getAggregationInterval(timePeriod);
  const intervalMs = getIntervalMs(aggregation);
  const { dataPoints: pointsCount } = getTimePeriodDetails(timePeriod);
  
  // Define wallets
  const allWallets = [
    { id: 'wallet-1', name: 'Main Wallet' },
    { id: 'wallet-2', name: 'Trading Wallet' },
    { id: 'wallet-3', name: 'Savings Wallet' },
    { id: 'wallet-4', name: 'DeFi Wallet' },
  ];
  
  const selectedWallets = walletIds.length > 0
    ? allWallets.filter(w => walletIds.includes(w.id))
    : allWallets;
  
  // Generate transaction counts by wallet
  const transactionCounts = selectedWallets.map((wallet) => {
    const data: { timestamp: number; value: number }[] = [];
    
    // Base transaction count varies by wallet
    const baseCount = wallet.id === 'wallet-1' ? 15 : wallet.id === 'wallet-2' ? 25 : wallet.id === 'wallet-3' ? 8 : 12;
    
    for (let i = 0; i < pointsCount; i++) {
      const timestamp = startTimestamp + (i * intervalMs);
      
      // Weekly pattern (weekends have fewer transactions)
      const date = new Date(timestamp);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const weekdayFactor = isWeekend ? 0.5 : 1.0;
      
      // Time of day pattern (peak hours have more transactions)
      const hour = date.getHours();
      const isPeakHour = hour >= 9 && hour <= 17;
      const hourFactor = isPeakHour ? 1.2 : 0.8;
      
      // Random variation (±30%)
      const noise = (Math.random() - 0.5) * 0.6;
      
      // Occasional spikes (15% chance)
      const spike = Math.random() < 0.15 ? 1.8 : 1.0;
      
      // Apply transaction type filter
      let typeFactor = 1.0;
      if (transactionType === 'deposits') {
        typeFactor = 0.6;
      } else if (transactionType === 'withdrawals') {
        typeFactor = 0.4;
      } else if (transactionType === 'trades') {
        typeFactor = 0.8;
      }
      
      // Calculate final count
      const count = Math.max(0, Math.round(baseCount * weekdayFactor * hourFactor * typeFactor * (1 + noise) * spike));
      
      data.push({
        timestamp: Math.floor(timestamp),
        value: count,
      });
    }
    
    return {
      walletId: wallet.id,
      walletName: wallet.name,
      data,
    };
  });
  
  // Generate unique token counts per day
  const uniqueTokenCounts: { timestamp: number; value: number }[] = [];
  const baseTokenCount = 8;
  
  for (let i = 0; i < pointsCount; i++) {
    const timestamp = startTimestamp + (i * intervalMs);
    
    // Weekly pattern (more diverse trading on weekdays)
    const date = new Date(timestamp);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekdayFactor = isWeekend ? 0.7 : 1.0;
    
    // Growth trend over time (more tokens over time)
    const progress = i / pointsCount;
    const trendFactor = 1.0 + (progress * 0.5); // Up to 50% growth
    
    // Random variation (±20%)
    const noise = (Math.random() - 0.5) * 0.4;
    
    // Occasional spikes (10% chance - new token discoveries)
    const spike = Math.random() < 0.1 ? 1.5 : 1.0;
    
    // Calculate final count
    const count = Math.max(1, Math.round(baseTokenCount * weekdayFactor * trendFactor * (1 + noise) * spike));
    
    uniqueTokenCounts.push({
      timestamp: Math.floor(timestamp),
      value: count,
    });
  }
  
  return {
    transactionCounts,
    uniqueTokenCounts,
    metadata: {
      period: timePeriod,
      transactionType: transactionType || 'all',
    },
  };
}

/**
 * Generate mock holding durations data
 */
export function generateHoldingDurations(
  walletIds: string[],
  topN: number,
  timeUnit: 'days' | 'weeks' | 'months'
) {

  // Default wallets if none specified
  const defaultWallets = [
    { id: 'wallet-1', name: 'Main Wallet' },
    { id: 'wallet-2', name: 'Trading Wallet' },
    { id: 'wallet-3', name: 'Cold Storage' },
  ];
  
  // Available tokens with typical holding patterns
  const tokens = [
    { symbol: 'BTC', minDays: 180, maxDays: 730 },  // Long-term hold
    { symbol: 'ETH', minDays: 150, maxDays: 600 },  // Long-term hold
    { symbol: 'BNB', minDays: 90, maxDays: 365 },   // Medium-term hold
    { symbol: 'SOL', minDays: 60, maxDays: 300 },   // Medium-term hold
    { symbol: 'ADA', minDays: 120, maxDays: 450 },  // Medium-term hold
    { symbol: 'MATIC', minDays: 30, maxDays: 180 }, // Short to medium-term
    { symbol: 'DOT', minDays: 45, maxDays: 240 },   // Short to medium-term
    { symbol: 'AVAX', minDays: 25, maxDays: 150 },  // Short-term trading
    { symbol: 'LINK', minDays: 60, maxDays: 200 },  // Medium-term
    { symbol: 'UNI', minDays: 30, maxDays: 120 },   // Short-term trading
    { symbol: 'ATOM', minDays: 90, maxDays: 300 },  // Medium-term hold
    { symbol: 'AAVE', minDays: 20, maxDays: 90 },   // Short-term trading
    { symbol: 'ALGO', minDays: 45, maxDays: 180 },  // Short to medium-term
    { symbol: 'XRP', minDays: 100, maxDays: 400 },  // Medium to long-term
    { symbol: 'DOGE', minDays: 15, maxDays: 60 },   // Very short-term
  ];
  
  // Determine which wallets to generate data for
  const walletsToGenerate = walletIds.length > 0
    ? walletIds.map(id => {
        // Try to find in default wallets or create generic name
        const defaultWallet = defaultWallets.find(w => w.id === id);
        return defaultWallet || { id, name: `Wallet ${id}` };
      })
    : defaultWallets;
  
  const wallets = walletsToGenerate.map(wallet => {
    // Randomly select tokens for this wallet (more than topN to allow variety)
    const walletTokens = [...tokens]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(topN + 5, tokens.length));
    
    // Generate holdings with durations
    const holdings = walletTokens
      .map(token => {
        // Generate duration within token's typical range
        const durationDays = Math.floor(
          token.minDays + Math.random() * (token.maxDays - token.minDays)
        );
        
        return {
          tokenSymbol: token.symbol,
          durationDays,
        };
      })
      // Sort by duration (longest first)
      .sort((a, b) => b.durationDays - a.durationDays)
      // Take top N
      .slice(0, topN);
    
    return {
      id: wallet.id,
      name: wallet.name,
      holdings,
    };
  });
  
  return {
    wallets,
    metadata: {
      unit: timeUnit,
    },
  };
}

/**
 * Generate mock price history data
 */
export function generateMockPriceHistory(
  tokens: string[],
  timePeriod: TimePeriod,
  aggregation: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily'
): Array<{
  symbol: string;
  name: string;
  data: Array<{ timestamp: number; value: number }>;
}> {
  const startTime = getStartTimestamp(timePeriod);
  const interval = getAggregationInterval(timePeriod);
  const { dataPoints } = getTimePeriodDetails(timePeriod);
  
  // Default tokens if none specified
  const tokenList = tokens.length > 0 ? tokens : ['SOL', 'JTO', 'BONK', 'JUP', 'WIF'];
  
  return tokenList.map(token => {
    const basePrice = getBasePriceForToken(token);
    const volatility = getVolatilityForToken(token);
    
    const data = Array.from({ length: dataPoints }, (_, i) => {
      const timestamp = startTime + (i * getIntervalMs(interval));
      const priceChange = (Math.random() - 0.5) * volatility;
      const price = Math.max(basePrice * (1 + priceChange), 0.000001); // Ensure positive price
      
      return {
        timestamp,
        value: price,
      };
    });
    
    return {
      symbol: token,
      name: getTokenName(token),
      data,
    };
  });
}

/**
 * Get base price for a token
 */
function getBasePriceForToken(token: string): number {
  const prices: Record<string, number> = {
    'SOL': 189.45,
    'JTO': 3.21,
    'BONK': 0.000034,
    'JUP': 0.89,
    'WIF': 2.45,
  };
  return prices[token] || 1.0;
}

/**
 * Get volatility for a token
 */
function getVolatilityForToken(token: string): number {
  const volatilities: Record<string, number> = {
    'SOL': 0.1,
    'JTO': 0.15,
    'BONK': 0.3,
    'JUP': 0.12,
    'WIF': 0.18,
  };
  return volatilities[token] || 0.1;
}

/**
 * Get token name
 */
function getTokenName(token: string): string {
  const names: Record<string, string> = {
    'SOL': 'Solana',
    'JTO': 'Jito',
    'BONK': 'Bonk',
    'JUP': 'Jupiter',
    'WIF': 'Dogwifhat',
  };
  return names[token] || token;
}

/**
 * Generate mock trading volume distribution data for a single wallet
 */
function generateSingleWalletTradingVolume(walletAddress: string, seed: number) {
  // Base token trading volumes (will be adjusted based on randomness)
  const baseTokens = [
    { name: 'SOL', baseVolume: 125000 },
    { name: 'JTO', baseVolume: 48000 },
    { name: 'BONK', baseVolume: 32000 },
    { name: 'JUP', baseVolume: 28000 },
    { name: 'WIF', baseVolume: 18000 },
    { name: 'RAY', baseVolume: 15000 },
    { name: 'ORCA', baseVolume: 12000 },
    { name: 'MSOL', baseVolume: 8500 },
  ];
  
  // Use seed for consistent but different values per wallet
  const seededRandom = (index: number) => {
    const x = Math.sin(seed + index) * 10000;
    return x - Math.floor(x);
  };
  
  // Add some randomness to volumes (±40%) based on wallet seed
  const tokens = baseTokens.map((token, index) => {
    const randomFactor = 0.6 + seededRandom(index) * 0.8; // 0.6 to 1.4
    const volume = token.baseVolume * randomFactor;
    
    return {
      name: token.name,
      value: volume,
      color: ASSET_COLORS[index % ASSET_COLORS.length],
    };
  });
  
  // Calculate total volume
  const totalVolume = tokens.reduce((sum, token) => sum + token.value, 0);
  
  // Calculate percentages
  const dataWithPercentages = tokens.map(token => ({
    ...token,
    percentage: (token.value / totalVolume) * 100,
  }));
  
  return {
    walletAddress,
    data: dataWithPercentages,
    totalVolume,
  };
}

/**
 * Generate mock trading volume distribution data
 * Returns per-wallet data showing trading volume distribution across tokens
 */
export function generateTradingVolumeDistribution(
  _period?: string,
  wallets?: string
) {
  // Parse wallet addresses
  const walletAddresses = wallets ? wallets.split(',').map(w => w.trim()) : [];
  
  if (walletAddresses.length === 0) {
    // Return single default wallet if no wallets specified
    const defaultWallet = generateSingleWalletTradingVolume('default_wallet', 99999);
    return {
      wallets: [defaultWallet],
      metadata: {
        currency: 'USD',
        timestamp: Date.now(),
      },
    };
  }
  
  // Generate per-wallet data
  const walletData = walletAddresses.map((walletAddress, index) => {
    const seed = walletAddress.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index;
    return generateSingleWalletTradingVolume(walletAddress, seed);
  });
  
  return {
    wallets: walletData,
    metadata: {
      currency: 'USD',
      timestamp: Date.now(),
    },
  };
}

/**
 * Generate box plot statistics from a seeded random distribution
 */
function generateBoxPlotData(seed: number, baseValue: number, variance: number) {
  // Use seed for consistent random values
  const seededRandom = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };
  
  // Generate quintile points with realistic spread
  const min = baseValue * (0.1 + seededRandom(1) * 0.2); // 10-30% of base
  const q1 = baseValue * (0.4 + seededRandom(2) * 0.15); // 40-55% of base
  const median = baseValue * (0.7 + seededRandom(3) * 0.2); // 70-90% of base
  const q3 = baseValue * (1.1 + seededRandom(4) * 0.3); // 110-140% of base
  const max = baseValue * (1.8 + seededRandom(5) * 0.7); // 180-250% of base
  
  return {
    min: Math.round(min),
    q1: Math.round(q1),
    median: Math.round(median),
    q3: Math.round(q3),
    max: Math.round(max),
  };
}

/**
 * Generate mock trading volume per transaction data for a single wallet
 */
function generateSingleWalletVolumePerTransaction(walletAddress: string, seed: number) {
  // Base transaction volume values (will be adjusted based on randomness)
  const baseDepositVolume = 2500 + (seed % 1000);
  const baseWithdrawVolume = 2800 + (seed % 1200);
  
  // Generate box plot data for deposits and withdrawals
  const deposit = generateBoxPlotData(seed, baseDepositVolume, 1000);
  const withdraw = generateBoxPlotData(seed + 1000, baseWithdrawVolume, 1200);
  
  // Generate transaction count
  const transactionCount = 150 + Math.floor((seed % 300));
  
  return {
    walletAddress,
    walletName: `Wallet ${walletAddress.substring(0, 8)}...`,
    deposit,
    withdraw,
    transactionCount,
  };
}

/**
 * Generate mock trading volume per transaction data
 * Returns per-wallet box plot data for deposit and withdrawal transactions
 */
export function generateTradingVolumePerTransaction(
  period: string = '30D',
  wallets?: string,
  _type?: string
) {
  // Parse wallet addresses
  const walletAddresses = wallets ? wallets.split(',').map(w => w.trim()) : [];
  
  if (walletAddresses.length === 0) {
    // Return single default wallet if no wallets specified
    const defaultWallet = generateSingleWalletVolumePerTransaction('default_wallet_001', 54321);
    return {
      wallets: [defaultWallet],
      metadata: {
        currency: 'USD',
        period,
        timestamp: Date.now(),
      },
    };
  }
  
  // Generate per-wallet data
  const walletData = walletAddresses.map((walletAddress, index) => {
    const seed = walletAddress.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index * 1000;
    return generateSingleWalletVolumePerTransaction(walletAddress, seed);
  });
  
  return {
    wallets: walletData,
    metadata: {
      currency: 'USD',
      period,
      timestamp: Date.now(),
    },
  };
}
