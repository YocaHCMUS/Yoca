# Quickstart Guide: Data Chart Components

**Feature**: 002-data-chart-components  
**Date**: 2025-12-03  
**Purpose**: Developer guide for implementing chart components with eCharts

---

## Overview

This feature introduces reusable chart components for visualizing cryptocurrency portfolio data. Charts include balance trends, asset distribution, exchange comparisons, P&L tracking, and more. All charts support filtering, export, auto-refresh, and multiple viewing modes (normal, fullscreen, mini-player).

**Tech Stack**:

- **Chart Library**: Apache eCharts 5.4.3 (via echarts-for-react 3.0.5)
- **Draggable UI**: react-rnd 10.4.1 (for mini-player)
- **Date/Timezone**: date-fns 2.30.0, date-fns-tz 2.0.0
- **Validation**: Zod (existing)
- **UI Framework**: Carbon Design System (existing)

---

## Installation

```bash
cd client

# Core chart dependencies
npm install echarts@5.4.3 echarts-for-react@3.0.5

# TypeScript types
npm install -D @types/echarts

# Mini-player functionality
npm install react-rnd@10.4.1

# Date/timezone handling
npm install date-fns@2.30.0 date-fns-tz@2.0.0

# Utilities
npm install lodash.debounce@4.0.8
npm install -D @types/lodash.debounce
```

**Bundle size impact**: ~129KB gzipped (25.8% of 500KB budget)

---

## Project Structure

```
client/src/
├── components/
│   └── charts/
│       ├── shared/                    # Shared chart components
│       │   ├── ChartWrapper.tsx       # Base wrapper with header/controls
│       │   ├── ChartSkeleton.tsx      # Loading skeleton
│       │   ├── ChartEmptyState.tsx    # Empty state component
│       │   ├── ChartErrorState.tsx    # Error state component
│       │   ├── FullscreenView.tsx     # Fullscreen mode container
│       │   ├── MiniPlayer.tsx         # Mini-player popup
│       │   └── ExportMenu.tsx         # Export format selector
│       │
│       ├── BalanceChart/              # Balance trend chart
│       │   ├── BalanceChart.tsx
│       │   ├── BalanceChart.module.scss
│       │   └── index.ts
│       │
│       ├── AssetDistribution/         # Asset distribution donut chart
│       │   ├── AssetDistribution.tsx
│       │   ├── AssetDistribution.module.scss
│       │   └── index.ts
│       │
│       ├── ExchangeComparison/        # Exchange activity bars
│       │   ├── ExchangeComparison.tsx
│       │   ├── ExchangeComparison.module.scss
│       │   └── index.ts
│       │
│       └── PnLChart/                  # Profit/loss dual-axis chart
│           ├── PnLChart.tsx
│           ├── PnLChart.module.scss
│           └── index.ts
│
├── hooks/
│   ├── useChartData.ts                # Data fetching hook
│   ├── useChartFilters.ts             # Filter management hook
│   ├── useChartExport.ts              # Export functionality hook
│   ├── useAutoRefresh.ts              # Auto-refresh hook
│   └── useFullscreen.ts               # Fullscreen mode hook
│
├── contexts/
│   └── ChartContext.tsx               # Shared timezone and registry
│
├── services/
│   └── chart/
│       ├── chartApi.ts                # API client for chart data
│       └── chartExport.ts             # Export utilities
│
├── types/
│   ├── chart.types.ts                 # Core chart types
│   ├── chart-data.types.ts            # Data types
│   ├── chart-filters.types.ts         # Filter types
│   └── chart-api.types.ts             # API response types
│
└── util/
    ├── echarts-setup.ts               # eCharts tree-shaking setup
    └── chart-helpers.ts               # Formatting utilities
```

---

## Step 1: eCharts Setup (Tree-shaking)

Create `client/src/util/echarts-setup.ts` to configure eCharts with only needed components:

```typescript
// client/src/util/echarts-setup.ts
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  PieChart,
  type LineSeriesOption,
  type BarSeriesOption,
  type PieSeriesOption,
} from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent,
  type TitleComponentOption,
  type TooltipComponentOption,
  type GridComponentOption,
  type LegendComponentOption,
  type DatasetComponentOption,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

// Register only needed components
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent,
  LineChart,
  BarChart,
  PieChart,
  CanvasRenderer,
  LabelLayout,
  UniversalTransition,
]);

// Export configured echarts instance
export default echarts;

// Export types for use in chart options
export type EChartsOption = echarts.ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | TitleComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | LegendComponentOption
  | DatasetComponentOption
>;
```

---

## Step 2: Define Types

Create type definitions in `client/src/types/chart.types.ts`:

```typescript
// client/src/types/chart.types.ts
export type ChartType =
  | "line"
  | "area"
  | "bar"
  | "stackedBar"
  | "pie"
  | "donut"
  | "dualAxis";

export type ViewMode = "normal" | "fullscreen" | "miniPlayer";

export type TimePeriod = "7D" | "30D" | "60D" | "90D" | "1Y" | "All" | "custom";

export type TransactionType =
  | "all"
  | "trades"
  | "transfers"
  | "deposits"
  | "withdrawals";

export type ExportFormat = "png" | "svg" | "csv";

export interface ChartFilters {
  timePeriod: TimePeriod;
  tokens: string[];
  transactionType: TransactionType;
  wallets?: string[];
  customDateRange?: DateRange;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ChartConfiguration {
  colors?: string[];
  height?: number;
  width?: string;
  showLegend?: boolean;
  legendPosition?: "left" | "right" | "top" | "bottom";
  showTooltip?: boolean;
  showDataLabels?: boolean;
  timezone?: string;
  dateFormat?: string;
  enableSampling?: boolean;
  samplingThreshold?: number;
}

// See data-model.md for complete type definitions
```

---

## Step 3: Create Chart Context

Create `client/src/contexts/ChartContext.tsx` for shared state:

```typescript
// client/src/contexts/ChartContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ChartContextValue {
  selectedTimezone: string;
  setTimezone: (tz: string) => void;
  registerChart: (chartId: string, refreshFn: () => Promise<void>) => void;
  unregisterChart: (chartId: string) => void;
  refreshAllCharts: () => Promise<void>;
}

const ChartContext = createContext<ChartContextValue | undefined>(undefined);

export const ChartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedTimezone, setSelectedTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [chartRegistry] = useState<Map<string, () => Promise<void>>>(new Map());

  const registerChart = useCallback((chartId: string, refreshFn: () => Promise<void>) => {
    chartRegistry.set(chartId, refreshFn);
  }, [chartRegistry]);

  const unregisterChart = useCallback((chartId: string) => {
    chartRegistry.delete(chartId);
  }, [chartRegistry]);

  const refreshAllCharts = useCallback(async () => {
    await Promise.all(Array.from(chartRegistry.values()).map(fn => fn()));
  }, [chartRegistry]);

  const setTimezone = useCallback((tz: string) => {
    setSelectedTimezone(tz);
    // Trigger refresh of all charts with new timezone
    refreshAllCharts();
  }, [refreshAllCharts]);

  return (
    <ChartContext.Provider
      value={{
        selectedTimezone,
        setTimezone,
        registerChart,
        unregisterChart,
        refreshAllCharts,
      }}
    >
      {children}
    </ChartContext.Provider>
  );
};

export const useChartContext = (): ChartContextValue => {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error('useChartContext must be used within ChartProvider');
  }
  return context;
};
```

---

## Step 4: Create Custom Hooks

### useChartFilters Hook

```typescript
// client/src/hooks/useChartFilters.ts
import { useState, useRef, useMemo } from "react";
import debounce from "lodash.debounce";
import type { ChartFilters } from "../types/chart.types";

interface UseChartFiltersOptions {
  initialFilters: ChartFilters;
  onFilterChange: (filters: ChartFilters) => Promise<void>;
  debounceMs?: number;
}

export const useChartFilters = ({
  initialFilters,
  onFilterChange,
  debounceMs = 300,
}: UseChartFiltersOptions) => {
  const [filters, setFilters] = useState<ChartFilters>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  // Debounced filter application
  const debouncedFetch = useMemo(
    () =>
      debounce(async (filters: ChartFilters, requestId: number) => {
        setIsLoading(true);
        try {
          await onFilterChange(filters);
          if (requestId === requestIdRef.current) {
            setIsLoading(false);
          }
        } catch (error) {
          if (requestId === requestIdRef.current) {
            console.error("Filter change failed:", error);
            setIsLoading(false);
          }
        }
      }, debounceMs),
    [onFilterChange, debounceMs],
  );

  const updateFilters = (newFilters: Partial<ChartFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);

    // Increment request ID to track latest request
    requestIdRef.current += 1;
    debouncedFetch(updated, requestIdRef.current);
  };

  return { filters, updateFilters, isLoading };
};
```

### useAutoRefresh Hook

```typescript
// client/src/hooks/useAutoRefresh.ts
import { useState, useEffect, useRef, useCallback } from "react";

interface UseAutoRefreshOptions {
  interval?: number;
  enabled?: boolean;
  onRefresh: () => Promise<void>;
  pauseOnInteraction?: boolean;
}

export const useAutoRefresh = ({
  interval = 30000,
  enabled = true,
  onRefresh,
  pauseOnInteraction = true,
}: UseAutoRefreshOptions) => {
  const [isPaused, setIsPaused] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(interval / 1000);
  const timerRef = useRef<NodeJS.Timeout>();
  const countdownRef = useRef<NodeJS.Timeout>();

  // Pause when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPaused(document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Pause on user interaction (optional)
  useEffect(() => {
    if (!pauseOnInteraction) return;

    let timeoutId: NodeJS.Timeout;
    const handleInteraction = () => {
      setIsPaused(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsPaused(false), 5000);
    };

    window.addEventListener("mousemove", handleInteraction);
    window.addEventListener("scroll", handleInteraction);

    return () => {
      window.removeEventListener("mousemove", handleInteraction);
      window.removeEventListener("scroll", handleInteraction);
      clearTimeout(timeoutId);
    };
  }, [pauseOnInteraction]);

  // Main refresh logic
  useEffect(() => {
    if (!enabled || isPaused) {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
      return;
    }

    const refresh = async () => {
      await onRefresh();
      setLastRefresh(new Date());
      setCountdown(interval / 1000);
    };

    refresh();
    timerRef.current = setInterval(refresh, interval);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [enabled, isPaused, interval, onRefresh]);

  const manualRefresh = useCallback(async () => {
    await onRefresh();
    setLastRefresh(new Date());
    setCountdown(interval / 1000);
  }, [onRefresh, interval]);

  return {
    lastRefresh,
    countdown,
    isPaused,
    manualRefresh,
  };
};
```

---

## Step 5: Create Chart Wrapper Component

```typescript
// client/src/components/charts/shared/ChartWrapper.tsx
import React, { useRef, useState, ReactNode } from 'react';
import ReactECharts from 'echarts-for-react';
import { Button, Dropdown, MultiSelect } from '@carbon/react';
import { Maximize, Download, Renew } from '@carbon/icons-react';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import type { ChartFilters, ChartConfiguration } from '../../../types/chart.types';
import type { EChartsOption } from '../../../util/echarts-setup';
import styles from './ChartWrapper.module.scss';

interface ChartWrapperProps {
  title: string;
  option: EChartsOption;
  config?: ChartConfiguration;
  filters: ChartFilters;
  onFilterChange: (filters: ChartFilters) => Promise<void>;
  onExport: () => void;
  onFullscreen: () => void;
  showFilters?: boolean;
  children?: ReactNode;
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({
  title,
  option,
  config,
  filters,
  onFilterChange,
  onExport,
  onFullscreen,
  showFilters = true,
  children,
}) => {
  const chartRef = useRef<ReactECharts>(null);
  const { updateFilters, isLoading } = useChartFilters({
    initialFilters: filters,
    onFilterChange,
  });

  const { countdown, manualRefresh } = useAutoRefresh({
    interval: 30000,
    enabled: true,
    onRefresh: () => onFilterChange(filters),
  });

  return (
    <div className={styles.chartWrapper}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>

        {/* Controls */}
        <div className={styles.controls}>
          {showFilters && (
            <>
              <Dropdown
                id="time-period"
                titleText=""
                label="Time Period"
                items={['7D', '30D', '60D', '90D', '1Y', 'All']}
                selectedItem={filters.timePeriod}
                onChange={({ selectedItem }) =>
                  updateFilters({ timePeriod: selectedItem as any })
                }
              />

              <MultiSelect
                id="tokens"
                titleText=""
                label="Tokens"
                items={[{ id: 'All', text: 'All' }]}
                selectedItems={filters.tokens}
                onChange={({ selectedItems }) =>
                  updateFilters({ tokens: selectedItems })
                }
              />
            </>
          )}

          <Button
            kind="ghost"
            size="sm"
            renderIcon={Renew}
            iconDescription="Refresh"
            hasIconOnly
            onClick={manualRefresh}
            disabled={isLoading}
          />

          <Button
            kind="ghost"
            size="sm"
            renderIcon={Download}
            iconDescription="Export"
            hasIconOnly
            onClick={onExport}
          />

          <Button
            kind="ghost"
            size="sm"
            renderIcon={Maximize}
            iconDescription="Fullscreen"
            hasIconOnly
            onClick={onFullscreen}
          />
        </div>
      </div>

      {/* Chart */}
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{
          height: config?.height || 400,
          width: config?.width || '100%',
        }}
        opts={{ renderer: 'canvas' }}
      />

      {/* Optional children (e.g., legend, additional info) */}
      {children}
    </div>
  );
};
```

---

## Step 6: Create a Sample Chart Component

```typescript
// client/src/components/charts/BalanceChart/BalanceChart.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { ChartWrapper } from '../shared/ChartWrapper';
import { useChartContext } from '../../../contexts/ChartContext';
import { chartApi } from '../../../services/chart/chartApi';
import type { ChartFilters } from '../../../types/chart.types';
import type { EChartsOption } from '../../../util/echarts-setup';
import { format, utcToZonedTime } from 'date-fns-tz';

export const BalanceChart: React.FC = () => {
  const { selectedTimezone } = useChartContext();
  const [data, setData] = useState<any>(null);
  const [filters, setFilters] = useState<ChartFilters>({
    timePeriod: '30D',
    tokens: ['All'],
    transactionType: 'all',
  });

  // Fetch data
  const fetchData = async (newFilters: ChartFilters) => {
    const response = await chartApi.getBalanceTrend({
      period: newFilters.timePeriod,
      tokens: newFilters.tokens.join(','),
    });
    setData(response);
  };

  useEffect(() => {
    fetchData(filters);
  }, []);

  // Generate eCharts option
  const chartOption = useMemo<EChartsOption>(() => {
    if (!data) return {};

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const { value } = params[0];
          const zonedDate = utcToZonedTime(new Date(value[0]), selectedTimezone);
          return `
            <strong>${format(zonedDate, 'MMM dd, yyyy HH:mm', { timeZone: selectedTimezone })}</strong><br/>
            Balance: $${value[1].toLocaleString()}<br/>
            <em>${selectedTimezone}</em>
          `;
        },
      },
      xAxis: {
        type: 'time',
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => `$${(value / 1000).toFixed(1)}K`,
        },
      },
      series: data.series.map((s: any) => ({
        name: s.name,
        type: 'line',
        data: s.data.map((d: any) => [d.timestamp, d.value]),
        areaStyle: { color: 'rgba(0, 128, 255, 0.1)' },
        smooth: true,
        sampling: 'lttb',
      })),
    };
  }, [data, selectedTimezone]);

  return (
    <ChartWrapper
      title="Balance Trend"
      option={chartOption}
      filters={filters}
      onFilterChange={async (newFilters) => {
        setFilters(newFilters);
        await fetchData(newFilters);
      }}
      onExport={() => console.log('Export')}
      onFullscreen={() => console.log('Fullscreen')}
    />
  );
};
```

---

## Step 7: Usage in Page

```typescript
// client/src/pages/dashboard/DashboardPage.tsx
import React from 'react';
import { ChartProvider } from '../../contexts/ChartContext';
import { BalanceChart } from '../../components/charts/BalanceChart';
import { AssetDistribution } from '../../components/charts/AssetDistribution';
import styles from './DashboardPage.module.scss';

export const DashboardPage: React.FC = () => {
  return (
    <ChartProvider>
      <div className={styles.dashboard}>
        <h1>Portfolio Dashboard</h1>

        <div className={styles.chartsGrid}>
          <BalanceChart />
          <AssetDistribution />
          {/* Add more charts */}
        </div>
      </div>
    </ChartProvider>
  );
};
```

```scss
// client/src/pages/dashboard/DashboardPage.module.scss
.dashboard {
  padding: 2rem;
}

.chartsGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-top: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// client/src/hooks/__tests__/useChartFilters.test.ts
import { renderHook, act } from "@testing-library/react";
import { useChartFilters } from "../useChartFilters";
import { vi } from "vitest";

describe("useChartFilters", () => {
  it("should debounce filter changes", async () => {
    const onFilterChange = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useChartFilters({
        initialFilters: {
          timePeriod: "30D",
          tokens: ["All"],
          transactionType: "all",
        },
        onFilterChange,
        debounceMs: 100,
      }),
    );

    act(() => {
      result.current.updateFilters({ timePeriod: "7D" });
    });

    expect(onFilterChange).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(onFilterChange).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests (API)

```typescript
// server/src/routes/__tests__/charts.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../main";

describe("GET /api/charts/balance", () => {
  it("should return balance trend data", async () => {
    const response = await request(app)
      .get("/api/charts/balance")
      .query({ period: "30D" })
      .set("Authorization", "Bearer mock-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("series");
    expect(response.body).toHaveProperty("metadata");
  });
});
```

---

## Performance Checklist

- [x] Tree-shaking eCharts (only import needed charts)
- [ ] Lazy load chart components by route
- [ ] Use LTTB sampling for large datasets (>2000 points)
- [ ] Debounce filter changes (300ms)
- [ ] Stagger auto-refresh across multiple charts
- [ ] Monitor bundle size in CI/CD

---

## Accessibility Checklist

- [ ] All interactive elements keyboard-navigable
- [ ] Chart titles use semantic heading levels
- [ ] Tooltips have appropriate ARIA labels
- [ ] Color-blind friendly palette
- [ ] Screen reader announcements for data updates

---

## Next Steps

1. Implement remaining chart types (ExchangeComparison, PnLChart, etc.)
2. Add fullscreen and mini-player functionality
3. Implement export features (PNG, SVG, CSV)
4. Add comprehensive error handling and empty states
5. Create E2E tests for critical user flows
6. Performance testing with large datasets

---

## Resources

- [eCharts Documentation](https://echarts.apache.org/en/index.html)
- [echarts-for-react GitHub](https://github.com/hustcc/echarts-for-react)
- [react-rnd Documentation](https://github.com/bokuweb/react-rnd)
- [Feature Spec](./spec.md)
- [Data Model](./data-model.md)
- [API Contract](./contracts/chart-api.yaml)
