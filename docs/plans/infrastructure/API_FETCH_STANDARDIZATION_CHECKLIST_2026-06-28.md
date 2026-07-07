# API Fetch Standardization Checklist

## Goal

Move server-side external API calls toward one standard path:

- Build provider URL and headers with provider utilities.
- Fetch through `rlFetch`.
- Parse through `validateApiResult` with a Zod response schema.
- Remove SDK API usage from server services.
- Avoid direct `response.json()` casts for provider responses.

This document tracks abstract migration work and remaining schema questions only. It is not a change log.

## Standard Shape

For each provider endpoint:

- [x] Confirm the REST endpoint and query/path parameters.
- [x] Add or reuse a Zod response schema.
- [x] Replace SDK/custom/manual fetch with `rlFetch`.
- [x] Replace direct JSON casts with `validateApiResult`.
- [x] Keep provider utilities focused on endpoint, headers, limiter, and provider constants.

## Existing Abstractions To Consolidate

- [x] `rlFetch`: preferred rate-limited fetch path.
- [x] `validateApiResult`: preferred response parsing and schema validation path.
- [x] `trackedFetch`: no active service/route consumers remain; remaining symbol is only the tracker service export for possible future tracker revival.
- [x] `heliusFetch`: removed after all active Helius REST call sites moved to `rlFetch` + `validateApiResult`.
- [x] `moralisFetch`: removed after wallet swaps moved to `rlFetch` + `validateApiResult`.
- [x] `requestProviderJson<T>`: removed after Helius and Birdeye wallet provider wrappers were migrated/removed.
- [x] `cg.client`: CoinGecko SDK path; no remaining call sites — search, onchain pool search, and `token-top-marketcap.ts` markets call all replaced with REST + `rlFetch` + `validateApiResult`.
- [x] `cg.safeClient`: no remaining call sites; dead code, candidate for removal.

## Endpoint Inventory

### CoinGecko

| Area | Current use | REST endpoint | Verification | Schema status | Migration status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| CoinGecko coin list | `token-list.ts` REST | `GET /api/v3/coins/list` | ✓ Verified | ✓ cg_CoinListSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Replaced SDK with REST call. |
| CoinGecko markets | `token-market-data.ts` REST | `GET /api/v3/coins/markets` | ✓ Verified | ✓ cg_CoinMarketsSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Replaced SDK with REST call. |
| CoinGecko markets (top marketcap) | `token-top-marketcap.ts` REST | `GET /api/v3/coins/markets` | ✓ Verified | ✓ cg_CoinMarketsSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Separate call site from `token-market-data.ts` (no `ids`, `per_page=250`); kept inline rather than sharing a helper, consistent with existing repo convention. |
| CoinGecko coin by ID | `token-info.ts` REST | `GET /api/v3/coins/{id}` | ✓ Verified | ✓ cg_CoinDetailSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Replaced SDK with REST call. |
| CoinGecko onchain token info | No current use | `GET /api/v3/onchain/networks/{network}/tokens/{address}/info` | ✓ Verified | ✓ cg_CoinDetailSchema | N/A | Holder stats moved to Mobula. |
| CoinGecko token search | `search.ts`, `chat-token-search.ts` REST | `GET /api/v3/search` | ✓ Verified | ✓ cg_SearchSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Also removed dead duplicate SDK-based copies of this logic in `routes/search.ts` (unused, route only calls `services/search.ts`). |
| CoinGecko onchain pool search | `search.ts` REST | `GET /api/v3/onchain/search/pools` | ✓ Verified | ✓ cg_TopPoolDataSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Also removed dead duplicate SDK-based copy in `routes/search.ts`. |
| CoinGecko exchange logos | `token-pools.ts` rlFetch | `GET /api/v3/exchanges` | Existing implementation | ✓ cg_ExchangeListSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Used to backfill DEX logos for token pools. |
| CoinGecko top pools by token | `token-pools.ts` rlFetch | `GET /api/v3/onchain/networks/{network}/tokens/{address}/pools` | ✓ Verified | ✓ cg_TopPoolDataSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Removed duplicate legacy `pools.ts`. |
| CoinGecko pool detail | `token-pools.ts` rlFetch | `GET /api/v3/onchain/networks/{network}/pools/{address}` | ✓ Verified | ✓ cg_PoolDataSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Removed duplicate legacy `pools.ts`. |
| CoinGecko pool trades | `token-trades.ts` rlFetch | `GET /api/v3/onchain/networks/{network}/pools/{address}/trades` | ✓ Verified | ✓ cg_24hPoolTradesSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Removed duplicate legacy `pools.ts`. |
| CoinGecko market chart range | `token-chart.ts`, `resolve-token-price.ts` fallback | `GET /api/v3/coins/{id}/market_chart/range` | ✓ Verified | ✓ cg_TokenMarketChartSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Replaced trackedFetch/plain fetch with rlFetch. |
| CoinGecko market chart | `token-history.ts` trackedFetch | `GET /api/v3/coins/{id}/market_chart` | ✓ Verified | ✓ cg_TokenMarketChartSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Replaced trackedFetch with rlFetch. |
| CoinGecko market pools | `token-market-pools.ts` rlFetch | `GET /api/v3/onchain/networks/solana/{trending_pools,new_pools,pools,multi pools}` | Existing implementation | ✓ cg_TopPoolDataSchema, ✓ cg_PoolDataSchema | ✓ MIGRATED (rlFetch + validateApiResult) | All active market-pool CoinGecko calls now use schema validation. |
| CoinGecko exchange rates | `routes/misc.ts` rlFetch | `GET /api/v3/exchange_rates` | Existing implementation | ✓ local exchangeRatesResponseSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Kept route-level stale-cache fallback behavior. |

### Birdeye

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Birdeye trending tokens | `token-trending.ts` trackedFetch | `GET /api/v2/radar/trending` | ✓ Verified | ✓ bds_TrendingListSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Replaced trackedFetch with rlFetch. |
| Recent trades | `trades.ts` `rlFetch` + schema | `GET /defi/v3/txs/recent` | Existing schema in repo | Existing Zod schema | ✓ MIGRATED (rlFetch + validateApiResult) | Transport swapped from plain `fetch` to `rlFetch` with `bds.limiter`. |
| Top traders | `trades.ts` `rlFetch` + schema | `GET /trader/gainers-losers` | Existing schema in repo | Existing Zod schema | ✓ MIGRATED (rlFetch + validateApiResult) | Transport swapped from plain `fetch` to `rlFetch` with `bds.limiter`. |
| History price | `token-chart.ts` (`fetchHistoricalRange`), `birdeye-chart-data.ts` (`fetchAndStoreBirdeyeRange`) | `/defi/history_price` | ✓ Verified | ✓ bds_HistoryPriceSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Both call sites already on the standard path. |
| Price at timestamp | `transactions.ts` and `resolve-token-price.ts`, both `fetchBirdeyePriceAtTimestampUsd` (duplicated) | `GET /defi/price` | ✓ Verified | ✓ bds_PriceAtTimestampSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Duplicated implementations remain, but both now use the shared schema and `bds.limiter`. |
| Wallet net-worth history/detail | `walletDataFetcher.service.ts` direct Birdeye calls | `GET /wallet/v2/net-worth`, `GET /wallet/v2/net-worth-details` | Existing implementation | ✓ bds_WalletNetworthHistorySchema, ✓ bds_WalletNetAssetsSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Removed `birdeye.client.ts`, `fetchBirdeyeJson`, and `requestProviderJson<T>` wrapper path. |

### Moralis

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Token top holders | Replaced; no current token-holder use | Deprecated Solana top-holders path | Deprecated for Solana | Legacy type only | Do not invest in this path. Current holder rows and holder stats use Mobula `holder-positions`. |
| Holder metrics | Not used | Provided holder-metrics docs | Needs verification only if reintroduced | Missing | Do not add unless a service has a concrete need after Mobula holder stats are evaluated. |
| Wallet swaps | old wallet fetcher Moralis path (`fetchMoralisSolanaSwap`) | `GET /account/{network}/{address}/swaps` | Verified from provided docs | ✓ mrl_WalletTokenSwapsSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Uses the wallet-specific cursor schema from `wallet-raw-responses.ts`. |

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
| Wallet transfers | old wallet fetcher Helius path (`fetchHeliusSolanaTransfers`) | Provided wallet transfers docs | ✓ Verified | ✓ helius_WalletTransfersSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Removed active `heliusGetJson` consumer; preserves empty-page fallback with TODO for stronger error handling. |
| Wallet funded-by | wallet first-fund path (`fetchHeliusWalletFirstFund`) | Provided funded-by docs / existing local DTO | ✓ Verified from local DTO shape | ✓ helius_WalletFundedBySchema | ✓ MIGRATED (rlFetch + validateApiResult) | Schema now matches the flat `HeliusWalletFirstFund` DTO returned by this service instead of the previously unused aggregate shape. |
| Wallet history | `walletDataFetcher.service.ts` (`fetchAllTransactionHistoryChunk`, `fetchAllTransactionHistory`) | `GET /v1/wallet/{address}/history` | Existing implementation | ✓ helius_WalletHistorySchema | ✓ MIGRATED (rlFetch + validateApiResult) | Both history call sites now validate page data and pagination at the provider boundary. |
| Address transactions | `helius-tx-fetcher.ts`, `modules/wallet-analysis/services/walletTransactionFetcher.ts` | `GET /v0/addresses/{address}/transactions` | Existing implementation | ✓ helius_EnhancedTransactionsSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Both active call sites now use `rlFetch` with the Helius limiter and the strict expanded enhanced transaction schema. |
| Wallet balances | Helius portfolio fetch (`fetchHeliusSolanaPortfolio`) | `GET /v1/wallet/{address}/balances` | Existing schema in repo | Existing Zod schema | ✓ MIGRATED (rlFetch + validateApiResult) | Added a new `limiter` (Bottleneck) to `util-helius.ts` — none existed before — sized for Helius free-tier Enhanced/REST API limit (2 req/s); raise if project is on a paid tier. |
| Enhanced transaction fetch | `transactions.ts` | Helius enhanced-transactions endpoint | Not previously tracked | ✓ helius_EnhancedTransactionsSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Direct `heliusFetch` use and response cast removed; schema is strict at the provider boundary. |
| Wallet identity | `walletIdentity.service.ts` | Helius wallet identity/batch-identity endpoints | Not previously tracked | ✓ hls_WalletIdentitySchema, hls_WalletIdentityBatchSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Direct `heliusFetch` use removed. Batch normalization still preserves flexible provider response shapes. |

### DexPaprika

| Area | Current use | REST endpoint | Verification | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Top pools on network | `token-market-pools.ts` DexPaprika fallback | `GET /networks/{network}/pools` | ✓ Verified | ✓ local dexPaprikaPoolsResponseSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Added local limiter and validated the actual DexPaprika pool-list response shape used by the mapper. |

### Legacy / Lower Priority Provider Fetches

| Area | Current use | Provider | Current path | Schema status | Notes |
| --- | --- | --- | --- | --- | --- |
| Legacy balances service | `balances.ts`, `routes/balances.ts`, `util-sim.ts` | SIM | `GET /balances/{wallet}` | Removed | Removed | SIM provider and route were fully deprecated. |
| Legacy transfers service | `transfers.ts`, `transfers.deprecated.ts`, `routes/transfers.ts`, `util-bitquery.ts` | Bitquery | GraphQL POST | Removed | Removed | Bitquery provider and route were fully deprecated. |
| Legacy duplicate pool service | `pools.ts` | CoinGecko | Onchain pools and pool trades | Local interfaces only | Removed | Duplicate surface beside cache-backed token pool services; no active imports found. |
| Zerion fungible ID lookup | `walletTokenBalance.service.ts` rlFetch | Zerion | `GET /fungibles/` | ✓ zrn_FungiblesResponseSchema | ✓ MIGRATED (rlFetch + validateApiResult) | Nearby wallet chart path already used `rlFetch` with `zrn.limiter`; fungible lookup now does too. |

### Explicitly Deferred Plain Fetches

These are visible in fetch audits but should not block provider API standardization unless their owning feature asks for it:

- `heliusWebhooks.service.ts`: Helius webhook management API; operational webhook lifecycle, not regular data provider fetch.
- `walletAlerts.service.ts`: Discord webhook call.
- `rss-news.service.ts`, `brave-news.service.ts`, `chat-web-search.ts`, `news.service.ts`, `tokens/token-chart-news-summary.ts`: news/search/proxy-style fetches with different failure semantics.
- `transactions.raw-parser.ts`: Solana RPC fetch.
- `wash-trading.service.ts`, `wash-trading-ai.service.ts`, `walletAnalysis.service.ts`: local/internal or AI analysis HTTP calls.
- `routes/misc.ts` image proxy: arbitrary external image proxy, not a provider API response schema candidate.

## Open Questions

- [ ] Should the old tracker internals be revived inside `rlFetch`? Current standard names are `rlFetch` and `validateApiResult`; `trackedFetch` has no active consumers.
- [ ] Should provider utilities expose limiters for all providers? CoinGecko, Birdeye, Mobula, Moralis, Helius, and Zerion already expose limiters; DexPaprika and SIM/Bitquery legacy paths do not.
- [ ] Should legacy Helius/Moralis wallet activity paths be deleted once Mobula activity is stable?
- [ ] For DexPaprika, is sorting top pools by `last_price_change_usd_24h` an acceptable approximation for gainers/losers, or should this feature use another endpoint/provider?
- [ ] Should `token_holder_stats` remain as the long-term Mobula holder snapshot stats cache, or should holder count/distribution move into a dedicated holder snapshot metadata table?

## Suggested Small Batches

### Batch 1: Low-risk existing schemas

- [x] CoinGecko market chart paths: use existing `cg_TokenMarketChartSchema`.
- [x] Birdeye recent trades/top traders: keep schemas, replace plain `fetch` with `rlFetch`.
- [x] Helius wallet balances: keep `hls_WalletBalancesSchema`, replace `heliusFetch` with `rlFetch` (new `limiter` added to `util-helius.ts`, sized for free-tier 2 req/s).

### Batch 2: CoinGecko SDK removal

- [x] Add schema for `coins/list`.
- [x] Add schema for `coins/markets`.
- [x] Add schema for `coins/{id}`.
- [x] Add schema for onchain token info.
- [x] Replace `cg.client` call sites with REST calls. Covers search (`search.ts`, `chat-token-search.ts`), onchain pool search (`search.ts`), and markets (`token-top-marketcap.ts`); also deleted dead duplicate SDK-based logic in `routes/search.ts`.

### Batch 3: Search and pool data

- [x] Verify CoinGecko search endpoint shapes.
- [x] Verify CoinGecko onchain pool search shape.
- [x] Add/reuse schemas for cache-backed top pools, pool detail, pool trades, and exchange logos.
- [x] Replace search/pool-search casts (done for `search.ts`/`chat-token-search.ts`). Cache-backed pool-detail/top-pools casts in `token-pools.ts` and pool-trades casts in `token-trades.ts` are also migrated.
- [x] Migrate broader market pools and remove legacy duplicate pool surface (`token-market-pools.ts`, `pools.ts`).

### Batch 4: Legacy provider wrappers

- [x] Migrate direct Moralis wallet swap path to `rlFetch` + `mrl_WalletTokenSwapsSchema`.
- [x] Migrate active Helius wallet history/transfers/funded-by and address transaction paths to `rlFetch` + schemas.
- [x] Remove dead `heliusGetJson` wrapper and `heliusFetch`.
- [x] Remove or migrate remaining `requestProviderJson<T>`/Birdeye wallet provider wrapper.
- [x] Retire `heliusFetch`, `moralisFetch`, and `requestProviderJson<T>` after wrapper consumers are gone.

### Batch 5: Non-wallet supporting providers

- [x] Add Birdeye trending schema.
- [x] Move token holder rows and distribution from Moralis/CoinGecko to Mobula holder positions.
- [ ] Remove or archive legacy Moralis holder response type if no other code uses it.
- [x] Add DexPaprika pools schema.
- [ ] Wire DexPaprika pools schema into `token-market-pools.ts` and review the gainer/loser approximation.
