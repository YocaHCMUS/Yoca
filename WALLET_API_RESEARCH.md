# Wallet Pages API Research & Setup Guide

## Overview
This document provides a comprehensive guide for integrating Birdeye and Moralis APIs to replace mock data in the Wallet pages (`/wallets/:address` and `/comparision/wallets`).

## Data Requirements Analysis

Based on the UI specifications and current codebase, the following data points need to be fetched:

### A. Wallet Overview & Summary Metrics (WalletOverview component)
1. **Total Balance (USD)** - `totalAssetValue`
2. **Trading Volume (USD)** - `tradingVolumn` (with timeframes: 7D, 30D, 3M, 6M)
3. **Profit & Loss (USD)** - `totalPnL` (with timeframes: 7D, 30D, 3M, 6M)
4. **Transaction Count** - `transactionCount` (with timeframes: 7D, 30D, 3M, 6M)
5. **Unique Tokens Traded** - `tokenTraded` (with timeframes: 7D, 30D, 3M, 6M)
6. **Unique Tokens Currently Holding** - `numberOfTokenHolding`
7. **Wallet Name/Label** - `name` (community label)
8. **Wallet Tags** - `tags` (e.g., "whale", "OpenSea user", etc.)

### B. History & Trends (Charts)
1. **Wallet Balance History** - For BalanceChart component (7D, 30D, 3M, 6M or flexible)
2. **Token Balance History** - Individual token balance over time
3. **Profit & Loss History** - For PnLChart component (daily and cumulative)

### C. Transaction Details (Transaction Tables)
1. **Transaction History** - Transfer, Swap, Inflow, Outflow transactions
   - Fields: Time, From (ADDRESS), To (ADDRESS), Value, Token, USD value
   - Additional: Token sold, Token bought (for swaps)

### D. Counterparties & Associated Wallets
1. **Counterparties** - Wallets who traded with this wallet
   - Fields: Address, Chain, Transaction count, USD value, Token name

### E. Token Holdings (Portfolio Table)
1. **List of Currently Holding Tokens**
   - Fields: Token, Price, Holding (amount), Value (USD), Changes (24h %)

### F. Exchange Services & Wallet Transactions
1. **List of Exchange Services (CEX)** - Used for transactions
   - Fields: Deposit, Withdrawal
2. **List of Wallet Transactions with the Wallet**
   - Fields: Transaction count, Transaction value

---

## API Mapping: Birdeye vs Moralis

### **Birdeye API (Solana-focused)**

#### ✅ **Available Endpoints:**

1. **Wallet - Current Net Worth**
   - **Endpoint:** `GET /wallet/v2/current-net-worth`
   - **Base URL:** `https://public-api.birdeye.so`
   - **Authentication:** `X-API-KEY` header
   - **Chain:** Solana only
   - **Provides:**
     - ✅ Total balance (USD) - `data.total_value`
     - ✅ Current token holdings - `data.items[]` (token, balance, price, value)
     - ✅ Token count - Count of `data.items[]`
   - **Parameters:**
     - `wallet` (required): Wallet address
     - `filter_value` (optional): Filter assets by minimum USD value
     - `sort_by` (optional): Sort field (default: "value")
     - `sort_type` (required): "asc" or "desc"
     - `limit` (optional): Max 100, default 20
     - `offset` (optional): Max 10000
   - **Response Example:**
     ```json
     {
       "success": true,
       "data": {
         "wallet_address": "...",
         "currency": "usd",
         "total_value": "14198.9",
         "current_timestamp": "2025-05-19T04:47:19.414327725Z",
         "items": [
           {
             "address": "...",
             "decimals": 6,
             "price": 0.000149,
             "balance": "69000000",
             "amount": 69,
             "network": "solana",
             "name": "Token Name",
             "symbol": "SYMBOL",
             "logo_uri": "...",
             "value": "0.010349"
           }
         ]
       }
     }
     ```

2. **Wallet - Net Worth Chart**
   - **Endpoint:** `GET /wallet/v2/net-worth`
   - **Provides:**
     - ✅ Historical balance data - `data.history[]` (timestamp, net_worth, net_worth_change, net_worth_change_percent)
   - **Parameters:**
     - `wallet` (required): Wallet address
     - `count` (optional): Number of intervals (1-30, default: 7)
     - `type` (optional): "1h" (hourly) or "1d" (daily, default)
     - `direction` (optional): "back" (default) or "forward"
     - `time` (optional): Base timestamp in ISO 8601 UTC format
     - `sort_type` (required): "asc" or "desc"
   - **Use Case:** Balance history charts (7D, 30D, 3M, 6M)

3. **Wallet - PnL (Per Token)**
   - **Endpoint:** `GET /wallet/v2/pnl`
   - **Note:** ⚠️ **DEPRECATED** - Check for newer endpoint
   - **Provides:**
     - ✅ PnL per token (realized, unrealized, total)
     - ✅ Trade counts (buy, sell, total)
     - ✅ Average buy/sell prices
   - **Parameters:**
     - `wallet` (required): Wallet address
     - `token_addresses` (required): Comma-separated token addresses (max 50)

4. **Wallet Transaction History (Beta)**
   - **Endpoint:** `GET /v1/wallet/tx_list`
   - **Provides:**
     - ✅ Transaction list with details
     - ✅ Transaction hash, block number, block time
     - ✅ From/To addresses
     - ✅ Transaction status
     - ✅ Fee information
     - ✅ Main action type
     - ✅ Balance changes (tokens involved)
     - ✅ Contract labels (for DEX/contract interactions)
   - **Parameters:**
     - `wallet` (required): Wallet address
     - `limit` (optional): Number of transactions (default: all)
     - `before` (optional): Pagination cursor (transaction hash)
   - **Headers:**
     - `x-chain` (required): Chain identifier (solana, ethereum, etc.)
     - `X-API-KEY` (required): API key
   - **Chain:** Multi-chain support, but `limit` and `before` pagination currently only work on Solana
   - **Response Structure:**
     ```json
     {
       "success": true,
       "data": {
         "solana": [
           {
             "txHash": "...",
             "blockNumber": 254997395,
             "blockTime": "2024-03-18T20:32:31+00:00",
             "status": true,
             "from": "...",
             "to": "...",
             "fee": 21000,
             "mainAction": "unknown",
             "balanceChange": [
               {
                 "amount": 0,
                 "symbol": "SOL",
                 "name": "Wrapped SOL",
                 "decimals": 9,
                 "address": "...",
                 "logoURI": "..."
               }
             ],
             "contractLabel": {
               "address": "...",
               "name": "Bubblegum",
               "metadata": { "icon": "" }
             }
           }
         ]
       }
     }
     ```

#### ❌ **Missing/Unavailable in Birdeye:**
- Trading volume aggregation (7D, 30D, 3M, 6M) - Need to calculate from transactions
- Counterparties analysis - Need to extract from transaction history
- Exchange service identification (CEX) - Need to identify from transaction patterns
- Wallet labels/tags - Not provided by Birdeye
- Decoded transaction categories (swap, transfer, etc.) - Limited categorization

---

### **Moralis API (Multi-chain, EVM-focused)**

#### ✅ **Available Endpoints:**

1. **Get Wallet Transaction History**
   - **Endpoint:** `GET /api/v2.2/wallets/:address/history`
   - **Base URL:** `https://deep-index.moralis.io`
   - **Authentication:** `X-API-Key` header
   - **Chains:** EVM chains (Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, etc.)
   - **Provides:**
     - ✅ Complete decoded transaction history
     - ✅ Transaction categorization (15+ categories: Token Swap, NFT Sale, Mint, Burn, etc.)
     - ✅ From/To addresses with entity labels (e.g., "Opensea", "Binance")
     - ✅ ERC20 transfers - `erc20_transfers[]`
     - ✅ Native transfers - `native_transfers[]`
     - ✅ NFT transfers - `nft_transfers[]`
     - ✅ Internal transactions - `internal_transactions[]`
     - ✅ Transaction timestamps
     - ✅ USD values (can be calculated from token prices)
   - **Parameters:**
     - `address` (path): Wallet address
     - `chain` (query): Chain identifier (eth, polygon, bsc, etc.)
     - `from_date` / `to_date`: Date range filtering
     - `from_block` / `to_block`: Block range filtering
     - `order`: "ASC" or "DESC" (default: "DESC")
     - `limit`: Page size (default: 25)
     - `cursor`: Pagination cursor
     - `include_internal_transactions`: boolean
     - `nft_metadata`: boolean
   - **Response Example:**
     ```json
     {
       "page": "2",
       "page_size": "100",
       "cursor": "",
       "result": [
         {
           "hash": "0x...",
           "from_address": "0x...",
           "from_address_entity": "Opensea",
           "to_address": "0x...",
           "to_address_entity": "Beaver Build",
           "value": "115580000000000000",
           "block_timestamp": "2021-05-07T11:08:35.000Z",
           "category": "token_swap",
           "erc20_transfers": [...],
           "native_transfers": [...],
           "nft_transfers": [...]
         }
       ]
     }
     ```

2. **Get Wallet Token Balances**
   - **Endpoint:** `GET /api/v2.2/:address/erc20`
   - **Provides:**
     - ✅ Current token balances
     - ✅ Token metadata (name, symbol, decimals, logo)
   - **Note:** Does not include prices - need separate price API

3. **Get Wallet Token Balances with Prices**
   - **Endpoint:** `GET /api/v2.2/:address/erc20/price`
   - **Provides:**
     - ✅ Token balances with current USD prices
     - ✅ Total portfolio value

#### ❌ **Missing/Unavailable in Moralis:**
- Historical balance charts - Need to calculate from transaction history
- PnL calculations - Need to calculate from buy/sell transactions
- Trading volume aggregation - Need to calculate from transactions
- Net worth history - Need to calculate from balance snapshots
- Solana support - Moralis primarily supports EVM chains

---

## Recommended API Strategy

### **Hybrid Approach: Birdeye + Moralis**

#### **For Solana Wallets:**
- **Primary:** Birdeye API
  - Current net worth & portfolio
  - Historical balance charts
  - Transaction history
- **Secondary:** Calculate from transaction data
  - Trading volume (aggregate from transactions)
  - PnL (calculate from buy/sell prices)
  - Counterparties (extract from transaction history)

#### **For EVM Wallets (Ethereum, Polygon, BSC, etc.):**
- **Primary:** Moralis API
  - Transaction history with categorization
  - Token balances with prices
  - Decoded transaction details
- **Secondary:** Calculate from transaction data
  - Historical balance charts
  - Trading volume
  - PnL calculations
  - Counterparties

---

## Data Mapping to Components

### **1. WalletOverview Component** (`client/src/components/wallet/WalletOverview/WalletOverview.tsx`)

| Data Field | Birdeye API | Moralis API | Calculation Needed |
|------------|-------------|-------------|-------------------|
| `totalAssetValue` | ✅ `/wallet/v2/current-net-worth` → `data.total_value` | ✅ `/api/v2.2/:address/erc20/price` → Sum values | - |
| `tradingVolumn` | ❌ Calculate from `/v1/wallet/tx_list` | ❌ Calculate from `/api/v2.2/wallets/:address/history` | Sum USD values of transactions in timeframe |
| `totalPnL` | ⚠️ `/wallet/v2/pnl` (deprecated) | ❌ Calculate from transaction history | Track buy/sell prices, calculate profit/loss |
| `transactionCount` | ✅ `/v1/wallet/tx_list` → Count | ✅ `/api/v2.2/wallets/:address/history` → `result.length` | Filter by timeframe |
| `tokenTraded` | ✅ Extract unique tokens from `/v1/wallet/tx_list` | ✅ Extract unique tokens from transaction history | Count unique tokens in timeframe |
| `numberOfTokenHolding` | ✅ `/wallet/v2/current-net-worth` → `data.items.length` | ✅ `/api/v2.2/:address/erc20` → Count | - |
| `name` | ❌ Not provided | ❌ Not provided | Store in database or use address |
| `tags` | ❌ Not provided | ⚠️ Entity labels in transactions | Extract from transaction patterns or store in DB |

### **2. BalanceChart Component** (`client/src/components/charts/BalanceChart/BalanceChart.tsx`)

| Data Field | Birdeye API | Moralis API | Calculation Needed |
|------------|-------------|-------------|-------------------|
| Historical balance data | ✅ `/wallet/v2/net-worth` → `data.history[]` | ❌ Not provided | Calculate from transaction history + current balance |
| Token-specific balance | ❌ Not directly provided | ❌ Not directly provided | Track token balance changes over time |

### **3. PnLChart Component** (`client/src/components/charts/PnLChart/PnLChart.tsx`)

| Data Field | Birdeye API | Moralis API | Calculation Needed |
|------------|-------------|-------------|-------------------|
| Daily PnL | ⚠️ `/wallet/v2/pnl` (deprecated) | ❌ Not provided | Calculate from buy/sell transactions per day |
| Cumulative PnL | ⚠️ `/wallet/v2/pnl` (deprecated) | ❌ Not provided | Sum daily PnL over time |

### **4. Transaction Tables** (`client/src/pages/wallet/index.tsx`)

| Data Field | Birdeye API | Moralis API | Calculation Needed |
|------------|-------------|-------------|-------------------|
| Transfer transactions | ✅ `/v1/wallet/tx_list` → Filter by type | ✅ `/api/v2.2/wallets/:address/history` → Filter `category` | - |
| Swap transactions | ✅ `/v1/wallet/tx_list` → Filter by type | ✅ `/api/v2.2/wallets/:address/history` → `category: "token_swap"` | - |
| Inflow/Outflow | ✅ `/v1/wallet/tx_list` → Filter by direction | ✅ `/api/v2.2/wallets/:address/history` → Filter by direction | - |
| Counterparties | ❌ Extract from transactions | ✅ Extract from `from_address`/`to_address` with entities | Group by address, count transactions |

### **5. Portfolio Table** (`client/src/pages/wallet/index.tsx`)

| Data Field | Birdeye API | Moralis API | Calculation Needed |
|------------|-------------|-------------|-------------------|
| Token list | ✅ `/wallet/v2/current-net-worth` → `data.items[]` | ✅ `/api/v2.2/:address/erc20/price` | - |
| Token price | ✅ `data.items[].price` | ✅ Included in price endpoint | - |
| Holding amount | ✅ `data.items[].amount` | ✅ Token balance | - |
| USD value | ✅ `data.items[].value` | ✅ Included in price endpoint | - |
| 24h change | ❌ Not provided | ❌ Not provided | Fetch from price history API |

### **6. Exchange Comparison** (`client/src/components/charts/ExchangeComparison/ExchangeComparison.tsx`)

| Data Field | Birdeye API | Moralis API | Calculation Needed |
|------------|-------------|-------------|-------------------|
| Exchange identification | ❌ Not provided | ✅ `from_address_entity` / `to_address_entity` | Extract from transaction entities |
| Deposit/Withdrawal | ❌ Not provided | ✅ Filter transactions by direction and entity | Group transactions by exchange |

---

## Implementation Strategy

### **Phase 1: API Integration Setup**

1. **Environment Configuration**
   - Add API keys to `.env`:
     ```
     BIRDEYE_API_KEY=your_birdeye_api_key
     MORALIS_API_KEY=your_moralis_api_key
     ```
   - Create utility files similar to existing pattern (see `server/src/util/util-coingecko.ts`):
     - `server/src/util/util-birdeye.ts`
     - `server/src/util/util-moralis.ts`

2. **Backend API Endpoints**
   - Create new endpoints in `server/src/main.ts`:
     - `/api/wallet/:address/overview` - Get wallet overview data
     - `/api/wallet/:address/balance-history` - Get historical balance
     - `/api/wallet/:address/transactions` - Get transaction history
     - `/api/wallet/:address/portfolio` - Get current holdings
     - `/api/wallet/:address/pnl` - Get PnL data
     - `/api/wallet/:address/counterparties` - Get counterparties

3. **Database Schema** (for caching)
   - **Existing Schema:** Already have `wallets` and `walletBalances` tables (see `server/src/db/schema.ts`)
   - **Existing Pattern:** Caching pattern already implemented in `server/src/services/balances.ts` using TTL
   - **Additional Tables Needed:**
     - `wallet_overview_cache` - Cache overview metrics (total balance, trading volume, PnL, etc.)
     - `wallet_balance_history` - Cache historical balance snapshots
     - `wallet_transactions` - Cache transaction history
     - `wallet_counterparties` - Cache counterparty analysis
   - **TTL Strategy:** Follow existing pattern using `WALLET_BALANCES_TTL_MS` constant (check `server/src/config/constants.ts`)

### **Phase 2: Data Fetching Logic**

1. **Database-First Approach**
   - Check database for cached data
   - If exists and fresh (< 5 minutes old), return cached data
   - If missing or stale, fetch from API
   - Store API response in database
   - Return data to frontend

2. **API Service Functions**
   - Create service files:
     - `server/src/services/birdeye.service.ts`
     - `server/src/services/moralis.service.ts`
     - `server/src/services/walletData.service.ts` (orchestrator)

### **Phase 3: Frontend Integration**

1. **Create Custom Hooks**
   - `client/src/hooks/useWalletOverview.ts`
   - `client/src/hooks/useWalletTransactions.ts`
   - `client/src/hooks/useWalletPortfolio.ts`

2. **Update Components**
   - Replace mock data in `WalletOverview.tsx`
   - Replace mock data in `WalletPage` transaction tables
   - Update chart components to use real API data

---

## API Rate Limits & Costs

### **Birdeye**
- **Free Tier:** Limited requests per day
- **Paid Tiers:** Lite, Starter, Premium, Business, Enterprise
- **Rate Limits:** Vary by tier (check documentation)
- **Cost:** Check pricing at https://birdeye.so/pricing

### **Moralis**
- **Free Tier:** 40,000 requests/month
- **Paid Tiers:** Pro, Business, Enterprise
- **Rate Limits:** Vary by tier
- **Cost:** Check pricing at https://moralis.com/pricing

**Recommendation:** Implement caching to minimize API calls and reduce costs.

---

## Next Steps

1. **Review this document** and confirm the approach
2. **Obtain API keys** from Birdeye and Moralis
3. **Set up environment variables** in `.env` file
4. **Create backend utility files** for API integration
5. **Design database schema** for caching
6. **Implement backend endpoints** following the database-first approach
7. **Create frontend hooks** for data fetching
8. **Replace mock data** in components gradually
9. **Test with real wallet addresses**
10. **Monitor API usage** and optimize caching strategy

---

## Questions to Resolve

1. **Which chains are priority?** (Solana, Ethereum, Polygon, BSC?)
2. **What is the caching strategy?** (TTL, refresh intervals)
3. **How to handle wallet labels/tags?** (Database storage, third-party service?)
4. **How to calculate PnL accurately?** (FIFO, LIFO, average cost basis?)
5. **How to identify exchanges/CEX?** (Maintain a mapping database?)
6. **What is the fallback strategy?** (If API fails, show cached data or error?)

---

## References

- Birdeye API Documentation: https://docs.birdeye.so/
- Moralis API Documentation: https://docs.moralis.com/
- Current Codebase:
  - `client/src/pages/wallet/index.tsx`
  - `client/src/components/wallet/WalletOverview/WalletOverview.tsx`
  - `client/src/services/chart/chartApi.ts`
  - `server/src/util/util-coingecko.ts` (reference for API utility pattern)
