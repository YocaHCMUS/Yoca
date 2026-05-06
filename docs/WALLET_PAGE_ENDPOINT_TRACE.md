# Wallet Page Endpoint Trace (Overview + Comparison)

## Purpose
This document maps where wallet-related API endpoints are used for:
- Wallet overview page (`/wallets/:address`)
- Wallet comparison page (`/Comparison/wallets`)

It traces each flow from page/component -> client API caller -> server route -> backend service.

## 1) Page Routes

### Client routes
- `client/src/App.tsx`
  - `/wallets/:address` -> `WalletPage`
  - `/Comparison/wallets` -> `WalletsComparisonPage`

### Server API mount points
- `server/src/main.ts`
  - Wallet APIs mounted at `/api/wallets`
  - Chart APIs mounted at `/api/charts/*`

## 2) Wallet Overview Page Endpoint Flow

### Entry components
- `client/src/pages/wallet/index.tsx`
  - Renders `WalletOverview`
  - Loads portfolio/swaps/transfers/counterparties for tables
  - Renders `BalanceChart` and `PnLChart`
- `client/src/components/wallet/WalletOverview/WalletOverview.tsx`
  - Loads overview and intelligence data
  - Compare button navigates to `/Comparison/wallets?wallets=<address>`

### Endpoints used by wallet overview page

1. Overview card metrics
- Client caller:
  - `fetchWalletOverview(address, chain, period)` in `client/src/services/wallet/walletApi.ts`
- HTTP endpoint:
  - `GET /api/wallets/overview`
- Server route:
  - `router.get("/overview", ...)` in `server/src/routes/wallets.route.ts`
- Backend service:
  - `getWalletOverview(...)` in `server/src/services/wallet/walletData.service.ts`
- Notes:
  - `period` is normalized to the safe range (24h to 7d) in route parsing.

2. Identity/intelligence on overview header
- Client caller:
  - `fetchWalletIntelligence(address, chain)` in `client/src/services/wallet/walletApi.ts`
- HTTP endpoint:
  - `GET /api/wallets/intelligence`
- Server route:
  - `router.get("/intelligence", ...)` in `server/src/routes/wallets.route.ts`
- Backend service:
  - `composeWalletIntelligence(...)` in `server/src/services/wallet/walletIntelligence.service.ts`
  - Uses `getWalletOverview(...)` and `getWalletExchangeCounts(...)` internally.

3. Portfolio table data
- Client caller:
  - `fetchWalletPortfolio(address, chain)` in `client/src/services/wallet/walletApi.ts`
- HTTP endpoint:
  - `GET /api/wallets/portfolio`
- Server route:
  - `router.get("/portfolio", ...)` in `server/src/routes/wallets.route.ts`
- Backend service:
  - `getWalletPortfolio(...)` in `server/src/services/wallet/walletData.service.ts`

4. Swaps table data
- Client caller:
  - `fetchWalletSwaps(address, { chain, limit })` in `client/src/services/wallet/walletApi.ts`
- HTTP endpoint:
  - `GET /api/wallets/swap`
- Server route:
  - `router.get("/swap", ...)` in `server/src/routes/wallets.route.ts`
- Backend service:
  - `getWalletSwaps(...)` in `server/src/services/wallet/walletData.service.ts`

5. Transfers table data
- Client caller:
  - `fetchWalletTransfers(address, { chain, limit })` in `client/src/services/wallet/walletApi.ts`
- HTTP endpoint:
  - `GET /api/wallets/transfers`
- Server route:
  - `router.get("/transfers", ...)` in `server/src/routes/wallets.route.ts`
- Backend service:
  - `getWalletTransfers(...)` in `server/src/services/wallet/walletData.service.ts`

6. Counterparties table data
- Client caller:
  - `fetchWalletCounterparties(address, { chain, period, limit, includeTokens })` in `client/src/services/wallet/walletApi.ts`
- HTTP endpoint:
  - `GET /api/wallets/counterparties`
- Server route:
  - `router.get("/counterparties", ...)` in `server/src/routes/wallets.route.ts`
- Backend service:
  - `getWalletCounterparties(...)` in `server/src/services/wallet/counterparties.service.ts`

7. Balance history chart in wallet page
- Client chart component:
  - `BalanceChart` in `client/src/components/charts/BalanceChart/BalanceChart.tsx`
- Client caller:
  - `fetchBalanceTrend(...)` in `client/src/services/chart/chartApi.ts`
- HTTP endpoint:
  - `GET /api/charts/balance`
- Server route:
  - `app.get("/", ...)` in `server/src/routes/charts/balance.route.ts`
- Backend service:
  - `getWalletBalanceHistory(...)`
  - `getWalletTokenBalanceHistory(...)`
  - Both in `server/src/services/wallet/walletData.service.ts`

8. PnL chart in wallet page
- Client chart component:
  - `PnLChart` in `client/src/components/charts/PnLChart/PnLChart.tsx`
- Client caller:
  - `fetchPnLChart(...)` in `client/src/services/chart/chartApi.ts`
- HTTP endpoint:
  - `GET /api/charts/pnl`
- Server route:
  - `app.get("/", ...)` in `server/src/routes/charts/pnl.route.ts`
- Backend service:
  - `getHistoricalPnLData(...)` in `server/src/services/charts/pnlChart.service.ts`
  - Uses `getCumulativePnL(...)` from `server/src/services/wallet/walletData.service.ts`

## 3) Wallet Comparison Page Endpoint Flow

### Entry components
- `client/src/pages/walletsComparison/index.tsx`
  - Reads `?wallets=` query param and sets `selectedWallets`
  - Renders tabs:
    - `GeneralTab`
    - `HoldingTab`
    - `RiskTab`

### Comparison page endpoints by tab

### GeneralTab (`client/src/components/wallet/WalletComparison/GeneralTab.tsx`)
1. Balance comparison chart
- Endpoint: `GET /api/charts/balance`
- Client caller: `fetchBalanceTrend(...)`
- Route file: `server/src/routes/charts/balance.route.ts`

2. Daily trading volume chart
- Endpoint: `GET /api/charts/dailyTradingVolume`
- Client caller: `fetchDailyTradingVolume(...)`
- Route file: `server/src/routes/charts/daily-trading-volume.route.ts`
- Backend service: `getDailyTradingVolumeFromDb(...)` in `server/src/services/charts/dailyTradingVolume.service.ts`

3. Total trading volume chart
- Endpoint: `GET /api/charts/totalTradingVolume`
- Client caller: `fetchTotalTradingVolume(...)`
- Route file: `server/src/routes/charts/total-trading-volume.route.ts`
- Backend service: `getTotalTradingVolumeFromDb(...)` in `server/src/services/charts/totalTradingVolume.service.ts`

4. Trading volume distribution chart
- Endpoint: `GET /api/charts/tradingVolumeDistribution`
- Client caller: `fetchTradingVolumeDistribution(...)`
- Route file: `server/src/routes/charts/trading-volume-distribution.route.ts`
- Current backend source: mock generator (`generateTradingVolumeDistribution`)

5. Trading volume per transaction chart
- Endpoint: `GET /api/charts/tradingVolumePerTransaction`
- Client caller: `fetchTradingVolumePerTransaction(...)`
- Route file: `server/src/routes/charts/trading-volume-per-transaction.route.ts`
- Current backend source: mock generator (`generateTradingVolumePerTransaction`)

### HoldingTab (`client/src/components/wallet/WalletComparison/HoldingTab.tsx`)
1. Asset distribution chart
- Endpoint: `GET /api/charts/distribution`
- Client caller: `fetchAssetDistribution(...)`
- Route file: `server/src/routes/charts/distribution.route.ts`
- Backend behavior:
  - Single wallet can use real `getWalletPortfolio(...)`
  - Multi-wallet currently falls back to mock generator

2. Stablecoin ratio chart
- Endpoint: `GET /api/charts/stablecoinRatio`
- Client caller: `fetchStablecoinRatio(...)`
- Route file: `server/src/routes/charts/stablecoin-ratio.route.ts`
- Current backend source: mock generator (`generateStablecoinRatioData`)

3. Holding durations chart
- Endpoint: `GET /api/charts/holdings`
- Client caller: `fetchHoldingDurations(...)`
- Route file: `server/src/routes/charts/holdings.route.ts`
- Current backend source: mock generator (`generateHoldingDurations`)
- Param detail:
  - Route expects `walletIds`
  - `HoldingDurations` component sends `walletIds` query key (mapped correctly inside component query)

### RiskTab (`client/src/components/wallet/WalletComparison/RiskTab.tsx`)
1. Rolling annual return
- Endpoint: `GET /api/charts/rollingAnnualReturn`
- Client caller: `fetchRollingAnnualReturn(...)`
- Route file: `server/src/routes/charts/rolling-annual-return.route.ts`
- Current backend source: mock generator (`generateRollingAnnualReturn`)

2. Average rolling annual return
- Endpoint: `GET /api/charts/averageRollingAnnualReturn`
- Client caller: `fetchAverageRollingAnnualReturn(...)`
- Route file: `server/src/routes/charts/average-rolling-annual-return.route.ts`
- Current backend source: mock generator (`generateAverageRollingAnnualReturn`)

3. PnL chart
- Endpoint: `GET /api/charts/pnl`
- Client caller: `fetchPnLChart(...)`
- Route file: `server/src/routes/charts/pnl.route.ts`
- Backend service: `getHistoricalPnLData(...)` (real service path)

4. Winrate chart
- Endpoint: `GET /api/charts/winrate`
- Client caller: `fetchWinrate(...)`
- Route file: `server/src/routes/charts/winrate.route.ts`
- Current backend source: mock generator (`generateWinrateData`)

5. Drawdown chart
- Endpoint: `GET /api/charts/drawdown`
- Client caller: `fetchDrawdown(...)`
- Route file: `server/src/routes/charts/drawdown.route.ts`
- Current backend source: mock generator (`generateDrawdownData`)

## 4) Quick Summary
- Wallet overview page (`/wallets/:address`) is connected to real wallet routes for overview/portfolio/transfers/swaps/counterparties/intelligence, plus chart routes for balance and PnL.
- Wallet comparison page (`/Comparison/wallets`) is chart-route heavy; some charts are real DB/service-backed, while several comparison analytics routes still return mock-generated datasets.

## 5) Backend Schema (Wallet Page)

This section is extracted from backend route Zod schemas and DTO interfaces.

### 5.1 Wallet routes (`/api/wallets/*`)

#### `GET /api/wallets/overview`
- Query schema (`walletOverviewRequestSchema`):
  - `address: string` (required)
  - `chain?: string`
  - `period?: string` (route normalizes to `24h` default, bounded to `24h..7d`)
- Response schema (`WalletOverview`):
  - `address: string`
  - `chain: SupportedChain`
  - `totalAssetValueUsd: number`
  - `tradingVolumeUsd24h: number | null`
  - `pnlUsdTotal: number | null`
  - `transactionCount24h: number | null`
  - `tokensTradedCount: number | null`
  - `tokensHoldingCount: number`
  - `tradingVolumeUsdWindow?: number | null`
  - `pnlUsdWindow?: number | null`
  - `metricsPeriod?: string`

#### `GET /api/wallets/portfolio`
- Query schema (`walletRequestSchema`):
  - `address: string` (required)
  - `chain?: string`
- Response schema (`WalletPortfolioItem[]`):
  - `tokenAddress: string`
  - `symbol: string`
  - `name?: string`
  - `amount: number`
  - `priceUsd?: number`
  - `valueUsd: number`
  - `change24hPercent?: number`

#### `GET /api/wallets/transfers`
- Query schema (route-level parse + options):
  - `address: string` (required)
  - `chain?: string`
  - `limit?: string` (parsed to number)
  - `cursor?: string`
  - `before?: string`
- Response schema (`WalletTransfersResponse`):
  - `address: string`
  - `chain: SupportedChain`
  - `transfers: WalletTransfer[]`
    - `from: string`
    - `to: string`
    - `amount: number`
    - `timestamp: string`
    - `tokenAddress: string`
    - `tokenSymbol: string`
    - `transactionSignature: string`
    - `instructionIndex: number`

#### `GET /api/wallets/swap`
- Query schema (route-level parse + options):
  - `address: string` (required)
  - `chain?: string`
  - `limit?: string` (parsed to number)
  - `cursor?: string`
  - `before?: string`
- Response schema:
  - `{ address: string; chain: SupportedChain; swaps: WalletSwap[] }`
  - `WalletSwap`:
    - `walletAddress: string`
    - `signature: string`
    - `timestamp: string`
    - `slot: number`
    - `fee: number`
    - `feePayer: string`
    - `balanceChanges: WalletSwapBalanceChange[]`
    - `feeChanges: WalletSwapBalanceChange[]`
  - `WalletSwapBalanceChange`:
    - `mint: string`
    - `amount: number`
    - `decimals: number`

#### `GET /api/wallets/counterparties`
- Query schema (`walletCounterpartyRequestSchema`):
  - `address: string` (required)
  - `chain?: string`
  - `period?: string` (normalized to `"24h" | "7d"`)
  - `limit?: string` (clamped to `1..100`)
  - `includeTokens?: string` (`false|0` -> false, otherwise true)
- Response schema (`WalletCounterpartiesResponse`):
  - `counterparties: WalletCounterpartyRow[]`
    - `address: string`
    - `identity: { status: "known" | "unknown" | "unavailable"; name: string | null; category: string | null; type: string | null }`
    - `uniqueTokenCount: number`
    - `tokens: string[]`
    - `transactionCount: number`
    - `totalVolumeUsd: number`
  - `rankings: { byTransactionCount: WalletCounterpartyRankingItem[]; byVolume: WalletCounterpartyRankingItem[] }`
    - `WalletCounterpartyRankingItem`: `{ address: string; label: string; transactionCount: number; totalVolumeUsd: number }`
  - `metadata: { period: "24h" | "7d"; chain: SupportedChain; source: "cache" | "provider" | "mixed"; totals: { counterparties: number; transactions: number; volume: number } }`

#### `GET /api/wallets/intelligence`
- Query schema (route parse):
  - `address: string` (required)
  - `chain?: string`
- Response schema (`WalletIntelligenceResponse`):
  - `address: string`
  - `chain: SupportedChain`
  - `identity: WalletIdentityNormalized`
    - `status: "known" | "unknown" | "unavailable"`
    - `type: string | null`
    - `name: string | null`
    - `category: string | null`
    - `tags: string[]`
    - `domainNames: string[]`
    - `provider: "helius"`
    - `providerVersion: "wallet-api-beta"`
    - `resolvedAt: string`
  - `analysis: { riskScore: number; riskLevel: "low" | "medium" | "high"; signals: string[]; counterpartyProfile: { exchangeInteractions24h: number; uniqueKnownEntities7d: number }; userTags?: string[] }`
  - `metadata: { cache: { identityHit: boolean; analysisHit: boolean; ttlSec: number; staleIdentity: boolean }; provider: { statusCode?: number; errorCode?: string } }`

### 5.2 Wallet tags route used by WalletOverview (`/api/walletTags`)

#### `GET /api/walletTags?address=...`
- Auth: JWT cookie required
- Query schema:
  - `address: string` (required, checked in route)
- Response schema:
  - `{ tags: string[] }`

#### `PUT /api/walletTags`
- Auth: JWT cookie required
- Body schema (`saveTagsSchema`):
  - `address: string` (min length 1)
  - `tags: string[]` (max 50 items, each trimmed, length `1..30`)
- Response schema:
  - `{ message: "Tags saved successfully" }`

### 5.3 Chart route schemas used by wallet page/comparison

#### `GET /api/charts/balance`
- Query schema (`balanceRequestSchema`):
  - `timePeriod?: "7D" | "30D" | "60D" | "90D" | "1Y" | "All"` (default `"30D"`)
  - `tokens?: string` (comma-separated)
  - `wallets?: string` (comma-separated)
  - `timezone?: string` (default `"UTC"`)
- Response shape (wallet mode):
  - `{ series: Array<{ name: string; data: Array<{ timestamp: number; value: number }>; seriesType: "line" | "bar"; unit: "USD" | "TOKEN" }>; wallets?: string[]; metadata: { timePeriod: string; aggregation: string; dataPoints: number; currency: "USD"; timezone: string; mode: "total" | "token"; tokens: string[]; primaryYAxis: "USD" | "TOKEN" } }`
- Fallback behavior:
  - On internal error in wallet path, route falls back to mock output from `generateBalanceTrend(...)`.

#### `GET /api/charts/pnl`
- Query schema (`pnlRequestSchema`):
  - `period?: "7D" | "30D" | "60D" | "90D" | "1Y" | "All"` (default `"30D"`)
  - `wallets?: string` (transformed to `string[]`)
  - `aggregation?: "daily" | "weekly" | "monthly"` (default `"daily"`)
- Response schema (`HistoricalPnLResponse`):
  - Single wallet:
    - `{ dailyPnL: PnLDataPoint[]; cumulativePnL: PnLDataPoint[]; realizedPnL?: number; metadata: { currency: "USD"; startBalance: number; endBalance: number } }`
  - Multi-wallet:
    - `{ wallets: Array<{ walletAddress: string; walletName: string; dailyPnL: PnLDataPoint[]; cumulativePnL: PnLDataPoint[]; startBalance: number; endBalance: number; realizedPnL?: number }>; metadata: { currency: "USD" } }`

#### `GET /api/charts/dailyTradingVolume`
- Query schema (`dailyTradingVolumeRequestSchema`):
  - `period?: "7D" | "30D" | "60D" | "90D" | "1Y" | "All"` (default `"30D"`)
  - `wallets?: string` (comma-separated, transformed to `string[]`)
- Response schema (`DailyTradingVolumeResponse`):
  - `{ dates: string[]; wallets: Array<{ walletAddress: string; walletName: string; volumes: number[] }>; metadata: { period: string; currency: string } }`

#### `GET /api/charts/totalTradingVolume`
- Query schema (`totalTradingVolumeRequestSchema`):
  - `period?: "7D" | "30D" | "60D" | "90D" | "1Y" | "All"` (default `"30D"`)
  - `wallets?: string` (comma-separated, transformed to `string[]`)
- Response schema (`TotalTradingVolumeResponse`):
  - `{ wallets: Array<{ walletAddress: string; walletName: string; totalVolume: number; depositVolume: number; withdrawalVolume: number; tradeCount: number; rank: number }>; metadata: { period: string; timestamp: number; currency: string } }`
