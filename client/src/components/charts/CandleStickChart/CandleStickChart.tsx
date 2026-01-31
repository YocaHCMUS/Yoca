// client/src/components/charts/CandleStickChart/CandleStickChart.tsx

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useChartTheme } from '../../../hooks/useChartTheme.js';
import type { OHLCData } from '../../../util/finance-helpers.js';
import { calculateMA } from '../../../util/finance-helpers.js';

interface CandleStickChartProps {
    data: OHLCData[];
    title?: string;
    height?: number;
}

export const CandleStickChart = ({ data, title, height = 500 }: CandleStickChartProps) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<echarts.ECharts | null>(null);

    const chartTheme = useChartTheme() as any;
    const isDark: boolean =
        typeof chartTheme?.isDark === 'boolean'
            ? chartTheme.isDark
            : chartTheme?.theme === 'dark' || chartTheme?.mode === 'dark';

    const categoryData = data.map(item => item.time);
    const values = data.map(item => [item.open, item.close, item.low, item.high]);

    useEffect(() => {
        if (!chartRef.current) return;

        if (chartInstance.current) {
            chartInstance.current.dispose();
        }

        chartInstance.current = echarts.init(chartRef.current, isDark ? 'dark' : undefined);

        const upColor = '#ec0000';
        const upBorderColor = '#8A0000';
        const downColor = '#00da3c';
        const downBorderColor = '#008F28';

        const option: echarts.EChartsOption = {
            backgroundColor: 'transparent',
            title: {
                text: title || '',
                left: 0,
                textStyle: {
                    color: isDark ? '#f4f4f4' : '#161616'
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: isDark ? '#262626' : '#ffffff',
                borderColor: '#8d8d8d',
                textStyle: {
                    color: isDark ? '#f4f4f4' : '#161616'
                }
            },
            legend: {
                data: ['Candle', 'MA5', 'MA10', 'MA20', 'MA30'],
                top: 20,
                textStyle: {
                    color: isDark ? '#c6c6c6' : '#525252'
                }
            },
            grid: {
                left: '3%',
                right: '3%',
                bottom: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: categoryData,
                boundaryGap: false,
                axisLine: { onZero: false, lineStyle: { color: '#8d8d8d' } },
                splitLine: { show: false },
                min: 'dataMin',
                max: 'dataMax'
            },
            yAxis: {
                scale: true,
                splitArea: { show: false },
                splitLine: { show: true, lineStyle: { color: isDark ? '#393939' : '#e0e0e0' } }
            },
            dataZoom: [
                { type: 'inside', start: 50, end: 100 },
                { type: 'slider', show: true, top: '90%', start: 50, end: 100 }
            ],
            series: [
                {
                    name: 'Candle',
                    type: 'candlestick',
                    data: values,
                    itemStyle: {
                        color: upColor,
                        color0: downColor,
                        borderColor: upBorderColor,
                        borderColor0: downBorderColor
                    }
                },
                {
                    name: 'MA5',
                    type: 'line',
                    data: calculateMA(5, data),
                    smooth: true,
                    lineStyle: { opacity: 0.5 }
                },
                {
                    name: 'MA10',
                    type: 'line',
                    data: calculateMA(10, data),
                    smooth: true,
                    lineStyle: { opacity: 0.5 }
                },
                {
                    name: 'MA20',
                    type: 'line',
                    data: calculateMA(20, data),
                    smooth: true,
                    lineStyle: { opacity: 0.5 }
                },
                {
                    name: 'MA30',
                    type: 'line',
                    data: calculateMA(30, data),
                    smooth: true,
                    lineStyle: { opacity: 0.5 }
                }
            ]
        };

        chartInstance.current.setOption(option);

        const handleResize = () => chartInstance.current?.resize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chartInstance.current?.dispose();
        };
    }, [data, isDark, title]);

    return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />;
};
