# Fix Comparison Typo Plan

Date: 2026-05-05

## Summary

The project contains a persistent spelling mistake where "comparison" is incorrectly spelled as "comparision". This typo exists across UI text, component names, variables, interface definitions, route paths, and directory structures. This plan outlines a comprehensive refactoring to correct all instances of this typo workspace-wide.

## Goals

- Correct the typo "comparision" to "comparison" in all visible UI text and comments.
- Refactor all related code entities: `WalletComparision` -> `WalletComparison`, `walletComparision` -> `walletComparison`, etc.
- Update all occurrences in routing logic: `/comparision/wallets` -> `/comparison/wallets`.
- Rename directories and files containing the typo to ensure structural correctness.
- Ensure no localization (`i18n`) keys are missed (Verified: no `.json` files currently contain the typo).

## Scope

### Directories to Rename
- `client/src/pages/walletsComparision` -> `client/src/pages/walletsComparison`
- `client/src/components/wallet/WalletComparision` -> `client/src/components/wallet/WalletComparison`

### Files to Rename
- `client/src/components/wallet/WalletComparison/WalletComparisionProp.tsx` -> `WalletComparisonProp.tsx`

### Files to Modify
- **Routes & Logic:**
  - `client/src/App.tsx` (Update route and imports)
  - `client/src/services/profile/profileMockData.ts` (Update route)
  - `client/src/hooks/profile/useProfileWalletTabData.ts` (Update route)
- **Components:**
  - `client/src/pages/walletsComparison/index.tsx` (Update imports, rename `WalletsComparisionPage` -> `WalletsComparisonPage`)
  - `client/src/components/wallet/WalletComparison/WalletComparisonProp.tsx` (Rename interface `WalletComparisionProp` -> `WalletComparisonProp`)
  - `client/src/components/wallet/WalletComparison/RiskTab.tsx` (Update imports and props type)
  - `client/src/components/wallet/WalletComparison/HoldingTab.tsx` (Update imports and props type)
  - `client/src/components/wallet/WalletComparison/GeneralTab.tsx` (Update imports, props type, and UI comments)
  - `client/src/components/wallet/WalletOverview/WalletOverview.tsx` (Update navigate route)
  - `client/src/components/profile/ProfilePortfolioTab.tsx` (Update navigate route)
- **Documentation:**
  - `docs/WALLET_AND_COMPARISON_API_REVIEW.md`
  - `docs/WALLET_API_REVIEW_OUTLINE.md`
  - `docs/WALLET_COMPARISON_PDF_EXPORT_PLAN.md`
  - `docs/WALLET_PAGE_ENDPOINT_TRACE.md`

## Implementation Plan

### 1. Rename Directories and Files
Execute PowerShell commands to rename directories and files:
- Rename directory `walletsComparision` to `walletsComparison`.
- Rename directory `WalletComparision` to `WalletComparison`.
- Rename `WalletComparisionProp.tsx` to `WalletComparisonProp.tsx`.

### 2. Update Source Code
Perform search and replace across the workspace files:
- Replace `WalletComparision` with `WalletComparison`.
- Replace `walletComparision` with `walletComparison`.
- Replace `comparision` with `comparison` in all route URLs (e.g. `/comparision/wallets` -> `/comparison/wallets`).
- Replace `WalletsComparisionPage` with `WalletsComparisonPage`.

### 3. Update Documentation
Correct the typo in all Markdown documents under `docs/` where it currently exists.

## Verification Plan

### Automated Tests
- Run full workspace text search for `comparision` to ensure zero results are found.

### Manual Verification
- Verify that `npm run dev` starts successfully without any unresolved module errors.
- Test navigation from the Wallet Overview page to the newly named `/comparison/wallets` route.
- Confirm the Wallet Comparison tabs (General, Holding, Risk) render correctly.
