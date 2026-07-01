# API Fetch Standardization Checklist

## Goal

Move server-side external API calls toward one standard path:

- Build provider URL and headers with provider utilities.
- Fetch through `rlFetch`.
- Parse through `getTrackedApiResult` with a Zod response schema.
- Remove SDK API usage from server services.
- Avoid direct `response.json()` casts for provider responses.

This document tracks abstract migration work and remaining schema questions only. It is not a change log.

## Standard Shape

For each provider endpoint:

- [ ] Confirm the REST endpoint and query/path parameters.
- [ ] Add or reuse a Zod response schema.
- [ ] Replace SDK/custom/manual fetch with `rlFetch`.
- [ ] Replace direct JSON casts with `getTrackedApiResult`.
- [ ] Keep provider utilities focused on endpoint, headers, limiter, and provider constants.

## Existing Abstractions To Consolidate

- [ ] `rlFetch`: preferred rate-limited fetch path.
- [ ] `getTrackedApiResult`: preferred response parsing and schema validation path.
- [ ] `trackedFetch`: currently tracks calls, but should be replaced or wrapped by the standard path where provider rate limiting matters.
- [ ] `heliusFetch`: custom Helius retry/tracking wrapper; migrate call sites to `rlFetch` once Helius schemas are ready.
- [ ] `moralisFetch`: custom Moralis retry/tracking wrapper; migrate call sites to `rlFetch` once Moralis schemas are ready.
- [ ] `requestProviderJson<T>`: generic cast-based provider helper; either remove or make schema-required.
- [ ] `cg.client` / `cg.safeClient`: CoinGecko SDK path; replace with REST `rlFetch` calls.

## Endpoint Inventory

### CoinGecko

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| CoinGecko coin list | `token-list.ts` SDK | `GET /api/v3/coins/list` | Verified from provided docs | Missing Zod schema | Supports `include_platform`; full response is not paginated. |
| CoinGecko markets | `token-market-data.ts`, `token-top-marketcap.ts` SDK | `GET /api/v3/coins/markets` | Verified from provided docs | Type exists from SDK-derived shape; needs Zod schema | Existing code uses optional market/sparkline/price-change fields. |
| CoinGecko coin by ID | `token-info.ts` SDK | `GET /api/v3/coins/{id}` | Verified from provided docs | Missing Zod schema | Existing code uses metadata, descriptions, links, categories, platform decimals, and market data. |
| CoinGecko onchain token info | `token-info.ts` SDK | `GET /api/v3/onchain/networks/{network}/tokens/{address}/info` | Verified from provided docs | Missing Zod schema | Current holder stats use `holders.distribution_percentage.top_10`, `11_20`, `21_40`; docs show these as strings. |
| CoinGecko token search | `search.ts`, `routes/search.ts`, `chat-token-search.ts` SDK | `GET /api/v3/search` | Needs verification | Missing Zod schema | Provided URL appears likely correct; verify before schema work. |
| CoinGecko onchain pool search | `search.ts`, `routes/search.ts` SDK | `GET /api/v3/onchain/search/pools` | Needs verification | Missing Zod schema | Existing code needs `data`, `included`, token relationships, and pool attributes. |
| CoinGecko top pools by token | `token-pools.ts`, `token-market-pools.ts` REST cast | Likely `GET /api/v3/onchain/networks/{network}/tokens/{address}/pools` | Needs verification | Type exists; needs Zod schema | Existing shape has `data` and `included`. |
| CoinGecko pool detail | `token-pools.ts`, `token-market-pools.ts` REST cast | Likely `GET /api/v3/onchain/networks/{network}/pools/{address}` | Needs verification | Type exists; needs Zod schema | Single-pool code currently wraps response into top-pool mapping shape. |
| CoinGecko pool trades | `pools.ts`, `token-trades.ts` REST cast | Likely `GET /api/v3/onchain/networks/{network}/pools/{address}/trades` | Needs verification | Type exists; needs Zod schema | Confirm pagination/limit parameters before migration. |
| CoinGecko market chart range | `token-chart.ts`, `token-history.ts`, price fallback | `GET /api/v3/coins/{id}/market_chart/range` | Already known in code comments | Existing Zod schema | Easy early migration target: replace cast/SDK fetch paths with `rlFetch` + existing schema. |

### Birdeye

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Trending tokens | `token-trending.ts` `trackedFetch` + cast | `GET /defi/token_trending` | Verified from provided docs | Missing Zod schema | Current response type is `BDS_TrendingList`; convert to Zod. |
| Recent trades | `trades.ts` plain `fetch` + schema | `GET /defi/v3/txs/recent` | Existing schema in repo | Existing Zod schema | Needs `fetch` to `rlFetch`. |
| Top traders | `trades.ts` plain `fetch` + schema | `GET /trader/gainers-losers` | Existing schema in repo | Existing Zod schema | Needs `fetch` to `rlFetch`. |
| History price | token/wallet chart providers | Birdeye history price endpoint | Existing schema in repo | Existing Zod schema | Mostly aligned already. |

### Moralis

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Token top holders | `token-holders.ts` `trackedFetch` + cast | Provided top-holders docs | Needs verification | Type exists; needs Zod schema | Also verify whether holder metrics endpoint is needed or whether top-holders is sufficient for current table. |
| Holder metrics | Not confirmed as used | Provided holder-metrics docs | Needs verification | Missing | Open question: only add if a service actually needs aggregate holder metrics. |
| Wallet swaps | old wallet fetcher Moralis path | `GET /account/{network}/{address}/swaps` | Verified from provided docs | Interface exists; needs Zod schema only if path remains | Current direction is to migrate swap activity to Mobula; likely remove/deprecate rather than invest heavily. |

### Helius

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Wallet transfers | old wallet fetcher Helius path | Provided wallet transfers docs | Needs verification | Missing Zod schema | If Mobula replaces activity history, this may become removable or legacy-only. |
| Wallet funded-by | wallet identity/fetcher paths | Provided funded-by docs | Verified from provided docs | Missing Zod schema | Still likely useful for wallet identity/funder features. |
| Wallet balances | Helius portfolio fetch | `GET /v1/wallet/{address}/balances` | Existing schema in repo | Existing Zod schema | Uses `heliusFetch`; migrate wrapper after confirming limiter behavior. |

### DexPaprika

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Top pools on network | `token-market-pools.ts` DexPaprika fallback | `GET /networks/{network}/pools` | Verified from provided docs | Type exists; needs Zod schema | Endpoint sorts top pools and exposes `last_price_change_usd_*`; it is not inherently a gainers/losers endpoint. Current gainer/loser extraction needs review. |

## Open Questions

- [ ] Should `trackedFetch` become internal to `rlFetch`, or should `rlFetch` call tracking directly? Current standard names are `rlFetch` and `getTrackedApiResult`, but call tracking also exists separately.
- [ ] Should provider utilities expose limiters for all providers, including CoinGecko and DexPaprika?
- [ ] Should legacy Helius/Moralis wallet activity paths be deleted once Mobula activity is stable?
- [ ] For DexPaprika, is sorting top pools by `last_price_change_usd_24h` an acceptable approximation for gainers/losers, or should this feature use another endpoint/provider?
- [ ] For Moralis holders, does current UI need top holder rows, aggregate holder metrics, or both?

## Suggested Small Batches

### Batch 1: Low-risk existing schemas

- [ ] CoinGecko market chart paths: use existing `cg_TokenMarketChartSchema`.
- [ ] Birdeye recent trades/top traders: keep schemas, replace plain `fetch` with `rlFetch`.
- [ ] Helius wallet balances: keep `hls_WalletBalancesSchema`, replace `heliusFetch` after limiter behavior is chosen.

### Batch 2: CoinGecko SDK removal

- [ ] Add schema for `coins/list`.
- [ ] Add schema for `coins/markets`.
- [ ] Add schema for `coins/{id}`.
- [ ] Add schema for onchain token info.
- [ ] Replace `cg.client` call sites with REST calls.

### Batch 3: Search and pool data

- [ ] Verify CoinGecko search endpoint shapes.
- [ ] Verify CoinGecko onchain pool search shape.
- [ ] Add schemas for top pools, pool detail, and pool trades.
- [ ] Replace pool/search casts.

### Batch 4: Legacy provider wrappers

- [ ] Decide whether old Helius transfer and Moralis wallet swap paths are still needed.
- [ ] If needed, add schemas and migrate to `rlFetch`.
- [ ] If not needed, remove dead fetch paths and their wrapper dependencies.

### Batch 5: Non-wallet supporting providers

- [ ] Add Birdeye trending schema.
- [ ] Add Moralis top holders schema if still used.
- [ ] Add DexPaprika pools schema and review the gainer/loser approximation.
