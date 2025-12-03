# Data Model: Data Chart Components

**Feature**: 002-data-chart-components  
**Date**: 2025-12-03  
**Purpose**: Define entities, relationships, and data structures for chart components

---

## Core Entities

### 1. ChartComponent

Reusable UI component that renders data visualizations with header, controls, chart area, and optional legend.

**Properties**:

```typescript
interface ChartComponent {
  id: string; // Unique identifier for the chart instance
  type: ChartType; // Type of visualization
  title: string; // Display title in header
  config: ChartConfiguration; // Chart-specific configuration
  filters: ChartFilters; // Active filter state
  viewMode: ViewMode; // Display mode (normal, fullscreen, mini-player)
  autoRefresh: AutoRefreshConfig; // Auto-refresh settings
}

type ChartType =
  | "line" // Time series line chart
  | "area" // Time series with area fill
  | "bar" // Bar chart (single or grouped)
  | "stackedBar" // Stacked bar chart
  | "pie" // Pie chart
  | "donut" // Donut chart
  | "dualAxis"; // Dual-axis chart (bars + line)

type ViewMode = "normal" | "fullscreen" | "miniPlayer";
```

**Validation Rules**:

- `id` MUST be unique across all chart instances on a page
- `title` MUST be non-empty string (1-100 characters)
- `type` MUST be one of the defined ChartType values
- `config` MUST conform to ChartConfiguration schema for the specified type

**State Transitions**:

```
normal → fullscreen: User clicks expand button
fullscreen → normal: User clicks close or presses ESC
normal → miniPlayer: User clicks mini-player button
miniPlayer → normal: User clicks close or presses ESC
miniPlayer → fullscreen: User clicks expand in mini-player
```

---

### 2. ChartConfiguration

Type-safe configuration for chart rendering options.

**Properties**:

```typescript
interface ChartConfiguration {
  // Visual styling
  colors?: string[]; // Color palette (uses default if not specified)
  height?: number; // Chart height in pixels (default: 400)
  width?: string; // Chart width (default: '100%')

  // Data presentation
  showLegend?: boolean; // Display legend (default: true)
  legendPosition?: "left" | "right" | "top" | "bottom"; // Legend placement
  showTooltip?: boolean; // Enable tooltips (default: true)
  showDataLabels?: boolean; // Show values on data points (default: false)

  // Axes configuration (for time series/bar charts)
  xAxis?: AxisConfig;
  yAxis?: AxisConfig | AxisConfig[]; // Array for dual-axis charts

  // Time series specific
  timezone?: string; // IANA timezone (default: user's local)
  dateFormat?: string; // date-fns format string

  // Performance
  enableSampling?: boolean; // Enable LTTB sampling for large datasets
  samplingThreshold?: number; // Point count threshold (default: 2000)

  // Export settings
  exportFilename?: string; // Base filename for exports
}

interface AxisConfig {
  label?: string; // Axis label text
  formatter?: (value: number | string) => string; // Value formatter
  min?: number; // Minimum value (auto if not set)
  max?: number; // Maximum value (auto if not set)
}
```

**Validation Rules**:

- `height` MUST be between 200 and 1200 pixels
- `colors` array MUST contain valid hex colors (#RRGGBB)
- `timezone` MUST be valid IANA timezone string (e.g., 'America/New_York', 'UTC')
- `samplingThreshold` MUST be positive integer ≥ 100

---

### 3. ChartFilters

Current filter state for a chart instance.

**Properties**:

```typescript
interface ChartFilters {
  timePeriod: TimePeriod; // Time range filter
  tokens: string[]; // Selected tokens (['All'] or specific tokens)
  transactionType: TransactionType; // Transaction type filter
  wallets?: string[]; // Optional wallet filter
  customDateRange?: DateRange; // Custom date range (if timePeriod is 'custom')
}

type TimePeriod = "7D" | "30D" | "60D" | "90D" | "1Y" | "All" | "custom";

type TransactionType =
  | "all" // All transaction types
  | "trades" // Only trade transactions
  | "transfers" // Only transfer transactions
  | "deposits" // Only deposits
  | "withdrawals"; // Only withdrawals

interface DateRange {
  start: Date; // Start date (inclusive)
  end: Date; // End date (inclusive)
}
```

**Validation Rules**:

- If `tokens` includes 'All', it MUST be the only element
- If `timePeriod` is 'custom', `customDateRange` MUST be provided
- `customDateRange.start` MUST be before `customDateRange.end`
- `wallets` array MUST be non-empty if provided

**Default Values**:

```typescript
const defaultFilters: ChartFilters = {
  timePeriod: "30D",
  tokens: ["All"],
  transactionType: "all",
  wallets: undefined,
  customDateRange: undefined,
};
```

---

### 4. ChartDataSeries

A collection of data points representing a single metric.

**Properties**:

```typescript
interface ChartDataSeries {
  id: string; // Unique series identifier
  name: string; // Display name for legend
  type: ChartType; // Visualization type for this series
  data: DataPoint[]; // Array of data points
  color?: string; // Series color (uses palette if not set)
  visible: boolean; // Visibility state (toggled via legend)
  yAxisIndex?: number; // Y-axis index for dual-axis charts (0 or 1)
}
```

**Validation Rules**:

- `id` MUST be unique within a ChartComponent
- `name` MUST be non-empty string
- `data` array MUST NOT be empty
- `yAxisIndex` MUST be 0 or 1 for dual-axis charts, undefined otherwise

---

### 5. DataPoint

Individual value within a data series.

**Properties**:

```typescript
type DataPoint = TimeSeriesPoint | CategoricalPoint | DistributionPoint;

// For time series charts (line, area, bar over time)
interface TimeSeriesPoint {
  timestamp: number; // Unix timestamp (milliseconds)
  value: number; // Numeric value
  metadata?: Record<string, unknown>; // Optional additional data
}

// For categorical charts (bar, grouped bar)
interface CategoricalPoint {
  category: string; // Category label (e.g., exchange name)
  value: number; // Numeric value
  metadata?: Record<string, unknown>;
}

// For distribution charts (pie, donut)
interface DistributionPoint {
  name: string; // Segment label (e.g., token symbol)
  value: number; // Numeric value (absolute, not percentage)
  metadata?: Record<string, unknown>;
}
```

**Validation Rules**:

- `timestamp` MUST be valid Unix timestamp (> 0)
- `value` MUST be finite number (not NaN, not Infinity)
- `category` and `name` MUST be non-empty strings

**Formatting**:

```typescript
// Display value formatted based on context
interface FormattedDataPoint {
  raw: DataPoint;
  display: {
    timestamp?: string; // Formatted date/time
    value: string; // Formatted value ($1.2M, 45%)
    label: string; // Category/name label
  };
}
```

---

### 6. AutoRefreshConfig

Configuration for automatic data refresh.

**Properties**:

```typescript
interface AutoRefreshConfig {
  enabled: boolean; // Enable/disable auto-refresh
  interval: number; // Refresh interval in milliseconds
  pauseOnInteraction: boolean; // Pause during user interaction
  staggerOffset?: number; // Stagger offset to prevent simultaneous refreshes
  lastRefresh?: Date; // Timestamp of last successful refresh
}
```

**Validation Rules**:

- `interval` MUST be ≥ 5000 (minimum 5 seconds)
- `staggerOffset` MUST be between 0 and 5000 ms

**Default Values**:

```typescript
const defaultAutoRefresh: AutoRefreshConfig = {
  enabled: true,
  interval: 30000, // 30 seconds
  pauseOnInteraction: true,
  staggerOffset: undefined, // Calculated based on chart ID
  lastRefresh: undefined,
};
```

---

### 7. ExportConfig

Configuration for chart data export.

**Properties**:

```typescript
interface ExportConfig {
  format: ExportFormat; // Export file format
  includeMetadata: boolean; // Include metadata in export
  filename: string; // Generated filename
  quality?: number; // Image quality (PNG only, 1-3)
}

type ExportFormat = "png" | "svg" | "csv";

interface ExportMetadata {
  chartTitle: string; // Chart title
  timezone: string; // Active timezone
  filters: ChartFilters; // Applied filters
  exportDate: string; // ISO 8601 timestamp
  dataPointCount: number; // Number of data points
}
```

**Validation Rules**:

- `filename` MUST follow pattern: `{dataName}-{filters}-{timestamp}.{ext}`
- `quality` MUST be 1 (normal), 2 (retina), or 3 (print) if provided
- PNG exports MUST use `quality: 2` (retina) by default

**Filename Generation**:

```typescript
// Example: balance-30D-BTC-2025-12-03T10-30-15.png
const generateFilename = (
  dataName: string,
  filters: ChartFilters,
  format: ExportFormat,
): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5); // Remove milliseconds and Z

  const filterParts = [
    filters.timePeriod,
    filters.tokens.join(","),
    filters.transactionType !== "all" ? filters.transactionType : null,
  ].filter(Boolean);

  const filterStr = filterParts.join("-");
  return `${dataName}-${filterStr}-${timestamp}.${format}`;
};
```

---

### 8. ViewModeState

State management for chart viewing modes.

**Properties**:

```typescript
interface ViewModeState {
  mode: ViewMode; // Current view mode
  position?: Position; // Mini-player position
  size?: Size; // Mini-player size
  previousMode?: ViewMode; // Previous mode (for restoration)
}

interface Position {
  x: number; // X coordinate (pixels from left)
  y: number; // Y coordinate (pixels from top)
}

interface Size {
  width: number; // Width in pixels
  height: number; // Height in pixels
}
```

**Validation Rules**:

- `position.x` and `position.y` MUST be non-negative
- `size.width` MUST be ≥ 300px
- `size.height` MUST be ≥ 200px
- `position` and `size` MUST be defined if `mode` is 'miniPlayer'

**Default Mini-player State**:

```typescript
const defaultMiniPlayerState: ViewModeState = {
  mode: "miniPlayer",
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
  previousMode: "normal",
};
```

---

### 9. ChartLoadingState

Loading and error states for chart data.

**Properties**:

```typescript
interface ChartLoadingState {
  status: LoadingStatus; // Current loading status
  error?: ChartError; // Error details if status is 'error'
  retryCount: number; // Number of retry attempts
  lastAttempt?: Date; // Timestamp of last fetch attempt
}

type LoadingStatus =
  | "idle" // Initial state, no data loaded
  | "loading" // Data fetch in progress
  | "success" // Data loaded successfully
  | "error" // Data fetch failed
  | "refreshing"; // Auto-refresh in progress (shows previous data)

interface ChartError {
  code: string; // Error code (e.g., 'NETWORK_ERROR', 'INVALID_DATA')
  message: string; // User-friendly error message
  technical?: string; // Technical error details (for logging)
  retryable: boolean; // Whether error is retryable
}
```

**State Transitions**:

```
idle → loading: Initial data fetch
loading → success: Fetch succeeded
loading → error: Fetch failed
success → refreshing: Auto-refresh triggered
refreshing → success: Refresh succeeded
refreshing → error: Refresh failed (keeps previous data)
error → loading: Manual retry
```

---

## Entity Relationships

```
ChartComponent (1) ──── (1) ChartConfiguration
       │
       ├──── (1) ChartFilters
       │
       ├──── (1..n) ChartDataSeries
       │         │
       │         └──── (1..n) DataPoint
       │
       ├──── (1) AutoRefreshConfig
       │
       ├──── (1) ViewModeState
       │
       └──── (1) ChartLoadingState
```

**Relationship Descriptions**:

- **ChartComponent → ChartConfiguration**: One-to-one. Each chart has exactly one configuration.
- **ChartComponent → ChartFilters**: One-to-one. Each chart maintains its own filter state.
- **ChartComponent → ChartDataSeries**: One-to-many. A chart can display multiple data series (e.g., multi-line chart).
- **ChartDataSeries → DataPoint**: One-to-many. Each series contains an array of data points.
- **ChartComponent → AutoRefreshConfig**: One-to-one. Each chart has its own refresh configuration.
- **ChartComponent → ViewModeState**: One-to-one. Each chart tracks its viewing mode state.
- **ChartComponent → ChartLoadingState**: One-to-one. Each chart manages its loading/error state.

---

## Data Flow

### 1. Initial Chart Load

```
User opens page with chart
    ↓
ChartComponent initializes with default filters
    ↓
Fetch data from API with filters
    ↓
Transform API response to ChartDataSeries[]
    ↓
Generate eCharts option from ChartDataSeries
    ↓
Render chart with ReactECharts
```

### 2. Filter Change

```
User changes filter (e.g., time period 7D → 30D)
    ↓
Update ChartFilters state (optimistic)
    ↓
Debounce (300ms)
    ↓
Fetch data from API with new filters
    ↓
Update ChartDataSeries with new data
    ↓
Chart re-renders with new data
    ↓
Update URL params (for shareable links)
```

### 3. Auto-Refresh

```
30-second timer expires
    ↓
Check if tab is visible (Page Visibility API)
    ↓
Check if user is interacting (mouse/scroll events)
    ↓
If paused: skip refresh
    ↓
If active: fetch latest data
    ↓
Update ChartDataSeries (preserving filter state)
    ↓
Chart re-renders with fresh data
    ↓
Reset timer
```

### 4. Export

```
User clicks export button
    ↓
User selects format (PNG/SVG/CSV) or uses default (PNG)
    ↓
Generate filename from template
    ↓
If PNG/SVG: Call eCharts getDataURL()
    ↓
If CSV: Transform ChartDataSeries to CSV with metadata
    ↓
Trigger browser download
```

### 5. View Mode Change

```
User clicks fullscreen/mini-player button
    ↓
Update ViewModeState
    ↓
If fullscreen: Call Fullscreen API or show modal
    ↓
If mini-player: Render draggable popup (react-rnd)
    ↓
Chart re-renders in new container
    ↓
eCharts auto-resizes to new dimensions
```

---

## API Data Contracts

Charts consume data from REST API endpoints. Each endpoint returns pre-processed data matching the chart's requirements.

### Balance Trend API

```typescript
// GET /api/charts/balance?period=30D&tokens=BTC,ETH&aggregation=daily
interface BalanceTrendResponse {
  series: {
    name: string; // Token symbol or "Total"
    data: {
      timestamp: number; // Unix timestamp
      value: number; // Balance value
    }[];
  }[];
  metadata: {
    currency: string; // Display currency (USD)
    timezone: string; // Server timezone (UTC)
    aggregation: string; // Data granularity (hourly, daily)
  };
}
```

### Asset Distribution API

```typescript
// GET /api/charts/distribution?period=30D&wallets=wallet1,wallet2
interface AssetDistributionResponse {
  data: {
    name: string; // Token symbol
    value: number; // Token value in display currency
    percentage: number; // Percentage of total (calculated)
  }[];
  totalValue: number; // Total portfolio value
  metadata: {
    currency: string;
    timestamp: number; // Snapshot timestamp
  };
}
```

### Exchange Comparison API

```typescript
// GET /api/charts/exchanges?period=30D&type=all
interface ExchangeComparisonResponse {
  exchanges: {
    name: string; // Exchange name
    deposits: number; // Deposit count/value
    withdrawals: number; // Withdrawal count/value
  }[];
  metadata: {
    period: string; // Time period
    metric: "count" | "volume"; // What values represent
  };
}
```

### P&L Chart API

```typescript
// GET /api/charts/pnl?period=90D&aggregation=daily
interface PnLChartResponse {
  dailyPnL: {
    timestamp: number;
    value: number; // Daily P&L (positive or negative)
  }[];
  cumulativePnL: {
    timestamp: number;
    value: number; // Running total
  }[];
  metadata: {
    currency: string;
    startBalance: number;
    endBalance: number;
  };
}
```

---

## Type Definitions Location

```
client/src/types/
├── chart.types.ts           # Core chart types (ChartComponent, ChartConfiguration, etc.)
├── chart-data.types.ts      # Data types (DataPoint, ChartDataSeries, etc.)
├── chart-filters.types.ts   # Filter types (ChartFilters, TimePeriod, etc.)
└── chart-api.types.ts       # API response types
```

---

## Validation Schema (Zod)

```typescript
// client/src/types/chart.schema.ts
import { z } from "zod";

export const TimePeriodSchema = z.enum([
  "7D",
  "30D",
  "60D",
  "90D",
  "1Y",
  "All",
  "custom",
]);

export const ChartFiltersSchema = z
  .object({
    timePeriod: TimePeriodSchema,
    tokens: z.array(z.string()).min(1),
    transactionType: z.enum([
      "all",
      "trades",
      "transfers",
      "deposits",
      "withdrawals",
    ]),
    wallets: z.array(z.string()).optional(),
    customDateRange: z
      .object({
        start: z.date(),
        end: z.date(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.timePeriod === "custom") {
        return !!data.customDateRange;
      }
      return true;
    },
    { message: 'Custom date range required when timePeriod is "custom"' },
  );

export const DataPointSchema = z.union([
  z.object({
    timestamp: z.number().positive(),
    value: z.number().finite(),
    metadata: z.record(z.unknown()).optional(),
  }),
  z.object({
    category: z.string().min(1),
    value: z.number().finite(),
    metadata: z.record(z.unknown()).optional(),
  }),
  z.object({
    name: z.string().min(1),
    value: z.number().finite(),
    metadata: z.record(z.unknown()).optional(),
  }),
]);
```

---

## State Management Strategy

### Component-Level State (React useState/useReducer)

Each chart component manages its own:

- `filters: ChartFilters`
- `viewMode: ViewModeState`
- `loadingState: ChartLoadingState`
- `data: ChartDataSeries[]`

### Context-Level State (React Context)

For shared state across multiple charts on same page:

- `selectedTimezone: string` (affects all charts)
- `chartRegistry: Map<string, ChartComponent>` (for coordinated refreshes)

```typescript
// client/src/contexts/ChartContext.tsx
interface ChartContextValue {
  selectedTimezone: string;
  setTimezone: (tz: string) => void;
  registerChart: (chartId: string, refreshFn: () => Promise<void>) => void;
  unregisterChart: (chartId: string) => void;
  refreshAllCharts: () => Promise<void>;
}
```

### No Global State Required

Per constitution principle (Component Modularity), avoid Redux/Zustand unless complexity grows beyond React Context capabilities.

---

## Next Steps

1. ✅ Data model complete
2. ⏭️ **Next**: Generate API contracts in `/contracts/`
3. ⏭️ Generate quickstart.md
4. ⏭️ Update agent context
