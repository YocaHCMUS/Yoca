/**
 * TokenPriceHistoryChart Component
 *
 * Displays price history chart for a single token using real API data.
 * Features time period selection similar to CoinGecko.
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Tile, SkeletonPlaceholder, Button } from '@carbon/react';
import { Maximize, Save, Download } from '@carbon/icons-react';
import styles from './TokenPriceHistoryChart.module.scss';

interface ChartDataPoint {
  address: string | null;
  unixTimestampMs: number;
  price: number;
  marketCap: number;
  totalVolume: number;
}

type TimePeriod = '30m' | '1h' | '24h' | '7d' | '30d';

interface TokenPriceHistoryChartProps {
  /** Token address to fetch data for */
  tokenAddress?: string | null;
  /** Token symbol for display */
  tokenSymbol?: string;
  /** Chart height in pixels */
  height?: number;
}

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

export const TokenPriceHistoryChart: React.FC<TokenPriceHistoryChartProps> = ({
  tokenAddress,
  tokenSymbol = 'Token',
  height = 400,
}) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('24h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<ReactECharts>(null);

  // Fetch chart data when token or period changes
  useEffect(() => {
    if (!tokenAddress) {
      setChartData([]);
      return;
    }

    const fetchChartData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiDomain = import.meta.env.VITE_CLIENT_API_DOMAIN || window.location.origin;
        const response = await fetch(
          `${apiDomain}/api/tokens/markets/chart/${tokenAddress}?period=${selectedPeriod}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }

        const data = await response.json();
        setChartData(data);
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
        setError('Failed to load price history');
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [tokenAddress, selectedPeriod]);

  // Handle period change
  const handlePeriodChange = (period: TimePeriod) => {
    setSelectedPeriod(period);
  };

  // Format currency for display
  const formatCurrency = (value: number) => {
    if (value < 0.01) return `$${value.toFixed(6)}`;
    if (value < 1) return `$${value.toFixed(4)}`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Generate ECharts options
  const chartOptions: EChartsOption = useMemo(() => {
    if (chartData.length === 0) {
      return {};
    }

    const sortedData = [...chartData].sort((a, b) => a.unixTimestampMs - b.unixTimestampMs);
    const prices = sortedData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    return {
      grid: {
        left: 60,
        right: 20,
        top: 20,
        bottom: 60,
        containLabel: false,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'transparent',
        textStyle: {
          color: '#fff',
        },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const point = params[0] as { data: [number, number] };
          const date = new Date(point.data[0]);
          const dateStr = selectedPeriod === '30m' || selectedPeriod === '1h'
            ? date.toLocaleTimeString()
            : date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `
            <div style="padding: 8px;">
              <div style="margin-bottom: 4px; font-weight: bold;">${tokenSymbol}</div>
              <div style="color: #888; margin-bottom: 4px;">${dateStr}</div>
              <div style="font-size: 16px; font-weight: bold;">${formatCurrency(point.data[1])}</div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'time',
        axisLine: {
          lineStyle: {
            color: '#444',
          },
        },
        axisLabel: {
          color: '#888',
          formatter: (value: number) => {
            const date = new Date(value);
            if (selectedPeriod === '30m' || selectedPeriod === '1h') {
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            if (selectedPeriod === '24h') {
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          },
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        min: minPrice - priceRange * 0.1,
        max: maxPrice + priceRange * 0.1,
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: '#888',
          formatter: (value: number) => formatCurrency(value),
        },
        splitLine: {
          lineStyle: {
            color: '#333',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: tokenSymbol,
          type: 'line',
          data: sortedData.map(d => [d.unixTimestampMs, d.price]),
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: '#4589ff',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(69, 137, 255, 0.3)' },
                { offset: 1, color: 'rgba(69, 137, 255, 0.05)' },
              ],
            },
          },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          start: 0,
          end: 100,
        },
      ],
    };
  }, [chartData, tokenSymbol, selectedPeriod]);

  // Handle export as PNG
  const handleExport = () => {
    const echartsInstance = chartRef.current?.getEchartsInstance();
    if (echartsInstance) {
      const url = echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#1a1a1a',
      });
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tokenSymbol}-price-history-${selectedPeriod}.png`;
      link.click();
    }
  };

  // Empty state
  if (!tokenAddress) {
    return (
      <Tile className={styles.chartContainer}>
        <div className={styles.header}>
          <h3 className={styles.title}>Price History</h3>
        </div>
        <div className={styles.emptyState} style={{ height }}>
          <p>Select a token to view price history</p>
        </div>
      </Tile>
    );
  }

  // Loading state
  if (loading && chartData.length === 0) {
    return (
      <Tile className={styles.chartContainer}>
        <div className={styles.header}>
          <h3 className={styles.title}>Price History</h3>
        </div>
        <SkeletonPlaceholder style={{ height, width: '100%' }} />
      </Tile>
    );
  }

  return (
    <Tile className={styles.chartContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Price History</h3>
        <div className={styles.actions}>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            iconDescription="Fullscreen"
            renderIcon={Maximize}
          />
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            iconDescription="Save"
            renderIcon={Save}
          />
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            iconDescription="Export"
            renderIcon={Download}
            onClick={handleExport}
          />
        </div>
      </div>

      <div className={styles.timePeriodSelector}>
        {TIME_PERIODS.map(period => (
          <button
            key={period.value}
            type="button"
            className={`${styles.periodButton} ${selectedPeriod === period.value ? styles.active : ''}`}
            onClick={() => handlePeriodChange(period.value)}
          >
            {period.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className={styles.errorState} style={{ height }}>
          <p>{error}</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className={styles.emptyState} style={{ height }}>
          <p>No price data available for this period</p>
        </div>
      ) : (
        <ReactECharts
          ref={chartRef}
          option={chartOptions}
          style={{ height, width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
        />
      )}
    </Tile>
  );
};
