# Rolling Annual Return — Update Plan

Date: 2026-03-27

Overview
- Align the client `RollingAnnualReturn` chart component with the current backend response for `/api/charts/rolling-annual-return`.
- Normalize the fetcher output in `client/src/services/chart/chartApi.ts` and add a UI control to switch between the available value types (total, realized, unrealized).

Goals / Acceptance criteria
- `fetchRollingAnnualReturn` returns a normalized, predictable shape the chart component consumes (multi-wallet and aggregated shapes supported).
- The chart UI supports selecting which metric to display: `total`, `realized`, or `unrealized`.
- Switching metric updates the chart immediately (client-side selection if backend returns all metrics; otherwise via API query param when supported).
- Types updated and minimal tests/manual verification provided.

Assumptions
- Backend returns either an aggregated object or an array of per-wallet objects. Per-wallet objects contain a `rollingAnnualReturns` field with sub-keys for the different metrics (the exact key names must be confirmed by inspecting the backend).
- Current client component expects timeseries arrays shaped as `Array<{ timestamp: number; value: number }>` for both rolling and cumulative series.

Deliverables
- `docs/ROLLING_ANNUAL_RETURN_UPDATE_PLAN.md` (this file)
- Updated `client/src/services/chart/chartApi.ts` to normalize the API response
- Updated `client/src/components/charts/RollingAnnualReturn/RollingAnnualReturn.tsx` to include a value-type selector and use the selected metric
- Optional: type updates in `client/src/types` and small unit test(s)

Detailed steps

# Rolling Profit & Loss (Period) — Update Plan

Date: 2026-03-27

Overview
- The backend chart service for `rolling-annual-return` does not provide historical timeseries. Instead it returns rolling profit & loss (P&L) metrics for a specified period (e.g. `totalUsd`, `realizedUsd`, `unrealizedUsd`).
- Update the client chart to adapt to this non-historical, period-based P&L response and rename the chart to reflect its new identity (suggested: `RollingProfitAndLoss` / "Rolling P&L").

Goals / Acceptance criteria
- `fetchRollingAnnualReturn` is updated to normalize the backend's period-based P&L shape and return a predictable structure the chart can consume.
- The chart component is renamed to reflect P&L behavior and renders an appropriate visualization for period-based P&L (per-wallet bars, stacked breakdown, and aggregated view).
- The UI supports selecting which metric to display: `total`, `realized`, or `unrealized` (and shows only available metrics returned by backend).
- Types and docs are updated; manual verification steps provided.

Assumptions
- Backend returns either a per-wallet array or an aggregated object where `rollingAnnualReturns` contains numeric metrics (not arrays of timestamps). Example per-wallet shape observed in the client fetcher currently: `{ wallet, rollingAnnualReturns: { totalUsd, realizedUsd, unrealizedUsd } }`.
- Because the data is period-summary (not historical), the chart should present comparative / aggregated metrics (bars or stacked bars), not a line-over-time visualization.

Deliverables
- Updated `client/src/services/chart/chartApi.ts` fetcher to normalize the P&L response and expose `availableValueTypes` metadata.
- Renamed chart component and files: `RollingAnnualReturn` -> `RollingProfitAndLoss` (component, folder, and related imports).
- Updated chart visualization: per-wallet bar or stacked-bar view with a `valueType` selector (`total` / `realized` / `unrealized`) and an aggregated summary mode.
- Type updates in `client/src/types` and updated docs JSDoc.
- Manual verification checklist and optional small unit test for the fetcher normalization.

Detailed steps

1) Confirm server response shape (completed)
- We inspected the route and service: backend returns period-based P&L metrics (numeric values) rather than timeseries data. We'll treat `rollingAnnualReturns.totalUsd`, `realizedUsd`, and `unrealizedUsd` as numeric metrics per wallet or aggregated.

2) Update `fetchRollingAnnualReturn` normalization
- Map the backend raw response into a client-friendly shape. Recommended normalized shape for per-wallet response:

  {
    wallets: [
      {
        walletAddress: string,
        metrics: {
          total: number,        // totalUsd
          realized: number,     // realizedUsd
          unrealized: number    // unrealizedUsd
        }
      }
    ],
    metadata: { timestamp: number, currency?: string, availableValueTypes: string[] }
  }

- For aggregated response, return:

  {
    metrics: { total: number, realized: number, unrealized: number },
    metadata: { timestamp: number, currency?: string, availableValueTypes: string[] }
  }

- Keep the fetcher defensive: handle missing keys and fall back to `0` for missing numbers. Include `availableValueTypes` based on keys present in the raw payload.

3) Rename and update the chart component
- Rename `client/src/components/charts/RollingAnnualReturn/RollingAnnualReturn.tsx` to `RollingProfitAndLoss` and update exported component name accordingly.
- Update the displayed title to reflect the period-based P&L (e.g., "Rolling P&L — Last 30D").

4) Replace timeseries rendering with appropriate P&L visualization
- Replace the timeseries dual-axis option with a comparative bar/stacked-bar chart per wallet.
- Behavior modes:
  - `Total` mode: show a single bar per wallet with the `total` metric.
  - `Breakdown` mode or `Realized`/`Unrealized` selection: show realized/unrealized as stacked bars (stack sum should equal total if provided).
  - Aggregated: show a summary bar or small table for the aggregated metrics when no per-wallet breakdown is requested.

5) Add `valueType` selector
- Add a compact selector to the chart controls with options derived from `metadata.availableValueTypes` (default to `total` if present).
- Selecting a value type updates the visualization immediately. Because payloads are small (single-period metrics), client-side selection is sufficient. If backend-side filtering is required later, we can add a query param.

6) Types, docs and small tests
- Add or update types in `client/src/types/chart-api.types.ts` (or similar) for the normalized P&L shapes.
- Update JSDoc and `docs/ROLLING_PROFIT_AND_LOSS_UPDATE.md` (optional) describing the new chart identity.
- Add a vitest for the fetcher normalization to cover per-wallet and aggregated raw shapes.

7) Manual verification
- Run the app, open the Rolling P&L chart.
- Verify per-wallet bars, stacked breakdown, aggregated view, and `valueType` switching.
- Confirm tooltips show currency and period context.

8) Commit and changelog
- Commit in focused commits (fetcher, component rename + chart changes, types/tests).
- Add a changelog/PR description noting the renaming and UI behavior change.

Notes / Potential pitfalls
- Confirm backend numeric keys (`totalUsd` / `realizedUsd` / `unrealizedUsd`) before mapping.
- If backend sometimes omits metrics, ensure UI gracefully disables unavailable options.
- Update other parts of the codebase that import `RollingAnnualReturn` to the new component name/path.

References (client files to update)
- `client/src/services/chart/chartApi.ts`
- `client/src/components/charts/RollingAnnualReturn/RollingAnnualReturn.tsx` -> rename to `client/src/components/charts/RollingProfitAndLoss/RollingProfitAndLoss.tsx`

Next action
- Update `fetchRollingAnnualReturn` in `client/src/services/chart/chartApi.ts` to normalize the period-based P&L response, and then update the chart component to render per-wallet P&L bars.

