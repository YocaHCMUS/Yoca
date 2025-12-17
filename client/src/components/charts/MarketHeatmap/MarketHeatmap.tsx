import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Tile, InlineLoading } from '@carbon/react';
import { WarningAlt, Maximize } from '@carbon/icons-react';
import {
  mockFetchHeatmapData,
  getChangeColor,
  formatLargeNumber,
  formatPrice,
  type HeatmapCell,
} from '../../../services/market/mockMarketData';
import styles from './MarketHeatmap.module.scss';

interface MarketHeatmapProps {
  height?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const MarketHeatmap: React.FC<MarketHeatmapProps> = ({
  height = 500,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [data, setData] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const heatmapData = await mockFetchHeatmapData();
      setData(heatmapData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh, refreshInterval]);

  const chartOption = useMemo(() => {
    if (data.length === 0) return {};

    const treemapData = data.map((item) => ({
      name: item.symbol,
      value: item.value,
      itemStyle: {
        color: getChangeColor(item.change),
      },
      customData: {
        fullName: item.name,
        price: item.price,
        change: item.change,
        volume: item.volume,
      },
    }));

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#161616',
        borderColor: '#393939',
        textStyle: {
          color: '#ffffff',
        },
        formatter: (params: any) => {
          const { data } = params;
          const { customData } = data;
          const changeColor = customData.change >= 0 ? '#66cdaa' : '#e57373';
          
          return `
            <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">
              ${customData.fullName} (${data.name})
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px;">
              <span style="color: #c6c6c6">Price:</span>
              <span style="font-weight: 600">${formatPrice(customData.price)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px;">
              <span style="color: #c6c6c6">24h Change:</span>
              <span style="color: ${changeColor}; font-weight: 600">
                ${customData.change > 0 ? '+' : ''}${customData.change.toFixed(2)}%
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px;">
              <span style="color: #c6c6c6">Market Cap:</span>
              <span>${formatLargeNumber(data.value)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px;">
              <span style="color: #c6c6c6">Volume:</span>
              <span>${formatLargeNumber(customData.volume)}</span>
            </div>
          `;
        },
      },
      series: [
        {
          type: 'treemap',
          width: '100%',
          height: '100%',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: 14,
            formatter: (params: any) => {
              const { name, customData } = params.data;
              return `{symbol|${name}}\n{change|${customData.change > 0 ? '+' : ''}${customData.change.toFixed(2)}%}`;
            },
            rich: {
              symbol: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff',
                align: 'center',
                padding: [0, 0, 4, 0],
              },
              change: {
                fontSize: 11,
                color: '#ffffff',
                align: 'center',
                opacity: 0.9,
              },
            },
          },
          itemStyle: {
            borderColor: '#f3f4f6',
            borderWidth: 1,
            gapWidth: 1,
          },
          data: treemapData,
        },
      ],
    };
  }, [data]);

  if (loading) {
    return (
      <Tile className={styles.heatmap}>
        <div style={{ height: `${height}px` }} className={styles.loading}>
          <InlineLoading description="Loading market data..." />
        </div>
      </Tile>
    );
  }

  if (error) {
    return (
      <Tile className={styles.heatmap}>
        <div style={{ height: `${height}px` }} className={styles.error}>
          <WarningAlt size={32} />
          <p>{error}</p>
          <button onClick={fetchData} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </Tile>
    );
  }

  return (
    <Tile className={styles.heatmap}>
      <div className={styles.chartContainer} style={{ height: `${height}px` }}>
        <ReactECharts
          option={chartOption}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
        <button className={styles.expandButton} aria-label="Expand chart">
          <Maximize size={16} />
        </button>
      </div>
    </Tile>
  );
};