# Fix Comparison Route Transition Issue Plan

Date: 2026-05-05

## Summary

The project contains a routing bug where clicking the "Compare this wallet" button changes the URL to `/comparison/wallets?wallets=xxx`, but the page does not transition. The view stays on the `WalletPage` without re-rendering the new route. This plan outlines an investigation and proposed fixes to correct the React Router transitions and ensure `WalletsComparisonPage` loads properly.

## Goals

- Diagnose why `react-router` fails to render `WalletsComparisonPage` despite a successful URL change.
- Ensure that any silent render errors on the target page are caught and displayed properly.
- Prevent route matching conflicts or unintended default browser events from interrupting Single Page Application (SPA) navigations.

## Proposed Changes

### 1. `client/src/App.tsx`
- **Reorder Routes**: Move `<Route path="/comparison/wallets" element={<WalletsComparisonPage />} />` explicitly above `<Route path="/wallets/:address" element={<WalletPage />} />` to rule out any path matching conflicts (even though React Router v6 is typically smart enough to handle exact paths).
- **Error Boundary**: Consider wrapping the routing paths or `WalletsComparisonPage` in a basic Error Boundary to ensure that if `WalletsComparisonPage` throws a render error (causing React 18 Concurrent Mode to suspend or abort the transition), it is caught and visually displayed instead of silently failing the transition.

#### [MODIFY] [App.tsx](file:///d:/DH/DATN/Yoca/client/src/App.tsx)

### 2. `client/src/components/wallet/WalletOverview/WalletOverview.tsx`
- **Button Type**: Add `type="button"` to the "Compare this wallet" button (and all similar action buttons) to prevent any unintended default form submission behaviors that could interrupt or interfere with the `navigate` hook.

#### [MODIFY] [WalletOverview.tsx](file:///d:/DH/DATN/Yoca/client/src/components/wallet/WalletOverview/WalletOverview.tsx)

### 3. `client/src/pages/walletsComparison/index.tsx`
- **Component Verification**: Verify that the pre-populate logic using `searchParams.get("wallets")` and subsequent `setSelectedWallets` state updates do not trigger an infinite render loop or hit a silent exception when mounting the `WalletComparisonMainContent` or `WalletComparisonSidebar` components.

#### [MODIFY] [index.tsx](file:///d:/DH/DATN/Yoca/client/src/pages/walletsComparison/index.tsx)

## Verification Plan

### Automated Tests
- Run `npm run lint` and `npm run typecheck` to ensure no syntax errors were introduced.

### Manual Verification
- Navigate to any wallet detail page (`/wallets/:address`).
- Click the "Compare this wallet" action button.
- Verify that the URL updates to `/comparison/wallets?wallets=...` AND the UI fully transitions to the Comparison interface.
- Check the browser console for any uncaught runtime exceptions during the transition.
