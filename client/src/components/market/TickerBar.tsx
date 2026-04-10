import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown } from '@carbon/icons-react';
import styles from './TickerBar.module.scss';

interface TickerItem {
  rank: number;
  pair: string;
  price: number;
  change24h: number;
  volume24h: number;
}

// Define types for API response
interface TokenMarketData {
  address: string;
  priceUsd: number;
  priceChangePercentage24h: number;
  volume24h: number;
  marketCap: number;
  circulatingSupply: number;
}

interface TokenMetaData {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
}

// Top Solana tokens (verified addresses that work with CoinGecko)
const TOP_TOKEN_ADDRESSES = [
  'So11111111111111111111111111111111111111112',  // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USD Coin (USDC)
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // Tether USD (USDT)
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // Jupiter (JUP)
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', // Jito (JTO)
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk (BONK)
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // Dogwifhat (WIF)
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH Network (PYTH)
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // Raydium (RAY)
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', // Orca (ORCA)
];

export const TickerBar: React.FC = () => {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopTokens() {
      try {
        const apiDomain = import.meta.env.VITE_CLIENT_API_DOMAIN || window.location.origin;
        const addressesParam = TOP_TOKEN_ADDRESSES.join(',');

        // Fetch market data and meta data in parallel
        const [marketResp, metaResp] = await Promise.all([
          fetch(`${apiDomain}/api/tokens/markets/${addressesParam}`),
          fetch(`${apiDomain}/api/tokens/meta/${addressesParam}`),
        ]);

        if (!marketResp.ok || !metaResp.ok) {
          console.warn('Failed to fetch ticker data');
          return;
        }

        const marketData = (await marketResp.json()) as TokenMarketData[];
        const metaData = (await metaResp.json()) as TokenMetaData[];

        if (!Array.isArray(marketData) || !Array.isArray(metaData)) {
          console.warn('Invalid ticker data format');
          return;
        }

        // Create meta lookup
        const metaLookup = new Map(metaData.map(m => [m.address, m]));

        // Combine and sort by volume (highest first)
        const sortedByVolume = marketData
          .filter(m => m && m.address && m.priceUsd != null && m.volume24h > 0)
          .map(market => {
            const meta = metaLookup.get(market.address);
            return {
              address: market.address,
              symbol: meta?.symbol?.toUpperCase() || '???',
              price: Number(market.priceUsd) || 0,
              change24h: Number(market.priceChangePercentage24h) || 0,
              volume24h: Number(market.volume24h) || 0,
            };
          })
          .sort((a, b) => b.volume24h - a.volume24h)
          .slice(0, 5); // Top 5 by volume

        // Convert to ticker items
        const tickerItems: TickerItem[] = sortedByVolume.map((token, index) => ({
          rank: index + 1,
          pair: `${token.symbol}-USDC`,
          price: token.price,
          change24h: token.change24h,
          volume24h: token.volume24h,
        }));

        setItems(tickerItems);
      } catch (error) {
        console.error('Failed to fetch ticker data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTopTokens();

    // Refresh every 60 seconds
    const interval = setInterval(fetchTopTokens, 60000);
    return () => clearInterval(interval);
  }, []);

  // Show loading state or fallback data
  const displayItems = items.length > 0 ? items : [
    { rank: 1, pair: 'Loading...', price: 0, change24h: 0, volume24h: 0 },
  ];

  const duplicatedItems = [...displayItems, ...displayItems];

  return (
    <div className={styles.tickerBar}>
      <div className={styles.tickerTrack}>
        {duplicatedItems.map((item, index) => (
          <div key={`${item.rank}-${index}`} className={styles.tickerItem}>
            <span className={styles.rank}>#{item.rank}</span>
            <span className={styles.pair}>{item.pair}</span>
            <span className={styles.price}>
              ${item.price < 0.01 
                ? item.price.toFixed(6) 
                : item.price < 1 
                  ? item.price.toFixed(4) 
                  : item.price.toFixed(2)}
            </span>
            <span className={item.change24h >= 0 ? styles.changePositive : styles.changeNegative}>
              {item.change24h >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              {Math.abs(item.change24h).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
