# Wallet Intelligence First Fund Tags Plan

Date: 2026-04-02

## Goal
Use wallet first fund data to enrich wallet intelligence with two new user-facing tags:

1. First funder address / identity
2. Wallet age derived from the first fund date

The first funder tag must be clickable and route to that wallet’s page.

## Source Data
The new data source is `HeliusWalletFirstFund` from `server/src/services/wallet/dtos/walletDataObjects.ts`.

Relevant fields:
- `funder`: wallet address that first funded the target wallet
- `funderName`: optional identity/name for the funder
- `funderType`: optional classification from provider data
- `date`: first-fund date string
- `timestamp`: first-fund timestamp in seconds
- `signature`: transaction signature for traceability

## Proposed Output Shape
Extend wallet intelligence responses so the UI can render first-fund insights without recomputing them locally.

Add a first-fund insight payload that includes:
- target wallet address
- first funder address
- first funder identity label if available
- first fund date / timestamp
- computed wallet age text
- wallet age in days for sorting/formatting if needed

Suggested model addition:
- `WalletIdentityAnalysis` should gain a dedicated field for wallet insight tags or a structured `insights` block instead of mixing these values into `userTags`.

## Backend Plan

### 1) Fetch first fund data in wallet intelligence composition
Update `server/src/services/wallet/walletIntelligence.service.ts` so `composeWalletIntelligence` also loads first fund information for the target address.

Recommended flow:
- fetch identity and first-fund data in parallel
- continue analysis generation even if first-fund lookup fails
- treat first-fund lookup as enrichment, not a hard dependency

### 2) Add a dedicated first-fund helper
Reuse `getWalletFirstFund(address)` from `server/src/services/wallet/walletFirstFund.service.ts`.

If needed, introduce a small mapper that normalizes:
- `funder` and `funderName` into a displayable label
- `date` / `timestamp` into wallet age

### 3) Compute wallet age server-side
Wallet age should be derived from the first-fund timestamp/date, not from client clocks.

Recommended representation:
- a human-friendly label such as `2y 3m` or `18 days`
- a numeric age in days for consistent sorting and later reuse

### 4) Preserve existing intelligence behavior
The current risk analysis logic should remain unchanged.

The new first-fund enrichment should:
- not alter risk score unless explicitly approved later
- not block wallet intelligence when Helius first-fund data is unavailable
- degrade gracefully to `unknown` / `not available`

### 5) Decide where the data lives
Prefer a structured payload attached to wallet intelligence metadata or analysis rather than expanding free-form text tags.

This keeps the API stable and makes the client rendering predictable.

## Client Plan

### 1) Render the first funder tag
In the wallet intelligence UI, display a tag for the first funder using:
- `funderName` when available
- otherwise a shortened `funder` address

Click behavior:
- route to the wallet page for the funder address
- preserve current app navigation conventions

### 2) Render the wallet age tag
Show wallet age as a compact tag derived from the first-fund timestamp.

Examples:
- `Wallet age: 2y 1m`
- `Wallet age: 14 days`

### 3) Handle missing data
If first-fund lookup fails or returns partial data:
- hide the tag entirely, or
- show a subdued fallback such as `First funder unavailable`

Use the same fallback style already used for missing wallet identity fields.

## API / DTO Changes
- Extend `WalletIdentityAnalysis` or add a new `WalletIntelligenceInsight` structure for first-fund fields.
- Add a typed response field for the wallet age value and display label.
- If the client needs route metadata, include the raw funder address explicitly.

## Testing Plan
- Unit test first-fund normalization and wallet-age formatting.
- Unit test wallet intelligence composition with:
  - successful first-fund lookup
  - missing first-fund lookup
  - malformed provider payload
- Client test the clickable funder tag navigation.
- Add a regression test to ensure missing first-fund data does not break wallet intelligence responses.

## Rollout Plan
1. Add DTOs and service mapping for first-fund insights.
2. Wire `getWalletFirstFund` into wallet intelligence composition.
3. Update the client to render the two tags.
4. Add tests for data mapping and navigation.
5. Verify on a known wallet with a stable first-fund transaction.

## Open Question
- Should wallet age be displayed as a human-readable duration only, or should the API also expose the raw first-fund timestamp for sorting and filtering?