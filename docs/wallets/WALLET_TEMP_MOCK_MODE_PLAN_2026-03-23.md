# Wallet Temporary Mock Mode Plan (2026-03-23)

## Objective

Temporarily unblock wallet-page feature development when provider/API keys are exhausted by introducing a mock data layer for wallet and wallet-chart services, while keeping rollback fast and low-risk.

## Constraints

- Do not change wallet page/component contracts.
- Keep existing exported service function signatures unchanged.
- Make enable/disable controlled by one environment flag.
- Keep mock code isolated so it can be deleted in one cleanup commit.

## Scope

### In scope

- Wallet page service calls in `client/src/services/wallet/walletApi.ts`:
  - `fetchWalletOverview`
  - `fetchWalletPortfolio`
  - `fetchWalletSwaps`
  - `fetchWalletTransfers`
  - `fetchWalletCounterparties`
  - `fetchWalletIntelligence`
  - `fetchWalletExchanges`
  - `fetchWalletIdentity`
- Wallet-page chart calls in `client/src/services/chart/chartApi.ts`.
- Routing toggle at `client/src/api/main.ts`.

### Out of scope

- Backend API route changes.
- Permanent data-model redesign.
- Non-wallet pages.

## Architecture

### Single entry switch

Use `VITE_USE_WALLET_MOCKS` to activate mock mode.

- `false` (default): normal live API behavior.
- `true`: wallet and chart endpoints used by wallet pages return mock data.

### Insertion point

Attach mock routing at API client boundary in `client/src/api/main.ts`.

Rationale:

- Avoid touching every service function and every consumer.
- Keep rollback to one integration line plus mock file removal.

### Suggested files

- `client/src/api/walletMockRouter.ts`
  - Wraps the RPC client.
  - Routes wallet/chart reads to mock handlers when flag is enabled.
- `client/src/services/wallet/mockWalletData.ts`
  - Generates wallet endpoint payloads for table/card endpoints.
- Reuse `client/src/services/chart/mockChartData.ts` where possible.

## Implementation Plan

## 1. Add feature flag plumbing

- Add `VITE_USE_WALLET_MOCKS` to client environment docs/example env.
- Add a small helper to resolve boolean env values safely.

Acceptance:

- App starts with flag missing.
- Flag true/false can be switched without code changes.

## 2. Implement API-boundary mock router

- Add router wrapper that intercepts wallet and wallet-chart RPC requests.
- Keep current default export shape unchanged so existing imports still work.
- Log one startup line when mock mode is active.

Acceptance:

- No consumer file changes required.
- All existing service methods continue to compile unchanged.

## 3. Implement wallet service mock payload generators

- Create deterministic fixture generators keyed by wallet address and cursor.
- Cover required fields and pagination metadata used by UI.
- Include realistic nullability and optional fields for resilience testing.

Acceptance:

- Portfolio, swaps, transfers, counterparties, overview, exchanges, identity, intelligence all render without runtime errors.

## 4. Reuse and align chart mock providers

- Route chart fetches to existing mock chart functions.
- Ensure returned metadata includes fields expected by wallet charts:
  - `wallets`
  - `tokenMeta`
  - `walletMeta`
  - `timezone`
  - `currency`

Acceptance:

- Balance and PnL charts load and allow wallet/token switching.

## 5. Add deterministic scenario presets

- At minimum support:
  - Empty wallet
  - Single-token wallet
  - Multi-wallet comparison
  - High-activity wallet with pagination
- Keep scenario mapping deterministic from address to avoid flaky UI tests.

Acceptance:

- Same wallet address yields stable output across refreshes.

## 6. Add tests and guardrails

- Unit test router selection behavior (flag on/off).
- Add contract tests for mock generator output shape against service interfaces.
- Run existing wallet wiring tests unchanged to verify integration stability.

Acceptance:

- Tests pass in both live mode (where available) and mock mode.

## 7. Document operational usage

- Add a short "Mock Mode" section in wallet docs:
  - How to enable/disable.
  - What endpoints are mocked.
  - Known limitations.

Acceptance:

- Another developer can switch modes in less than 2 minutes.

## Cleanup and Disposal Plan

Cleanup must be intentionally easy.

1. Set `VITE_USE_WALLET_MOCKS=false`.
2. Remove mock router import/wrapper from `client/src/api/main.ts`.
3. Delete temporary files:
   - `client/src/api/walletMockRouter.ts`
   - `client/src/services/wallet/mockWalletData.ts`
   - any mock-only helper files added for this feature
4. Remove mock-mode docs section if no longer needed.
5. Run tests and wallet-page smoke checks.

Recommended: tag temporary code comments with `TEMP_WALLET_MOCK` for fast grep-based cleanup.

## Risks and Mitigations

- Risk: Mock shape drifts from backend contract.
  - Mitigation: compile-time interface checks and lightweight contract tests.
- Risk: Hidden coupling to real API edge behavior.
  - Mitigation: include null/partial-data scenarios and pagination edge cases.
- Risk: Mock code leaks into long-term production flow.
  - Mitigation: single feature flag, isolated files, disposal checklist above.

## Rollout Sequence

1. Add flag and router wrapper.
2. Wire chart mocks.
3. Add wallet table/card mocks.
4. Verify wallet and wallet-comparison page flows.
5. Add tests and docs.

## Definition of Done

- Wallet pages are fully usable in mock mode with exhausted API keys.
- No wallet page component changes required to switch mode.
- Turning off one env flag restores live API behavior.
- Mock layer can be removed with a small, explicit cleanup commit.

## Mock Mode Usage (Operational)

1. Open `client/.env.development`.
2. Set `VITE_USE_WALLET_MOCKS=true`.
3. Start/restart client dev server.
4. Open wallet pages; wallet and wallet-chart reads will use deterministic mock payloads.

To revert to live APIs:

1. Set `VITE_USE_WALLET_MOCKS=false`.
2. Restart the client dev server.

Known limitations:

- Payloads are deterministic synthetic fixtures and do not reflect live provider state.
- Some non-wallet API domains remain live and are unaffected by this flag.