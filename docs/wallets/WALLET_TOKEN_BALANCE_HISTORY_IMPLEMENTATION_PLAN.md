# Wallet Token Balance History Implementation Plan

## Goal
Implement a wallet service that returns historical balance data for one specific token, and integrate it with the existing balance chart flow used by the wallet page.

## Current Gaps
- The balance chart request already sends tokens from the client, but the backend currently treats tokens mainly as a display label.
- The current wallet balance history flow reconstructs total wallet value, not per-token balance history.
- The current Solana transaction-history fetch path is effectively constrained to short windows, while balance endpoint timePeriod supports longer ranges.
- Balance chart formatting assumes USD currency output; token-unit output needs formatting support.

## Design Decision
Reuse the existing endpoint path GET /api/charts/balance and extend behavior based on query parameters:
- wallets: required for real wallet data mode.
- tokens: optional.
- If one wallet + one token: return two parallel series for that token — balance in token units and balance in USD equivalent at each historical point.
- If one wallet + no token: keep existing total-balance (USD) behavior.
- If multiple wallets + one token: return two series per wallet (token-unit and USD), one wallet per group.
- If multiple wallets + multiple tokens: return the same two-series pair per wallet per token combination.
- Mock fallback and error fallback behavior remains unchanged.

This keeps client API usage stable and minimizes refactor risk. The dual-series approach also means the chart scales naturally as wallet count and token count grow, since each combination is always a pair of fixed-structure series.

## Backend Work Plan

### 1. Add token-specific history service
In walletData.service.ts, add a dedicated service function:
- Suggested name: getWalletTokenBalanceHistory
- Inputs:
  - address: string
  - chain: SupportedChain
  - tokenSelector: string
  - timePeriod: "7D" | "30D" | "60D" | "90D" | "1Y" | "All"
- Output: a dual-series result per token-wallet pair
  - tokenSeries: BalanceDataPoint[] — balance in token units at each point
  - usdSeries: BalanceDataPoint[] — balance in USD at each point using historical price
  - tokenSymbol: string
  - tokenAddress: string

Core logic:
- Resolve effective chain with existing chain resolver.
- Resolve token identity:
  - Prefer direct mint match.
  - Fallback to symbol match (case-insensitive).
  - Normalize SOL aliases to canonical SOL mint where needed.
- Build current token balance baseline from portfolio.
- Pull history data covering requested timePeriod.
- Filter transaction balanceChanges to selected token only.
- Reconstruct historical token-unit balance by reverse accumulation from current balance.
- For each daily data point, fetch historical token price using existing token market data services.
  - Use getTokenMarketData or its historical price equivalent to get a price at each timestamp.
  - Fallback to current price if historical price for a specific timestamp is unavailable.
- Compute USD series as tokenAmount * priceAtTimestamp for each point.
- Return flat zero series for both when token is not found or no history exists.

### 2. Align history-fetch depth with requested timePeriod
Refactor the transaction-history fetch path so getWalletBalanceHistory and getWalletTokenBalanceHistory can fetch enough data for:
- 7D
- 30D
- 60D
- 90D
- 1Y
- All

Implementation approach:
- Introduce a period-to-cutoff mapping helper.
- Update fetcher loop cutoff checks to stop only when older than requested range.
- Keep existing cursor pagination contract for Helius history requests.

### 3. Extend balance route behavior
Update balance.route.ts logic:
- Parse wallets into address list, tokens into token-selector list.
- No wallets: fall through to mock path.
- Wallets present + no tokens: call getWalletBalanceHistory per wallet (existing total-balance logic).
- Wallets present + one or more tokens: for each (wallet, token) pair, call getWalletTokenBalanceHistory and collect the dual-series output.
- Flatten all collected token-unit and USD series into a single series array:
  - Name convention: "<symbol> (units)" for token-unit series, "<symbol> (USD)" for USD series.
  - For multi-wallet, include wallet prefix: "<addr[:8]>... <symbol> (units)".
- Attach seriesType hints in metadata for each series so the client knows which to render as line vs. column.
- Keep mock fallback on error or missing wallet address.

### 4. Response metadata enrichment
Extend the balance response to carry per-series rendering instructions:
- In the series array, add a seriesType field per series: "line" | "bar".
- In the series array, add a unit field per series: "TOKEN" | "USD".
- In metadata, add:
  - mode: "total" | "token" to let the client branch rendering logic.
  - tokens: string[] of selected token symbols.
  - primaryYAxis: "TOKEN" | "USD" for dual-axis configuration hint.

This lets the client configure chart type, axis assignment, and formatter per series without hard-coded logic, and scales cleanly as more wallet/token combinations are added.

## Client Work Plan

### 1. Keep current API call shape
No endpoint change required in chartApi.ts if query remains:
- timePeriod
- tokens
- wallets
- timezone

### 2. Update chart response typing
In chart-api.types.ts:
- Add seriesType: "line" | "bar" and unit: "TOKEN" | "USD" to the per-series shape in BalanceTrendResponse.
- Add the metadata fields: mode, tokens, primaryYAxis.

### 3. Update BalanceChart rendering logic
In BalanceChart.tsx, when response metadata.mode is "token":
- Build a dual y-axis ECharts configuration:
  - Left y-axis (index 0): token-unit scale, numeric formatter with token symbol suffix.
  - Right y-axis (index 1): USD scale, formatCurrency formatter.
- Assign each series to its y-axis using index based on the unit field from the response.
- Render ECharts series type per seriesType field from response: "line" for token-unit, "bar" for USD.
- Apply area fill only to line series.
- Preserve tooltip: show both values together when both series are present (cross-named tooltip trigger).
- When metadata.mode is "total", keep existing single-axis line behavior.
- Legend remains automatic from series names.

### 4. Wallet page compatibility check
Current wallet page already passes tokens for token balance tab. Validate:
- One token selected case produces dual-series (line + column) output.
- No token selected case still produces single total-balance line.
- Multi-wallet token case produces line + column pair per wallet, each on shared axes.

## Validation and Acceptance Criteria
- API returns two series per (wallet, token) pair: one in token units, one in USD at historical prices.
- Token-unit series values are reconstructed deterministically from current balance and transaction history.
- USD series values reflect historical price at each data point, not just current price.
- timePeriod windows produce data with appropriate depth coverage.
- Multi-wallet token mode returns one pair of series per wallet.
- Scaling behavior: N wallets + M tokens = N×M series pairs.
- Existing total-balance chart usage (no token filter) remains functional.
- PnL logic depending on total getWalletBalanceHistory remains unaffected.
- Chart renders token-unit series as line and USD series as column on dual y-axes.

## Rollout Steps
1. Implement backend service + route changes.
2. Update shared types and BalanceChart format handling.
3. Add tests (unit + route behavior coverage).
4. Run server tests and build checks.
5. Run wallet-page manual verification for both tabs.
6. Merge after regression pass on balance and PnL charts.
