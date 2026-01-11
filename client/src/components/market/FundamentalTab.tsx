import React, { useState, useCallback } from 'react';
import { Grid, Column } from '@carbon/react';
import { AssetInfo, type AssetData } from './AssetInfo';
import { TokenPriceHistoryChart } from './TokenPriceHistoryChart';
import { TokenPerformanceTable, type TokenPerformance } from './TokenPerformanceTable';
import styles from './FundamentalTab.module.scss';

export const FundamentalTab: React.FC = () => {
  // State for selected token
  const [selectedToken, setSelectedToken] = useState<TokenPerformance | null>(null);
  const [loading, setLoading] = useState(false);

  // Handle token selection from the table
  const handleTokenSelect = useCallback((token: TokenPerformance) => {
    setSelectedToken(token);
  }, []);

  // Convert TokenPerformance to AssetData
  const assetData: AssetData | null = selectedToken ? {
    name: selectedToken.token,
    symbol: selectedToken.symbol,
    imageUrl: selectedToken.imageUrl,
    price: selectedToken.price,
    priceChange24h: selectedToken.change24h,
    marketCap: selectedToken.marketCap,
    volume24h: selectedToken.volume24h,
    circulatingSupply: selectedToken.supply,
    // These would need additional API calls to fetch
    totalSupply: undefined,
    allTimeHigh: undefined,
    allTimeLow: undefined,
  } : null;

  return (
    <div className={styles.fundamentalTab}>
      <Grid narrow>
        <Column lg={4} md={4} sm={4}>
          <AssetInfo data={assetData} loading={loading} />
        </Column>
        <Column lg={12} md={4} sm={4}>
          <div className={styles.chartSection}>
            <TokenPriceHistoryChart
              tokenAddress={selectedToken?.address}
              tokenSymbol={selectedToken?.symbol}
              height={400}
            />
          </div>
        </Column>
      </Grid>
      <div className={styles.tableSection}>
        <TokenPerformanceTable
          onTokenSelect={handleTokenSelect}
          selectedTokenAddress={selectedToken?.address}
        />
      </div>
    </div>
  );
};
