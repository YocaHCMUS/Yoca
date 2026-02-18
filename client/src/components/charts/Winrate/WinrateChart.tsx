/**
 * Winrate Chart Component
 * 
 * Displays winrate analysis with two-row layout:
 * - Row 1: Column chart showing overall winrate of multiple wallets
 * - Row 2: Histograms showing winning/losing magnitude distribution for each wallet
 * 
 * Features:
 * - Two-part layout (overall winrate + distribution)
 * - Multiple wallet support
 * - Auto-refresh on wallet changes
 * - Inverse data display for losing trades
 * 
 * @module components/charts/Winrate
 */

import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { formatItemTooltip } from '@/util/tooltip-helpers';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { fetchWinrate } from '@/services/chart/chartApi';
import type { WinrateResponse, WinrateRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import type { ChartProps } from '../shared/ChartProp';
import styles from './Winrate.module.scss';

export function WinrateChart({
  title,
  minHeight = 400,
  initialFilters = {
    timePeriod: '30D',
    wallets: []
  },
  autoRefresh = true,
  refreshInterval = 30000,
  className,
}: ChartProps) {
  const { t } = useTranslation();
  const chartTitle = title || t('charts.winrateChart.title', 'Winrate Analysis');

  const overallChartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();

  const { filters, setTimePeriod, setWallets } = useChartFilters({
    initialFilters: initialFilters,
    debounceDelay: 300,
  });

  // Track previous initialFilters to detect changes
  const prevInitialFiltersRef = useRef<typeof initialFilters | undefined>(undefined);

  /**
   * Sync filters when initialFilters changes
   */
  useEffect(() => {
    const prevFilters = prevInitialFiltersRef.current;
    
    if (initialFilters?.wallets && Array.isArray(initialFilters.wallets)) {
      const prevWallets = Array.isArray(prevFilters?.wallets) ? prevFilters.wallets : [];
      const prevWalletsStr = prevWallets.slice().sort().join(',');
      const newWalletsStr = initialFilters.wallets.slice().sort().join(',');
      if (prevWalletsStr !== newWalletsStr) {
        setWallets(initialFilters.wallets);
      }
    }
    
    if (initialFilters?.timePeriod && prevFilters?.timePeriod !== initialFilters.timePeriod) {
      setTimePeriod(initialFilters.timePeriod);
    }
    
    prevInitialFiltersRef.current = initialFilters;
  }, [initialFilters, setWallets, setTimePeriod]);

  /**
   * Memoize wallets string
   */
  const walletsString = useMemo(() => {
    if (!filters.wallets || !Array.isArray(filters.wallets) || filters.wallets.length === 0) return undefined;
    return filters.wallets.slice().sort().join(',');
  }, [filters.wallets]);

  /**
   * Memoize query
   */
  const query = useMemo<WinrateRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString]
  );

  /**
   * Lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<WinrateResponse, WinrateRequestParams>({
      fetcher: fetchWinrate,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Generate overall winrate column chart
   */
  const overallWinrateOption = useMemo((): EChartsOption | null => {
    if (!data || !data.wallets || data.wallets.length === 0) return null;

    const baseOption = getThemedChartBaseOption(chartTheme);
    
    const categories = data.wallets.map(w => w.walletName || w.walletAddress);
    const winrateValues = data.wallets.map(w => w.winrate);
    
    return {
      ...baseOption,
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: categories,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          interval: 0,
          rotate: categories.length > 5 ? 30 : 0,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: 'Winrate (%)',
        min: 0,
        max: 100,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: '{value}%',
        },
      },
      series: [
        {
          name: 'Winrate',
          type: 'bar',
          data: winrateValues,
          itemStyle: {
            color: chartTheme.colorPalette[0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            color: chartTheme.textColor,
          },
        },
      ],
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        formatter: (params: any) => {
          const param = params[0];
          const wallet = data.wallets[param.dataIndex];
          return formatItemTooltip(
            param.name,
            [
              { label: 'Winrate', value: `${param.value}%` },
              { label: 'Winning Trades', value: wallet.winningTrades.toString() },
              { label: 'Losing Trades', value: wallet.losingTrades.toString() },
              { label: 'Total Trades', value: wallet.totalTrades.toString() },
            ]
          );
        },
      },
    };
  }, [data, chartTheme, t]);

  /**
   * Generate distribution charts for each wallet
   */
  const distributionCharts = useMemo(() => {
    if (!data || !data.wallets || data.wallets.length === 0) return [];

    return data.wallets.map((wallet) => {
      const baseOption = getThemedChartBaseOption(chartTheme);
      
      // Prepare data
      const categories = wallet.winningDistribution.map(d => d.range);
      const winningCounts = wallet.winningDistribution.map(d => d.count);
      const losingCounts = wallet.losingDistribution.map(d => -d.count); // Negative for inverse display
      
      const option: EChartsOption = {
        ...baseOption,
        title: {
          text: wallet.walletName || wallet.walletAddress,
          left: 'center',
          textStyle: {
            color: chartTheme.textColor,
            fontSize: 14,
            fontWeight: 'normal',
          },
        },
        grid: {
          left: '15%',
          right: '10%',
          bottom: '15%',
          top: '20%',
          containLabel: true,
        },
        xAxis: {
          ...baseOption.xAxis,
          type: 'category',
          data: categories,
          axisLabel: {
            ...baseOption.xAxis.axisLabel,
            interval: 0,
            rotate: 30,
          },
        },
        yAxis: {
          ...baseOption.yAxis,
          type: 'value',
          name: 'Trade Count',
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => Math.abs(value).toString(),
          },
        },
        series: [
          {
            name: 'Winning',
            type: 'bar',
            stack: 'total',
            data: winningCounts,
            itemStyle: {
              color: chartTheme.colorPalette[1], // Green
            },
          },
          {
            name: 'Losing',
            type: 'bar',
            stack: 'total',
            data: losingCounts,
            itemStyle: {
              color: chartTheme.colorPalette[2], // Red
            },
          },
        ],
        legend: {
          ...baseOption.legend,
          show: true,
          top: '5%',
          data: ['Winning', 'Losing'],
        },
        tooltip: {
          ...baseOption.tooltip,
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
          formatter: (params: any) => {
            const winning = params.find((p: any) => p.seriesName === 'Winning');
            const losing = params.find((p: any) => p.seriesName === 'Losing');
            return `
              <div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div>
              ${winning ? `<div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${chartTheme.colorPalette[1]}">● Winning:</span><strong>${winning.value}</strong>
              </div>` : ''}
              ${losing ? `<div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${chartTheme.colorPalette[2]}">● Losing:</span><strong>${Math.abs(losing.value)}</strong>
              </div>` : ''}
            `;
          },
        },
      };
      
      return {
        walletAddress: wallet.walletAddress,
        option,
      };
    });
  }, [data, chartTheme]);

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!data || !data.wallets || data.wallets.length === 0}
      onRetry={() => refetch(false)}
    >
      <div className={styles.winrateContainer}>
        {/* Row 1: Overall Winrate */}
        <div className={styles.overallSection}>
          {overallWinrateOption && (
            <ReactECharts
              ref={overallChartRef}
              option={overallWinrateOption}
              style={{ height: '100%', width: '100%', minHeight: '300px' }}
              notMerge
              lazyUpdate
            />
          )}
        </div>
        
        {/* Row 2: Distribution Histograms */}
        <div className={styles.distributionSection}>
          {distributionCharts.map((chart) => (
            <div key={chart.walletAddress} className={styles.distributionChart}>
              <ReactECharts
                option={chart.option}
                style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                notMerge
                lazyUpdate
              />
            </div>
          ))}
        </div>
      </div>
    </BaseChart>
  );
}
