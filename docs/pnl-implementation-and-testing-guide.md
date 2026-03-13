Here is the implementation and testing plan for the Backend Cumulative PnL historical data processing, tailored to the Yoca monorepo structure and your specific focus on dynamic calculation.
Implementation & Testing Plan: Historical Cumulative PnL
1. Objective

Transition the existing server/src/routes/charts/pnl.route.ts from mock data to a live, dynamic calculation of cumulative Profit and Loss. The system will derive PnL by comparing historical wallet balance snapshots against historical token prices.
2. Implementation Strategy
A. Domain Logic & Calculation

Instead of a dedicated PnL table, we will use a compute-on-demand model with caching at the dependency level (Balance & Price).

    Formula: Cumulative PnL(t)=Total Portfolio Value(t)−Cost Basis(t).

    Cost Basis Handling: For this phase, the "Cost Basis" is defined as the portfolio value at the start of the requested time window (e.g., T−7d), adjusted by net deposits/withdrawals if available.

    Data Orchestration:

        Fetch historical balances from server/src/services/wallet/db/walletDataRetriever.ts.

        Fetch historical prices from server/src/services/tokens/token-chart.ts.

        Map token addresses to CoinGecko IDs using the existing resolution logic in server/src/services/tokens/token-market-data.ts.

B. Backend Refactoring (server)

    Service Layer: Update server/src/services/wallet/walletData.service.ts to include a getCumulativePnL method.

        It should accept walletAddress, chain, and timeframe.

        It will perform a time-series join: for every timestamp in the balance history, find the matching price in the token history.

    Route Wiring: Update server/src/routes/charts/pnl.route.ts.

        Remove the generateMockPnlData helper.

        Inject the WalletDataService to fetch real data.

        Zod Schema: Maintain the existing contract but mark realizedPnL as z.optional() to defer complex trade-tracking logic.

    Performance: Utilize the existing TTL and update thresholds in the token/wallet caches to ensure dynamic calculations don't trigger redundant external API calls to Helius or CoinGecko.

3. Testing Plan
A. Unit & Logic Tests (Vitest)

    Calculation Accuracy: Create a test suite in server/tests/ that feeds a static balance history and a static price history into the PnL logic to verify the output matches expected (balance×price) deltas.

    Windowing: Verify that the "Initial Cost Basis" is correctly set to the first data point within the requested window (e.g., 24h, 7d).

    Missing Data Resilience: Test behavior when a token in the wallet has no historical price data—ensure it defaults to 0 or the last known price without crashing the entire series.

B. Integration & Route Tests

    Hono RPC Alignment: Run npm run test -w=server to ensure the new route return type still matches the AppType used by the client.

    Cache Utilization: Verify that subsequent calls for the same wallet PnL within the TTL window do not trigger new external provider requests.

    Empty Wallets: Ensure the route returns an empty series [] or a zero-baseline series rather than an error for new wallets with no history.

4. Success Criteria

    [ ] server/src/routes/charts/pnl.route.ts no longer contains "mock" or "random" logic.

    [ ] The client dashboard displays a PnL chart reflecting real historical price movements.

    [ ] realizedPnL is safely handled as an optional field without breaking the UI.