# Profile Watchlist Tab Implementation Plan (2026-04-15)

## Goal
Add new Profile Watchlist tab with nested subtabs and shared watchlist state.

Required behavior:
- Profile page has top-level Watchlist tab.
- Inside Watchlist tab: compact tab container with 2 subtabs: Wallet Watchlist, Token Watchlist.
- Each subtab renders one table.
- Token rows show market-style fields (same shape as Market page token table where practical).
- Wallet rows show wallet address and wallet identity (if available).
- Click row (or address cell) navigates to associated wallet or token page.
- Watchlist add/remove state is wired through service + context (not isolated local component state).

## Current State Summary

Frontend:
- Profile page uses vertical `TabContainer` and `PROFILE_TABS` constants.
- No dedicated watchlist tab in profile yet.
- Market page currently stores token watchlist in `localStorage` (`yoca_watchlist`), local to page.
- `Tble` supports Carbon DataTable rendering but no built-in row click API.
- Legacy `Table` component supports `onRowClick`, but profile watchlist should align with current table usage direction.

Backend:
- Watchlist DB tables already exist: `user_token_watch_list`, `user_wallet_watch_list`.
- Watchlist service exists with add/remove/get/check for token and wallet addresses.
- Profile routes already expose watchlist endpoints.

Gap:
- Frontend not consuming backend watchlist yet.
- No shared context for token + wallet watchlist state.
- Profile Watchlist UI missing.
- Endpoint contract naming and method shapes should be tightened before broad usage.

## UX and Data Contract Decisions

### 1) Tab and layout decisions
- Add top-level Profile tab: `watchlist`.
- Render `ProfileWatchlistTab` inside this tab.
- Inside `ProfileWatchlistTab`, use a smaller horizontal `TabContainer` with two subtabs:
  - Wallet watchlist
  - Token watchlist

### 2) Row navigation decisions
- Token row click -> `/tokens/:address`
- Wallet row click -> `/wallets/:address`
- Address/symbol cell stays a normal link for accessibility fallback.

### 3) Shared watchlist state decisions
- Introduce `WatchlistContext` as single source of truth on client.
- Context holds:
  - `tokenWatchlist: string[]`
  - `walletWatchlist: string[]`
  - loading/error states
  - mutation actions: add/remove/toggle for token and wallet
  - refetch helpers
- Market page favorite star and Profile Watchlist tab both read/write through this context.
- Keep temporary `localStorage` fallback only if user unauthenticated (optional), but authenticated flow must use backend watchlist.

### 4) Backend API contract normalization
Before wiring broad client usage, standardize response/request shape:
- Return `tokenAddress` (not `tokenId`) in token watchlist rows.
- Keep wallet rows as `walletAddress`.
- For check endpoints, move to query param validation or switch to POST (avoid GET body validation ambiguity).
- Keep add/remove endpoints idempotent.

## Implementation Plan

## Phase 1 - Add shared watchlist service and context

### 1.1 Client service layer
Files:
- `client/src/services/profile/profileApi.ts`
- Optional new file: `client/src/services/profile/watchlistApi.ts`

Tasks:
- Add typed API methods:
  - `getTokenWatchlist()`
  - `getWalletWatchlist()`
  - `addTokenToWatchlist(tokenAddress)`
  - `removeTokenFromWatchlist(tokenAddress)`
  - `addWalletToWatchlist(walletAddress)`
  - `removeWalletFromWatchlist(walletAddress)`
  - Optional checks: `isTokenInWatchlist`, `isWalletInWatchlist`
- Normalize payload mapping to arrays of address strings.
- Add strict error mapping for auth failures and generic API failures.

### 1.2 Watchlist context
Files:
- New: `client/src/contexts/WatchlistContext.tsx`
- `client/src/main.tsx`

Tasks:
- Create provider + hook `useWatchlist()`.
- Fetch token and wallet watchlist on mount when user is authenticated.
- Expose optimistic mutation actions with rollback on error.
- Wrap app with `WatchlistProvider` in `main.tsx` (inside auth scope).

### 1.3 Optional helper hook for consumers
Files:
- New: `client/src/hooks/profile/useWatchlist.ts`

Tasks:
- Re-export/compose context APIs for feature modules.
- Add selectors (membership checks by address) to reduce repeated includes logic.

## Phase 2 - Build Profile Watchlist tab UI

### 2.1 Add top-level profile tab entry
Files:
- `client/src/components/profile/profile.constants.ts`
- `client/src/pages/profile/index.tsx`

Tasks:
- Add `watchlist` to `PROFILE_TABS` and `ProfileTabId` flow.
- Insert icon mapping in profile tab icon switch.
- Add tab node pointing to new `ProfileWatchlistTab` component.

### 2.2 Implement ProfileWatchlistTab shell
Files:
- New: `client/src/components/profile/ProfileWatchlistTab.tsx`
- `client/src/components/profile/profile.module.scss`

Tasks:
- Create section wrapper matching existing profile card spacing.
- Render compact nested `TabContainer` with 2 names (Wallet, Token).
- Keep subtab state local to component.

### 2.3 Wallet watchlist table
Files:
- `client/src/components/profile/ProfileWatchlistTab.tsx`
- Optional new presentational split:
  - `client/src/components/profile/watchlist/ProfileWalletWatchlistTable.tsx`

Columns:
- Wallet address (short display + copy)
- Identity (resolved label if available, else fallback)

Data source:
- `walletWatchlist` from `WatchlistContext`.
- Identity enrichment strategy:
  - Phase A: derive from linked wallet labels when available.
  - Phase B (optional): dedicated identity endpoint/service for arbitrary wallets.

Interaction:
- Row click navigates to wallet detail.

### 2.4 Token watchlist table (market-like data)
Files:
- `client/src/components/profile/ProfileWatchlistTab.tsx`
- Optional split:
  - `client/src/components/profile/watchlist/ProfileTokenWatchlistTable.tsx`

Columns (match Market page as close as practical):
- Token (image + symbol + name)
- Price
- 1h / 24h / 7d changes
- 24h volume
- Market cap
- FDV
- 7d sparkline (if available)

Data source strategy:
- Watchlist addresses from context.
- Reuse Market page endpoint pattern:
  - `/tokens/meta/:addresses`
  - `/tokens/markets/:addresses`
- Build rows by joining meta + market payload by address.

Interaction:
- Row click navigates to token overview page.

## Phase 3 - Integrate Market page with shared context

Files:
- `client/src/pages/market/index.tsx`

Tasks:
- Remove local-only `yoca_watchlist` state ownership.
- Replace with `useWatchlist()` token APIs:
  - `tokenWatchlist`
  - `toggleTokenWatchlist`
  - loading flags
- Keep current UI behavior for star/favorites and Watchlist tab filter.

Outcome:
- Single source of truth for token watchlist across Market and Profile.

## Phase 4 - Backend/API contract hardening (if needed)

Files:
- `server/src/routes/profile.ts`
- `server/src/services/profile/watchlist.service.ts`
- `server/src/middlewares/validation.ts` (if query schemas added)

Tasks:
- Ensure response DTO fields are consistent:
  - token rows -> `tokenAddress`
  - wallet rows -> `walletAddress`
- Fix check endpoint request shape to avoid GET body validation ambiguity.
- Keep add/remove idempotent and no-op safe.
- Add explicit success payload contract used by frontend.

## Phase 5 - Localization and empty states

Files:
- `client/src/config/localization/en.ts`
- `client/src/config/localization/vi.ts`

Tasks:
- Add keys under `profileTabs.watchlist`:
  - tab title
  - subtab labels
  - table headers
  - empty states
  - loading/error text

## Phase 6 - Testing plan

### 6.1 Frontend tests
Targets:
- Watchlist context load + mutation + rollback behavior.
- Profile Watchlist nested tabs render and switch.
- Token/wallet row navigation.
- Market star toggle updates context and profile table reflects change.

Likely files:
- `client/src/contexts/WatchlistContext.test.tsx`
- `client/src/components/profile/ProfileWatchlistTab.test.tsx`
- `client/src/pages/market/index.test.tsx` (or feature-level test)

### 6.2 Backend tests
Targets:
- Profile watchlist endpoints return normalized contract.
- Add/remove idempotent behavior.
- Auth required behavior.

Likely files:
- `server/src/tests/routes/profile.watchlist.test.ts`
- `server/src/tests/services/watchlist.service.test.ts`

## Delivery Sequence
1. API contract normalization (if required).
2. Client watchlist API methods.
3. `WatchlistContext` provider + app wiring.
4. Profile top-level Watchlist tab + nested subtabs.
5. Token/wallet table implementations + navigation wiring.
6. Market page migration to shared context.
7. Localization + tests + QA.

## Risks and Mitigations
- Risk: Large watchlist address list can exceed path length for `:addresses` endpoint.
  - Mitigation: batch addresses for meta/market requests and merge client-side.
- Risk: Watchlist endpoints currently mixed naming (`tokenId` vs address).
  - Mitigation: normalize DTO before frontend rollout.
- Risk: `Tble` missing row-click handler.
  - Mitigation: either add `onRowClick` support to `Tble` or make first column link-based and row wrapper clickable in custom render path.

## Definition of Done
- Profile page has working Watchlist tab with 2 subtabs (wallet + token).
- Each subtab shows one table with required columns.
- Row click/address click routes to correct detail pages.
- Token and wallet watchlist status updates through shared context + backend service.
- Market and Profile stay in sync for token watchlist updates.
- Tests cover core data flow and navigation.