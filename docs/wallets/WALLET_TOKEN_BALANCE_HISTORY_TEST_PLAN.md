# Wallet Token Balance History Test Plan

## Scope
This plan covers updates for token-specific wallet balance history and related chart API/UI behavior.

Files and areas in scope:
- server/src/services/wallet/walletData.service.ts
- server/src/services/wallet/fetchers/walletDataFetcher.service.ts
- server/src/routes/charts/balance.route.ts
- client/src/types/chart-api.types.ts
- client/src/components/charts/BalanceChart/BalanceChart.tsx
- client/src/pages/wallet/index.tsx (integration verification)

## Objectives
- Verify correct reconstruction of historical token-unit balance series.
- Verify USD series is computed using historical token prices, not current price.
- Verify timePeriod windows fetch enough history data to cover requested range.
- Verify route produces two series per (wallet, token) pair in token mode.
- Verify N wallets × M tokens yields N×M series pairs with correct naming and metadata.
- Verify series metadata fields (seriesType, unit, mode) are present and accurate.
- Verify chart renders token-unit series as line and USD series as column on dual y-axes.
- Prevent regressions in existing total wallet balance chart behavior.

## Test Strategy
- Backend: unit tests with mocked network and dependencies.
- Route layer: handler-level behavior tests using mocked service calls.
- Frontend: if automated test harness exists, component/unit tests; otherwise structured manual verification.
- No real external API calls in automated tests.

## Backend Test Cases

### A. Fetcher-level tests
Target: walletDataFetcher.service.ts

1. Time-window cutoff honors requested range
- Arrange: mock paginated history where second page crosses cutoff boundary.
- Assert: fetch stops when entry timestamp is older than requested cutoff.

2. Pagination contract remains correct
- Arrange: mock pagination with nextCursor.
- Assert: second request uses before=nextCursor for history endpoint.

3. Null timestamps are skipped
- Arrange: include entries with null timestamp and valid entries.
- Assert: null-timestamp entries are ignored; valid entries continue processing.

4. Empty page terminates loop
- Arrange: mock data: [] response page.
- Assert: fetch exits cleanly without errors.

### B. Service-level tests
Target: walletData.service.ts (getWalletTokenBalanceHistory)

1. Token selector resolves by mint
- Input tokenSelector matches a mint address present in balanceChanges.
- Assert: only that mint's changes are used; other mints are excluded.

2. Token selector resolves by symbol (case-insensitive)
- Input tokenSelector: "sol" should match symbol "SOL".
- Assert: matching token data is used for reconstruction.

3. SOL alias normalization works
- Arrange: mixed SOL identifiers in balanceChanges.
- Assert: all SOL-related changes are aggregated under the canonical SOL mint.

4. Dual-series output structure
- Arrange: valid wallet with token history.
- Assert: returned object contains both tokenSeries and usdSeries arrays.
- Assert: both arrays have the same length and aligned timestamps.

5. Reverse reconstruction correctness (token units)
- Arrange: current token balance and known transaction deltas for that token.
- Assert: historical token-unit points match current minus cumulative forward deltas.

6. USD series uses historical price per point
- Arrange: token price changes across the time range (mock price service).
- Assert: each usdSeries value equals tokenAmount * priceAtThatTimestamp, not current price.
- Assert: falls back to current price when historical price is unavailable for a timestamp.

7. No matching token returns stable flat zero series
- Arrange: tokenSelector does not match any portfolio item or balanceChanges entry.
- Assert: tokenSeries and usdSeries both return valid flat zero arrays.
- Assert: function does not throw.

8. Time period coverage
- Run with 7D and 30D fixtures.
- Assert: returned points stay within [startDate, now] and include the end point.

9. Amount normalization correctness
- Arrange fixtures using amountRaw + decimals format as returned by Helius.
- Assert: normalized token amounts are consistent and not double-scaled.

### C. Route-level tests
Target: balance.route.ts

1. Single wallet + one token produces two series
- Query: wallets=addr1, tokens=SOL
- Assert: response series array contains exactly two entries.
- Assert: one series has unit=TOKEN and seriesType=line.
- Assert: one series has unit=USD and seriesType=bar.
- Assert: metadata.mode is "token".

2. Single wallet + no token uses total-balance path
- Query: wallets=addr1
- Assert: route calls total balance history service, not token history service.
- Assert: metadata.mode is "total".
- Assert: series array contains a single USD line series.

3. Multi-wallet + one token produces two series per wallet
- Query: wallets=addr1,addr2, tokens=SOL
- Assert: response series array contains four entries (two per wallet).
- Assert: names follow "<addr[:8]>... SOL (units)" and "<addr[:8]>... SOL (USD)" convention.
- Assert: metadata.mode is "token".

4. Multi-wallet + multi-token produces N×M series pairs
- Query: wallets=addr1,addr2, tokens=SOL,USDC
- Assert: response series array contains eight entries (2 wallets × 2 tokens × 2 series each).
- Assert: each token-wallet pair is represented by exactly one unit series and one USD series.

5. Response metadata fields are present in token mode
- Query: wallets=addr1, tokens=SOL
- Assert: metadata contains mode, tokens, and primaryYAxis fields.
- Assert: each series entry contains seriesType and unit fields.

6. No wallets falls through to mock path
- Query: no wallets param
- Assert: route returns mock-generated data without calling wallet service.

7. Error fallback behavior
- Arrange token history service to throw.
- Assert: route returns mock fallback payload without propagating the error.

## Client Test Cases

### A. Type and contract checks
Target: chart-api.types.ts and chartApi usage

1. Per-series seriesType and unit fields compile
- Assert: adding seriesType: "line" | "bar" and unit: "TOKEN" | "USD" to series shape produces no TypeScript errors.

2. Metadata extension fields compile
- Assert: mode, tokens, primaryYAxis fields in metadata are accepted by consuming components.

3. Existing callers remain compatible
- Assert: no TypeScript breakage for other chart consumers of fetchBalanceTrend that do not use the new fields.

### B. BalanceChart behavior
Target: BalanceChart.tsx

1. Total mode uses single-axis line rendering
- Response metadata.mode is "total".
- Assert: single y-axis with currency formatter is used.
- Assert: all series render as line type.

2. Token mode uses dual y-axis configuration
- Response metadata.mode is "token".
- Assert: left y-axis (index 0) uses numeric formatter with token symbol suffix.
- Assert: right y-axis (index 1) uses formatCurrency formatter.

3. Token-unit series renders as line
- Response contains series with seriesType=line and unit=TOKEN.
- Assert: ECharts series type is "line" for that series.
- Assert: series is assigned to y-axis index 0.

4. USD series renders as bar/column
- Response contains series with seriesType=bar and unit=USD.
- Assert: ECharts series type is "bar" for that series.
- Assert: series is assigned to y-axis index 1.

5. Tooltip shows both values when both series are present
- Response contains a token-unit + USD pair.
- Assert: tooltip renders numeric token amount and formatted USD value together.

6. Multi-wallet multi-token series names render correctly
- Response contains series with wallet-prefixed names.
- Assert: legend entries are generated from series names without truncation errors.

### C. Wallet page integration checks
Target: wallet/index.tsx with existing tabs

1. Balance History tab
- No token filter passed to BalanceChart.
- Assert: chart renders in total mode with single USD line.

2. Token Balance History tab
- tokens=["SOL"] passed to BalanceChart.
- Assert: chart request includes tokens=SOL query parameter.
- Assert: chart renders two series: SOL units as line, SOL USD value as column.
- Assert: dual y-axes are visible with correct labels.

## Regression Coverage
- PnL service behavior that depends on getWalletBalanceHistory should remain unchanged.
- Existing balance chart behavior on dashboard and wallet comparison pages should still render.

## Execution Commands
From workspace root:
- Server tests: npm run test -w=server
- Server build check: npm run build -w=server
- Client type/build check: npm run build -w=client

Optional:
- Server lint: npm run lint -w=server
- Client lint: npm run lint -w=client

## Exit Criteria
- All newly added backend tests pass.
- No regressions in existing server tests.
- Server and client builds pass without TypeScript errors.
- Manual verification confirms:
  - Total-balance tab renders single USD line.
  - Token-balance tab renders dual-series (line + column) with dual y-axes.
  - Multi-wallet comparison with a token filter produces one line+column pair per wallet.
  - PnL chart remains unaffected.
