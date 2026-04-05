# Wallet Portfolio Phase 2 Plan: Frontend Wallet Page Adoption

## Objective
Adopt the enriched backend portfolio contract in wallet page table and asset distribution chart so users get:
1. Better token identity quality (symbol and name fallback).
2. Token logo rendering via logoUri.
3. Stable behavior when metadata is partially missing.

## Scope
In scope:
1. Wallet page portfolio table data mapping and rendering updates.
2. Asset distribution chart consumption of additive token metadata.
3. Client API typing updates to include logoUri and related metadata.
4. Frontend compatibility and regression testing.

Out of scope:
1. Backend data fetching or enrichment logic changes.
2. New chart endpoint design.
3. Non-wallet page UI refactors.

## Dependency
1. Requires Phase 1 backend changes to be available in /wallets/portfolio and distribution responses.

## Functional Requirements
1. Wallet table must display resilient token labels using fallback order.
2. Wallet table should render logoUri when available and gracefully fallback when absent.
3. Distribution chart must continue to render even if additive metadata is missing.
4. Existing sorting/filtering behavior should remain intact.

## Plan of Work

### 1) Client Type and API Contract Alignment
1. Update frontend wallet portfolio item typing to include optional logoUri and additive metadata fields.
2. Update chart distribution response typings so additive metadata is represented but optional.
3. Keep compatibility with existing name/value/percentage chart contracts.

### 2) Wallet Page Portfolio Mapping
1. Replace loose any-based mapping with a typed mapper for portfolio rows.
2. Use token label fallback chain:
   - symbol
   - name
   - shortened tokenAddress
   - Unknown
3. Preserve numeric fields used by sorting and filtering (price, amount, value, change).

### 3) Table Rendering for Token Logos
1. Add token cell renderer that displays:
   - logo image when logoUri exists
   - fallback initials or placeholder when logoUri is missing
2. Keep accessible alt text and resilient image error handling.
3. Do not break current Table component sorting/filtering pipelines.

### 4) Asset Distribution Chart Consumption
1. Continue using name/value/percentage for pie segments.
2. Read additive metadata when present for improved labels/tooltips.
3. Optionally display token icon in tooltip content when logoUri exists.
4. Keep grouping and export behavior unchanged.

### 5) UX and Error Handling
1. Ensure no layout shift or broken image icons on missing/invalid logoUri.
2. Add fallback text when symbol/name are both unavailable.
3. Keep behavior stable for empty portfolios and low-liquidity wallets.

### 6) Testing Plan (Style-Guide Compliant)

#### 6.1 Testing Rule Alignment
1. Enforce 1:1 testing traceability for each frontend file changed in this phase.
2. Any new utility/component introduced for wallet portfolio rendering must include a dedicated test file.
3. Preserve existing app behavior by adding regression tests for table sorting/filtering and chart rendering contracts.

#### 6.2 1:1 Test Coverage Matrix
| Implementation Target | Test Target | Coverage Type | Status |
| :--- | :--- | :--- | :--- |
| client/src/pages/wallet/index.tsx | client/src/pages/wallet/index.test.tsx | Page integration | Create |
| client/src/services/wallet/walletApi.ts | client/src/services/wallet/walletApi.test.ts | Service/unit | Create |
| client/src/components/charts/AssetDistribution/AssetDistribution.tsx (if modified) | client/src/components/charts/AssetDistribution/AssetDistribution.test.tsx | Component | Create/Extend |
| client/src/types/chart-api.types.ts (type contract checks) | client/src/types/chart-api.types.test.ts | Type/contract guards | Create |
| Any new wallet token renderer helper file | Matching .test.ts/.test.tsx in same module folder | Unit/component | Mandatory |

#### 6.3 Required Unit and Component Cases
1. Portfolio mapper logic:
   - fallback label order: symbol -> name -> shortened tokenAddress -> Unknown.
   - numeric columns remain numeric for sorting/filter stability.
   - missing logoUri does not break row rendering.
2. Token logo rendering:
   - renders img when logoUri is valid.
   - gracefully falls back on image load error.
   - supports accessible alt text.
3. API normalization:
   - additive metadata fields are treated as optional.
   - legacy payloads without logoUri remain supported.

#### 6.4 Page and Chart Integration Cases
1. Wallet page:
   - portfolio table renders expected token labels for mixed metadata rows.
   - sorting still works for price, amount, value, and change columns.
   - filtering still works for token and numeric ranges.
2. Asset distribution chart:
   - continues rendering with name/value/percentage only.
   - accepts additive metadata without changing chart totals.
   - export flow remains functional.

#### 6.5 Manual Verification Checklist
1. Wallet with complete metadata: icon and label quality verified.
2. Wallet with partial metadata: fallback labels and placeholders verified.
3. Wallet with unknown tokens: no crashes, no broken layout, sensible fallback text.
4. Confirm no layout shift from failed icon URLs.

#### 6.6 Execution Commands
1. Run all frontend tests:
   - npm --prefix client run test -- --run
2. Run focused tests while iterating:
   - npm --prefix client run test -- --run wallet/index
   - npm --prefix client run test -- --run walletApi
   - npm --prefix client run test -- --run AssetDistribution
3. Run frontend lint:
   - npm --prefix client run lint

#### 6.7 Test Exit Gates
1. New and modified frontend tests pass.
2. No regressions in existing localization tests.
3. Wallet table and chart smoke checks pass with enriched and legacy payloads.
4. Accessibility sanity check completed for token image fallback rendering.

## Acceptance Criteria
1. Wallet table shows improved token identity for previously unknown rows.
2. Token icons appear where logoUri is provided and fail gracefully otherwise.
3. Asset distribution chart remains stable and can use additive metadata without breaking.
4. Sorting, filtering, and existing chart interactions continue to work.

## Risks and Mitigations
1. Risk: External image URLs may fail or be slow.
   Mitigation: Add image onError fallback and lightweight placeholder.
2. Risk: Mixed response shapes during rollout.
   Mitigation: Keep all additive fields optional and use fallback mapping.
3. Risk: Table cell rendering complexity impacts readability.
   Mitigation: Isolate token-cell renderer and keep row data numeric for sorting.

## Rollout Checklist
1. Update types and wallet page mapping.
2. Add token logo cell renderer.
3. Validate chart/table with real wallet data.
4. Run frontend checks and smoke test wallet page interactions.
