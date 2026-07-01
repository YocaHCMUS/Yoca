# Balance History Timezone & Tooltip Issues — Diagnosis Report

## Scope

This report analyzes two wallet balance chart issues:

1. Balance history timezone behavior
2. Balance chart tooltip behavior

It covers what happened, root causes, impacted files, and suggested solutions.

---

## 1) What happened

### A. Timezone issue (Balance History)

The Balance chart accepts timezone from the UI and forwards it to backend (`timezone` query), but the data pipeline itself is built on UTC day boundaries and raw timestamps, while display applies client-side timezone formatting.

As a result, users in non-UTC timezones can see day labels/tooltips shifted relative to expected “daily bucket” dates (especially around midnight boundaries), because data points are UTC-day snapshots but rendered as local wall-clock times.

### B. Tooltip issue (Balance History / Token mode)

The token-balance design intended token mode to show **both** token-unit and USD values together in tooltip (and dual-axis rendering). Current BalanceChart rendering path now only keeps USD series in displayed output and formats tooltip values as currency only.

As a result, tooltip content in token scenarios is incomplete/misleading versus intended behavior (missing token unit value context).

---

## 2) Root-cause diagnosis

### A. Root causes of timezone problem

1. **Backend accepts timezone but does not use it for bucket construction or timestamp normalization**
   - `server/src/routes/charts/balance.route.ts` parses `timezone` and only echoes it in metadata.
   - Series timestamps come from services without timezone-aware rebucketing.

2. **Balance services construct/consume UTC-based daily points**
   - `server/src/services/wallet/walletCharts.service.ts`: points come from provider timestamps (`Date.parse(...)`) and cache filtering in ms.
   - `server/src/services/wallet/walletTokenBalance.service.ts`: historical points generated via UTC day start (`Date.UTC(...)`, `toUtcDayStartMs`, `buildHistoricalDayStartMsList`).

3. **Client renders timestamps in selected timezone (display transform only)**
   - `client/src/components/charts/BalanceChart/BalanceChart.tsx`: x-axis and tooltip formatters use `formatTimestampWithTimezone(..., timezone, ...)`.

4. **Semantic mismatch**
   - Data semantics = UTC daily snapshots.
   - Display semantics = arbitrary selected timezone.
   - This creates perceived date drift in labels/tooltips for some timezones.

5. **“local” timezone sentinel increases inconsistency risk**
   - `client/src/components/charts/shared/TimezoneSelector.tsx` includes `local` option.
   - `client/src/util/chart-helpers.ts` timezone formatter expects IANA zone; invalid zone falls back to local formatting via catch block.
   - Context/doc says IANA timezone (`client/src/contexts/ChartContext.tsx`), so `local` is outside stated contract.

### B. Root causes of tooltip problem

1. **Design expectation and tests specified dual-series tooltip in token mode**
   - `docs/wallets/WALLET_TOKEN_BALANCE_HISTORY_IMPLEMENTATION_PLAN.md` explicitly requires tooltip showing both values together.
   - `docs/wallets/WALLET_TOKEN_BALANCE_HISTORY_TEST_PLAN.md` expects token+USD tooltip rows together.

2. **Current BalanceChart display pipeline drops token-unit series**
   - `client/src/components/charts/BalanceChart/BalanceChart.tsx` filters to USD for effective display paths (`unit !== 'TOKEN'` / `unit === 'USD'`).

3. **Tooltip formatter always applies currency formatting**
   - In `BalanceChart.tsx`, tooltip value formatter is `formatCurrency(point.value[1])` for all series.
   - No branch for token-unit formatting, and no pairing logic for token+USD row composition.

4. **Resulting UX regression**
   - Token context is lost in tooltip even when backend can provide token-unit series.

---

## 3) Why these likely appeared

Both issues are consistent with a refactor/regression pattern:

- Balance chart evolved toward a unified/filtered display flow optimized for wallet comparison and simplified series handling.
- During that evolution, timezone was kept as UI display control but not reconciled with UTC daily bucket semantics.
- Token mode rendering appears to have converged on USD-only visual output, while the original dual-series tooltip contract was not preserved.

---

## 4) Files involved

### Primary files (directly involved)

- `client/src/components/charts/BalanceChart/BalanceChart.tsx`
- `client/src/components/charts/shared/TimezoneSelector.tsx`
- `client/src/util/chart-helpers.ts`
- `client/src/contexts/ChartContext.tsx`
- `server/src/routes/charts/balance.route.ts`
- `server/src/services/wallet/walletCharts.service.ts`
- `server/src/services/wallet/walletTokenBalance.service.ts`

### Contract/expectation references

- `docs/wallets/WALLET_TOKEN_BALANCE_HISTORY_IMPLEMENTATION_PLAN.md`
- `docs/wallets/WALLET_TOKEN_BALANCE_HISTORY_TEST_PLAN.md`
- `docs/WALLET_PAGE_ENDPOINT_TRACE.md`

---

## 5) Suggested solution

### A. Timezone fix strategy

1. **Define one clear timestamp contract for daily data**
   - Prefer explicit contract: daily series timestamps represent UTC day bucket start (or end), not local bucket.

2. **Align display behavior to bucket semantics**
   - If data remains UTC-daily, format axis/tooltip as day-level UTC-safe labels for daily charts (or present timezone label explicitly).
   - Avoid converting daily bucket timestamps into local-time moments that appear as adjacent day.

3. **Handle timezone selection consistently**
   - Remove or normalize `local` sentinel to real IANA timezone before formatting and API query.
   - If backend keeps ignoring timezone for bucketing, document this clearly in metadata/contract.

4. **Optional stronger fix (if product requires local-day semantics)**
   - Rebucket daily points by selected timezone before response/render.
   - This is higher complexity and should be done with explicit product decision.

### B. Tooltip fix strategy

1. **Restore token-mode dual-series semantics in chart composition**
   - Keep both TOKEN and USD series for token mode display model (not USD-only filtering).

2. **Implement unit-aware tooltip rows**
   - TOKEN series row: numeric token amount with symbol/unit.
   - USD series row: currency formatting.
   - Ensure paired display for same timestamp (and wallet/token context).

3. **Preserve/restore design contract from plans**
   - Respect `seriesType` and `unit` metadata from backend.
   - Keep tooltip behavior aligned with documented token-balance requirements.

4. **Add regression tests around formatter behavior**
   - Validate timezone day-label behavior for UTC vs non-UTC selections.
   - Validate tooltip shows both token and USD rows in token mode.

---

## 6) Recommended implementation order

1. Finalize and document timestamp contract (UTC-day vs local-day).
2. Normalize timezone input handling (`local` -> IANA) and formatting behavior.
3. Restore token-mode series composition and unit-aware tooltip formatting.
4. Add focused tests for timezone label stability and tooltip completeness.
5. Verify wallet page chart behavior in single-wallet and multi-wallet token scenarios.

---

## 7) Risk notes

- Any timezone rebucketing change can affect cached series alignment and visual deltas.
- Tooltip and series-mode changes can affect legend/axis assumptions in current UI flow.
- Keep changes backward-compatible with current response shape (`seriesType`, `unit`, `metadata.mode`).
