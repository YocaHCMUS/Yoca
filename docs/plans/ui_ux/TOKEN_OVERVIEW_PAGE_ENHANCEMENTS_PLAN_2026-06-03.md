# Token Overview Page Enhancements Plan

Date: 2026-06-03
Last Updated: 2026-06-03 *(revised — file actions corrected)*

## 1. Goal Description

Enhance the Token Overview page with three focused features to improve data presentation quality and UX:

1. **Token/USD Chart with Line/Candle Toggle** — Add a chart series-type toggle to the existing token chart so users can switch between a smooth area line view and a candlestick (OHLCV) view without unmounting the chart canvas.
2. **Token Holder USD Value Display** — In the top-holders table, add a secondary line below each holder's raw token amount showing the equivalent USD value (`holderAmount × currentTokenPriceUsd`).
3. **Wallet Identity Resolution (`<WalletLabel />`)** — Replace raw Base58 addresses in the holders table with a resolved human-readable identity: first try a `.sol` domain (via `@bonfida/spl-name-service` or a placeholder async resolver), then fall back to a local "known labels" dictionary (e.g. exchange wallets), then truncate to `addr[0..4]...addr[-4..]`.

---

## 2. User Review Required

> [!IMPORTANT]
> **Chart library choice:** The codebase currently uses **ECharts** (`echarts` + `echarts-for-react`) for all charts — **not** `lightweight-charts` (TradingView). The existing `CandleStickChart` component is also ECharts-based. The plan below therefore implements the toggle using ECharts series swapping (`setOption`) instead of `lightweight-charts`. Please confirm if you want to keep ECharts or introduce `lightweight-charts` as an additional dependency.

> [!IMPORTANT]
> **`@bonfida/spl-name-service` not installed:** This package is not in `client/package.json`. The plan provisions a **placeholder async resolver** (`resolveSOLDomain`) with the same API contract so the hook compiles immediately; the real `@bonfida/spl-name-service` call can be dropped in later without changing the hook's interface. Confirm if you want to install the real library now.

> [!NOTE]
> **OHLCV data source:** The existing `TokenOverviewChart` fetches `[timestamp, price, marketCap]` line data. Candlestick rendering requires OHLCV (`open, high, low, close, volume`) data. This plan adds a **separate `useCandleData` hook** that fetches from whatever OHLCV endpoint exists (or mock data as a first pass). The new `TokenChart.tsx` accepts both datasets as props.

---

## 3. Proposed Changes

### Component: TokenChart (OHLCV / Line toggle)

#### [MODIFY] `client/src/components/token/TokenChart.tsx`

> **File already exists** (currently a thin wrapper around `<GeckoTerminalChart>`).

Rewrite the body of this existing file to become a full ECharts-powered chart component:
- Accepts `lineData: [number, number][]` (timestamp, price) and `ohlcvData: OHLCData[]` as props.
- Holds a `chartType: 'line' | 'candle'` state via `useState`.
- Uses a single `ReactECharts` instance; on toggle calls `chartRef.current.getEchartsInstance().setOption(newOption, { replaceMerge: ['series'] })` — canvas never unmounts.
- Toggle UI: two-button pill reusing the existing `FilterSwitch` component (already in `TokenOverviewChart.tsx`).
- Color theming from `useChartTheme()` (already used in `CandleStickChart`).
- **Line mode:** `type: 'line'`, area gradient (pattern from `TokenOverviewChart`).
- **Candle mode:** `type: 'candlestick'` + MA5/MA10 overlays using `calculateMA` from `util/finance-helpers.js`.

#### [MODIFY] `client/src/components/token/TokenChart.module.scss`

> **File already exists** — keep `.container`, `.header`, `.loading`; add:
- `.toggleGroup` / `.toggleBtn` / `.toggleBtnActive` — two-button pill styles.
- `.chartWrapper` — height + relative positioning for ECharts.

---

### Component: TokenHoldersTable (USD value column)

#### [MODIFY] `client/src/components/token/TopHoldersTable.tsx`

> **File already exists** — add props, keep all existing headers/rows logic.

- **New prop:** `currentTokenPriceUsd?: number` (defaults `0`, non-breaking).
- **New prop:** `tokenSymbol?: string`.
- **New prop:** `holderAmounts?: Record<string, number>` — map of `holderAddress → rawAmount`. *(API currently only returns `percentage`; raw amount comes from a new field or is derived via `totalSupply × percentage / 100` if available.)*
- Insert an `amount` column between `rank` and `address` rendering:
  ```tsx
  <div>
    <span className={styles.amountPrimary}>
      {amount.toLocaleString()} {tokenSymbol}
    </span>
    <span className={styles.amountUsd}>
      ≈ {fmt.num.compact.currency(amount * currentTokenPriceUsd)}
    </span>
  </div>
  ```

#### [MODIFY] `client/src/components/token/TopHoldersTable.module.scss`

> **File already exists** — keep all Carbon table overrides; add:
- `.amountPrimary` — `font-weight: 600`, normal size.
- `.amountUsd` — `font-size: 11px`, `color: $text-helper`, `display: block`.

---

### Feature: Wallet Identity Resolution

#### [NEW] `client/src/hooks/useWalletIdentity.ts`

> **Truly new file.** However it **reuses existing infrastructure**:
> - `useWalletLabels()` from `@/hooks/profile/useWalletLabels` — already fetches user-saved labels from the API via SWR.
> - `getWalletLabel(labelMap, address)` from `@/components/profile/shared/walletLabels` — utility already written.

Hook signature:
```ts
export function useWalletIdentity(address: string): {
  label: string;
  isSolDomain: boolean;
  isLoading: boolean;
};
```

Resolution order (in the hook):
1. **`.sol` domain:** Async placeholder `resolveSOLDomain(address): Promise<string | null>` — returns `null` until `@bonfida/spl-name-service` is installed.
2. **User's saved labels:** `getWalletLabel(labels, address)` from `useWalletLabels()` — already backed by the profile API.
3. **Known exchange dict:** `KNOWN_WALLET_LABELS: Record<string, string>` constant (Binance, Kraken hot-wallets, etc.) hardcoded in the hook file.
4. **Fallback truncation:** `address.slice(0, 4) + '...' + address.slice(-4)`.

#### [NEW] `client/src/components/token/WalletLabel.tsx`

> **Truly new file.** Pattern follows `TokenIdentityCell.tsx` (existing component in the same folder that also shows identity in a small cell).

```tsx
<WalletLabel address={holder.holderAddress} />
```

Renders:
- **Loading skeleton:** shimmer span (~120px wide).
- **`.sol` domain:** text in `$link-primary` color + Carbon `Checkmark` icon badge.
- **Known/saved label:** default text + subtle `Tag` badge (Carbon `Tag` already in the project).
- **Truncated fallback:** monospace, `$text-helper` color.
- **Copy button:** Carbon `Copy` icon (already imported in `TopHolders.tsx`); on click → clipboard + brief `CheckmarkFilled` flash.

#### [MODIFY] `client/src/components/token/WalletLabel.module.scss` → actually `[NEW]`

> This SCSS module does **not** exist yet — it will be created alongside `WalletLabel.tsx`.
- `.wrapper` — `display: flex; align-items: center; gap: 6px`.
- `.skeleton` — shimmer keyframe (`@keyframes shimmer`).
- `.solDomain` — `color: $link-primary; font-weight: 500`.
- `.copyBtn` — icon-only button, transparent background, hover fade.
- `.copied` — brief `$support-success` color flash.

#### [MODIFY] `client/src/components/token/TopHolders.tsx`

> **File already exists** — surgical change:
- Import `<WalletLabel>`.
- Replace `{fmt.text.address(holder.holderAddress)}` + `<Copy>` div with `<WalletLabel address={holder.holderAddress} />`.
- Remove now-redundant local `copyToClipboard` function.

#### [MODIFY] `client/src/components/token/TopHoldersTable.tsx`

> **File already exists** — surgical change:
- Import `<WalletLabel>`.
- Replace `<Link href={SOLSCAN_ACCOUNT_URL}/>{fmt.text.address(...)}</Link>` with `<WalletLabel address={holder.holderAddress} />`.

---

### Shared Utility check

#### [VERIFY — no edit if already correct] `client/src/util/finance-helpers.js`
- Confirm `OHLCData` type and `calculateMA` are exported — `TokenChart.tsx` imports them.
- `formatTokenAmount` is NOT needed separately; `Intl.NumberFormat` used inline.

---

## 4. Files Summary

| Action     | File                                                              | Reason |
|------------|-------------------------------------------------------------------|--------|
| `[MODIFY]` | `client/src/components/token/TokenChart.tsx`                      | Exists — rewrite body only |
| `[MODIFY]` | `client/src/components/token/TokenChart.module.scss`              | Exists — add toggle + chart wrapper styles |
| `[MODIFY]` | `client/src/components/token/TopHoldersTable.tsx`                 | Exists — add USD amount column |
| `[MODIFY]` | `client/src/components/token/TopHoldersTable.module.scss`         | Exists — add `.amountPrimary` / `.amountUsd` |
| `[MODIFY]` | `client/src/components/token/TopHolders.tsx`                      | Exists — swap address cell → `<WalletLabel>` |
| `[NEW]`    | `client/src/components/token/WalletLabel.tsx`                     | New component |
| `[NEW]`    | `client/src/components/token/WalletLabel.module.scss`             | New styles for WalletLabel |
| `[NEW]`    | `client/src/hooks/useWalletIdentity.ts`                           | New hook — reuses `useWalletLabels` + `walletLabels.ts` |

---

## 5. Verification Plan

### Automated Tests
- Run `npm run typecheck` inside `client/` — no new TypeScript errors.
- Run `npm run lint` — no ESLint regressions.

### Manual Verification

#### Task 1 — Chart Toggle
- Open any token page that has pool/OHLCV data.
- Verify "Line" mode renders the smooth gradient area chart.
- Click "Candle" — verify the candlestick bars appear **without** the chart container flickering or unmounting (check DevTools → Elements, the `<canvas>` element DOM node should be the same one).
- Click "Line" again — verify smooth reversion.

#### Task 2 — USD Value in Holders Table
- Open a token detail page with top holders data.
- Verify the "Amount" column shows e.g. `1,500,000 TOKEN` on the first line and `≈ $45,000.00` in muted text below it.
- Verify `currentTokenPriceUsd = 0` or missing doesn't crash — shows `≈ $0.00`.

#### Task 3 — Wallet Identity
- Confirm addresses show the loading skeleton immediately on render.
- After resolving, known exchange addresses show their label.
- Unknown addresses show the `xxxx...xxxx` truncated form.
- The copy button writes the full address to clipboard and shows a brief ✓ checkmark.
- Optionally: hard-code one test address that maps to a `.sol` domain in the known labels dict to visually verify the blue-tick style.
