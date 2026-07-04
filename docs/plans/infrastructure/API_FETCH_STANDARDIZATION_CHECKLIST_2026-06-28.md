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

- [x] Confirm the REST endpoint and query/path parameters.
- [x] Add or reuse a Zod response schema.
- [x] Replace SDK/custom/manual fetch with `rlFetch`.
- [x] Replace direct JSON casts with `getTrackedApiResult`.
- [x] Keep provider utilities focused on endpoint, headers, limiter, and provider constants.

## Existing Abstractions To Consolidate

- [x] `rlFetch`: preferred rate-limited fetch path.
- [x] `getTrackedApiResult`: preferred response parsing and schema validation path.
- [x] `trackedFetch`: replaced by rlFetch + getTrackedApiResult in priority endpoints.
- [ ] `heliusFetch`: custom Helius retry/tracking wrapper; migrate call sites to `rlFetch` once Helius schemas are ready.
- [ ] `moralisFetch`: custom Moralis retry/tracking wrapper; migrate call sites to `rlFetch` once Moralis schemas are ready.
- [ ] `requestProviderJson<T>`: generic cast-based provider helper; either remove or make schema-required.
- [x] `cg.client` / `cg.safeClient`: CoinGecko SDK path; replaced with REST `rlFetch` calls.

## Endpoint Inventory

### CoinGecko

| Area | Current use | REST endpoint | Verification | Schema status | Migration status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| CoinGecko coin list | `token-list.ts` REST | `GET /api/v3/coins/list` | ✓ Verified | ✓ cg_CoinListSchema | ✓ MIGRATED (rlFetch + getTrackedApiResult) | Replaced SDK with REST call. |
| CoinGecko markets | `token-market-data.ts` REST | `GET /api/v3/coins/markets` | ✓ Verified | ✓ cg_CoinMarketsSchema | ✓ MIGRATED (rlFetch + getTrackedApiResult) | Replaced SDK with REST call. |
| CoinGecko coin by ID | `token-info.ts` REST | `GET /api/v3/coins/{id}` | ✓ Verified | ✓ cg_CoinDetailSchema | ✓ MIGRATED (rlFetch + getTrackedApiResult) | Replaced SDK with REST call. |
| CoinGecko onchain token info | No current use | `GET /api/v3/onchain/networks/{network}/tokens/{address}/info` | ✓ Verified | ✓ cg_CoinDetailSchema | N/A | Holder stats moved to Mobula. |
| CoinGecko token search | SDK (not migrated) | `GET /api/v3/search` | ✓ Verified | ✓ cg_SearchSchema | Pending | SDK still in use for search endpoints. |
| CoinGecko onchain pool search | SDK (not migrated) | `GET /api/v3/onchain/search/pools` | ✓ Verified | ✓ cg_TopPoolDataSchema | Pending | SDK still in use for pool search. |
| CoinGecko top pools by token | `token-pools.ts` trackedFetch | `GET /api/v3/onchain/networks/{network}/tokens/{address}/pools` | ✓ Verified | ✓ cg_TopPoolDataSchema | Pending | Pool endpoints use trackedFetch, ready for rlFetch migration. |
| CoinGecko pool detail | `token-pools.ts` trackedFetch | `GET /api/v3/onchain/networks/{network}/pools/{address}` | ✓ Verified | ✓ cg_PoolDataSchema | Pending | Pool endpoints use trackedFetch, ready for rlFetch migration. |
| CoinGecko pool trades | `token-trades.ts` REST (schema) | `GET /api/v3/onchain/networks/{network}/pools/{address}/trades` | ✓ Verified | ✓ cg_24hPoolTradesSchema (syntax fixed) | ✓ MIGRATED | Already uses rlFetch + getTrackedApiResult. |
| CoinGecko market chart range | `token-chart.ts` trackedFetch | `GET /api/v3/coins/{id}/market_chart/range` | ✓ Verified | ✓ cg_TokenMarketChartSchema | ✓ MIGRATED (rlFetch + getTrackedApiResult) | Replaced trackedFetch with rlFetch. |
| CoinGecko market chart | `token-history.ts` trackedFetch | `GET /api/v3/coins/{id}/market_chart` | ✓ Verified | ✓ cg_TokenMarketChartSchema | ✓ MIGRATED (rlFetch + getTrackedApiResult) | Replaced trackedFetch with rlFetch. |

### Birdeye

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Birdeye trending tokens | `token-trending.ts` trackedFetch | `GET /api/v2/radar/trending` | ✓ Verified | ✓ bds_TrendingListSchema | ✓ MIGRATED (rlFetch + getTrackedApiResult) | Replaced trackedFetch with rlFetch. |
| Recent trades | `trades.ts` plain `fetch` + schema | `GET /defi/v3/txs/recent` | Existing schema in repo | Existing Zod schema | Pending | Needs `fetch` to `rlFetch`. |
| Top traders | `trades.ts` plain `fetch` + schema | `GET /trader/gainers-losers` | Existing schema in repo | Existing Zod schema | Pending | Needs `fetch` to `rlFetch`. |
| History price | token/wallet chart providers | Birdeye history price endpoint | Existing schema in repo | Existing Zod schema | Pending | Mostly aligned already. |

### Moralis

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Token top holders | Replaced; no current token-holder use | Deprecated Solana top-holders path | Deprecated for Solana | Legacy type only | Do not invest in this path. Current holder rows and holder stats use Mobula `holder-positions`. |
| Holder metrics | Not used | Provided holder-metrics docs | Needs verification only if reintroduced | Missing | Do not add unless a service has a concrete need after Mobula holder stats are evaluated. |
| Wallet swaps | old wallet fetcher Moralis path | `GET /account/{network}/{address}/swaps` | Verified from provided docs | ✓ mrl_WalletSwapsSchema | Pending | Schema created; awaiting service migration. |

### Mobula

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Token holder positions | `token-holders.ts` `rlFetch` + schema | `GET /api/2/token/holder-positions` | Verified from Mobula docs and sample response | Existing Zod schema: `mbl_TokenTopHoldersSchema` | Replaces Moralis top holders and CoinGecko holder distribution. One snapshot refresh writes both `top_token_holders` and `token_holder_stats` in one transaction. Use `chainId=solana:solana`, `address`, `limit=1000`. Filter zero balances and sort by `percentageOfTotalSupply` before assigning rank. |
| Wallet positions | `wallet-token-details.ts` `rlFetch` + schema | `GET /api/2/wallet/positions` | Existing implementation | Existing Zod schema | Already follows the standard path. |
| Wallet analysis | `wallet-analysis.ts` `rlFetch` + schema | `GET /api/2/wallet/analysis` | Existing implementation | Existing Zod schema | Already follows the standard path. |
| Wallet activity | `walletTransfersSwaps.service.ts` `rlFetch` + schema | `GET /api/2/wallet/activity` | Existing implementation | Existing Zod schema | Main replacement direction for legacy wallet activity paths. |
| Wallet history | `walletCharts.service.ts` `rlFetch` + schema | `GET /api/1/wallet/history` | Existing implementation | Existing Zod schema | Already follows the standard path. |

### Helius

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Wallet transfers | old wallet fetcher Helius path | Provided wallet transfers docs | ✓ Verified | ✓ helius_WalletTransfersSchema | Pending | Schema created; awaiting service migration. |
| Wallet funded-by | wallet identity/fetcher paths | Provided funded-by docs | ✓ Verified | ✓ helius_WalletFundedBySchema | Pending | Schema created; awaiting service migration. |
| Wallet balances | Helius portfolio fetch | `GET /v1/wallet/{address}/balances` | Existing schema in repo | Existing Zod schema | Uses `heliusFetch`; migrate wrapper after confirming limiter behavior. |

### DexPaprika

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Top pools on network | `token-market-pools.ts` DexPaprika fallback | `GET /networks/{network}/pools` | ✓ Verified | ✓ dex_TopPoolsSchema | Pending | Schema created; awaiting service migration. |

## Open Questions

- [ ] Should `trackedFetch` become internal to `rlFetch`, or should `rlFetch` call tracking directly? Current standard names are `rlFetch` and `getTrackedApiResult`, but call tracking also exists separately.
- [ ] Should provider utilities expose limiters for all providers, including CoinGecko and DexPaprika?
- [ ] Should legacy Helius/Moralis wallet activity paths be deleted once Mobula activity is stable?
- [ ] For DexPaprika, is sorting top pools by `last_price_change_usd_24h` an acceptable approximation for gainers/losers, or should this feature use another endpoint/provider?
- [ ] Should `token_holder_stats` remain as the long-term Mobula holder snapshot stats cache, or should holder count/distribution move into a dedicated holder snapshot metadata table?

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
- [x] Move token holder rows and distribution from Moralis/CoinGecko to Mobula holder positions.
- [ ] Remove or archive legacy Moralis holder response type if no other code uses it.
- [ ] Add DexPaprika pools schema and review the gainer/loser approximation.
