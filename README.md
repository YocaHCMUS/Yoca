# Node + Vite + React + Hono Monorepo

Full-stack TypeScript monorepo with React frontend (Vite) and Hono backend.

Frontend:
- React 19
- TypeScript
- Vite 7
- React Router
- Carbon Design System

Backend:
- Hono 4
- Node.js
- TypeScript
- PostgreSQL + Drizzle ORM

## Quick Start

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:8000`.

## Wallet Mock Mode

Temporary wallet mock mode can unblock wallet-page development when live provider/API keys are exhausted.

Enable:

```bash
# client/.env.development
VITE_USE_WALLET_MOCKS=true
```

Disable:

```bash
# client/.env.development
VITE_USE_WALLET_MOCKS=false
```

When enabled, wallet and wallet-page chart reads are mocked at the API client boundary in `client/src/api/main.ts` via `client/src/api/walletMockRouter.ts`.

Mocked endpoints include:
- Wallet service calls in `client/src/services/wallet/walletApi.ts`:
   - `fetchWalletOverview`
   - `fetchWalletPortfolio`
   - `fetchWalletSwaps`
   - `fetchWalletTransfers`
   - `fetchWalletCounterparties`
   - `fetchWalletIntelligence`
   - `fetchWalletExchanges`
   - `fetchWalletIdentity`
- Wallet-page chart calls in `client/src/services/chart/chartApi.ts`:
   - `fetchBalanceTrend`
   - `fetchPnLChart`
   - `fetchAssetDistribution`
   - `fetchExchangeComparison`
   - `fetchCounterpartyActivity`

Known limitations:
- Mock timelines are deterministic but synthetic.
- Wallet identity/badges are scenario-driven and may not represent live provider classifications.
- Only wallet and wallet-page chart reads are mocked; other domains remain live.

## Getting Started

This monorepo makes use of npm's workspace feature. You don't need to `cd` into `client` or `server` to run these following commands as each of them has assigned to a specific workspace.


### Starting the Server
```bash
npm run server:dev
```
This starts server on `http://localhost:4000` in watch mode - any changes made to the server will trigger a restart automatically.

### Starting the Client
```bash
npm run client:dev
```
This starts the frontend Vite client on `http://localhost:3000` in Vite dev mode - any changes made will lead to a **H**ot **M**odule **R**eload (which is *not equivalent to a full restart*, but faster to itera/te)

### Inspecting the Database
```
npm run db:studio
```

This will open a GUI database dashboard at `http://local.drizzle.studio`. You can see our SQL database's table and schema here. 

## Building for Production
It is recommended that we build and preview our client and server every once in a while to guarantee our builds won't cause niche bugs when deployed.

To build both client and server run:

```bash
npm run build
```

Build files would be in `server\build` and `client\build` for server and client respectively. To preview both server's and client's builds at once use:

```bash
npm run preview
```

### Build for Server

Building server converts our Typescript code to normal Javascript code for Node to run.

```bash
npm run server:build
```

Use Node to run built server:

```bash
npm run server:preview
```

### Build for Client

Similiarly, building client converts our  React and Typescript code to static HTML and Javascript code.

```bash
npm run client:build
```

## Project Organization Tips

### Client Structure

Organize your React code in `client/src/`:

- `components/` - Reusable UI components
- `pages/` - Page components (routes)
- `layouts/` - Layout components
- `api/` - API client setup and type imports
- `util/` - Utility functions

### Server Structure

Organize your backend code in `server/src/`:

- `routes/` - Route handlers grouped by resource
- `middleware/` - Custom middleware
- `services/` - Business logic
- `models/` - Data models/schemas
- `utils/` - Utility functions

## Chart Components

This project includes a comprehensive set of interactive chart components built with ECharts:

### Available Chart Components

1. **BalanceChart** - Portfolio balance trends over time
   - Time series visualization with area fill
   - Supports multiple time periods (7D, 30D, 60D, 90D, 1Y, All)
   - Token filtering and auto-refresh
   - Location: `client/src/components/charts/BalanceChart/`

2. **AssetDistribution** - Asset allocation visualization
   - Donut chart with percentages
   - Total portfolio value at center
   - Interactive legend with toggle capability
   - Location: `client/src/components/charts/AssetDistribution/`

3. **PnLChart** - Profit and loss analysis
   - Dual-axis chart (daily bars + cumulative line)
   - Conditional coloring (green/red)
   - Time period and wallet filtering
   - Location: `client/src/components/charts/PnLChart/`

4. **ExchangeComparison** - Exchange activity comparison
   - Grouped bar chart
   - Deposits vs withdrawals
   - Count or volume metrics
   - Location: `client/src/components/charts/ExchangeComparison/`

5. **CounterpartyActivity** - Transaction analysis by counterparty
   - Grouped bar chart
   - Transaction count and volume
   - Top N filtering
   - Location: `client/src/components/charts/CounterpartyActivity/`

6. **VolumeBenchmark** - Multi-wallet volume comparison
   - Multi-series line or bar chart
   - Multiple wallet comparison
   - Time period filtering
   - Location: `client/src/components/charts/VolumeBenchmark/`

7. **TransactionDistribution** - Transaction activity patterns
   - Stacked or grouped bar chart
   - Wallet segmentation
   - Transaction type filtering
   - Location: `client/src/components/charts/TransactionDistribution/`

8. **HoldingDurations** - Token holding time analysis
   - Multi-chart layout (one per wallet)
   - Duration in days/weeks/months
   - Top N token filtering
   - Location: `client/src/components/charts/HoldingDurations/`

### Shared Features

All chart components support:
- **Export**: PNG, SVG, and CSV formats
- **Viewing Modes**: Fullscreen and mini-player
- **Auto-refresh**: Configurable refresh intervals
- **Loading States**: Skeleton, error, and empty states
- **Timezone Support**: Configurable timezone display
- **Responsive Design**: Mobile and desktop layouts
- **Accessibility**: ARIA labels and keyboard navigation

### Usage Example

```tsx
import { BalanceChart } from './components/charts/BalanceChart';
import { ChartProvider } from './contexts/ChartContext';

function Dashboard() {
  return (
    <ChartProvider>
      <BalanceChart
        title="Portfolio Balance"
        height={400}
        initialTimePeriod="30D"
        enableAutoRefresh={true}
      />
    </ChartProvider>
  );
}
```

### Custom Hooks

- `useChartFilters` - Debounced filter management
- `useAutoRefresh` - Auto-refresh with pause detection
- `useChartExport` - Export functionality (PNG/SVG/CSV)
- `useFullscreen` - Fullscreen and mini-player modes

For detailed API documentation, see the JSDoc comments in each component file.

## Troubleshooting

### Build fails with TypeScript errors

Make sure both workspaces are installed:

```bash
npm run client:preview
```