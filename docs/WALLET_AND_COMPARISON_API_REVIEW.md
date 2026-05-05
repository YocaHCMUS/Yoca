# Review API Wallet & Trang So sánh ví

Tài liệu review toàn bộ API endpoint phục vụ **lấy data ví** và **phân tích hành vi ví, danh mục, số dư, PnL, token holding** cho hai đường dẫn:
- **`/wallets/:address`** – Trang chi tiết một ví
- **`/comparison/wallets`** – Trang so sánh nhiều ví

---

## 1. Tổng quan

- **Base path API:**  
  - Wallet: `GET/POST /api/wallets/...`  
  - Charts: `GET /api/charts/...`
- **Không có route riêng** `/api/comparison/wallets`. So sánh nhiều ví thực hiện bằng cách truyền **nhiều địa chỉ** trong query (ví dụ `wallets=addr1,addr2`) cho từng chart/API tương ứng.
- **Chain:** Mặc định `solana`; một số endpoint hỗ trợ query `chain`.

---

## 2. API Endpoint – Nhóm Wallet (`/api/wallets`)

| Endpoint | Method | Mô tả ngắn | Trạng thái |
|----------|--------|------------|------------|
| `/overview` | GET | Tổng quan: total value, volume 24h, PnL, số giao dịch, số token | ✅ Có data thật |
| `/portfolio` | GET | Danh mục token: symbol, price, holding, valueUsd, change24h | ✅ Có data thật |
| `/transactions` | GET | Lịch sử giao dịch (cursor, limit, before) | ✅ Có data thật |
| `/transfers` | GET | Lịch sử chuyển (cursor, limit, before) | ✅ Có data thật |
| `/swap` | GET | Lịch sử swap (cursor, limit, before) | ✅ Có data thật |
| `/distribution` | GET | Phân bố tài sản (từ portfolio), % theo USD | ✅ Có data thật (1 ví) |
| `/exchanges` | GET | Số lần deposit/withdraw theo sàn (limit) | ✅ Có data thật |
| `/counterparties` | GET | Đối tác giao dịch, volume, số giao dịch (period, limit) | ✅ Có data thật |
| `/identity` | GET | Nhận dạng ví (known/unknown, name, category) | ✅ Có data thật |
| `/identity/batch` | POST | Identity cho nhiều địa chỉ (body: addresses[]) | ✅ Có data thật |
| `/intelligence` | GET | Tổng hợp identity + analysis (risk level, v.v.) | ✅ Có data thật |

### 2.1. Cách gọi chi tiết

**Overview**
```http
GET /api/wallets/overview?address=<wallet_address>&chain=solana&period=24h
```
- `period`: tùy chọn (ví dụ `24h`, `7d`); mặc định 24h; hỗ trợ dạng `Nd` (ngày) hoặc `Nh` (giờ).

**Portfolio**
```http
GET /api/wallets/portfolio?address=<wallet_address>&chain=solana
```

**Transactions**
```http
GET /api/wallets/transactions?address=<wallet_address>&chain=solana&limit=50&cursor=<cursor>&before=<timestamp>
```

**Transfers**
```http
GET /api/wallets/transfers?address=<wallet_address>&chain=solana&limit=50&cursor=&before=
```

**Swap**
```http
GET /api/wallets/swap?address=<wallet_address>&chain=solana&limit=50&cursor=&before=
```

**Distribution**
```http
GET /api/wallets/distribution?address=<wallet_address>&chain=solana
```
- Response: `data[]` (name, value, percentage, rawAmount), `totalValue`, `address`, `chain`, `metadata`.

**Exchanges**
```http
GET /api/wallets/exchanges?address=<wallet_address>&chain=solana&limit=
```
- Response: danh sách exchange với deposits/withdrawals (count hoặc volume tùy backend).

**Counterparties**
```http
GET /api/wallets/counterparties?address=<wallet_address>&chain=solana&period=7d&limit=20&includeTokens=true
```
- `period`: `24h` | `7d`. Response: `counterparties[]`, `rankings.byTransactionCount`, `rankings.byVolume`, `metadata`.

**Identity**
```http
GET /api/wallets/identity?address=<wallet_address>&chain=solana
```

**Identity batch**
```http
POST /api/wallets/identity/batch
Content-Type: application/json
{"addresses": ["addr1","addr2"], "chain": "solana"}
```

**Intelligence**
```http
GET /api/wallets/intelligence?address=<wallet_address>&chain=solana
```

---

## 3. API Endpoint – Nhóm Chart (`/api/charts/...`)

Các chart dùng chung cho cả trang **một ví** và **so sánh nhiều ví** (khi truyền `wallets=addr1,addr2`).

| Endpoint | Query chính | Data thật / Mock | Ghi chú |
|----------|-------------|------------------|--------|
| `GET /api/charts/balance` | timePeriod, tokens, wallets | ✅ Thật (wallet balance/token history) | Nhiều ví → nhiều series |
| `GET /api/charts/pnl` | period, wallets, aggregation | ✅ Thật (pnlChart.service) | Nhiều ví hỗ trợ |
| `GET /api/charts/distribution` | period, wallets | ✅ 1 ví thật; nhiều ví → mock | Cần bổ sung multi-wallet thật |
| `GET /api/charts/counterparties` | timePeriod, wallets, limit | ✅ Thật (1 wallet – lấy address hoặc wallets[0]) | Chưa trả multi-wallet riêng từng ví |
| `GET /api/charts/exchanges` | timePeriod, metric | ❌ Mock only | **Không nhận wallet** → không theo ví |
| `GET /api/charts/dailyTradingVolume` | period, wallets | ✅ Thật (dailyTradingVolume.service) | Nhiều ví |
| `GET /api/charts/totalTradingVolume` | period, wallets | ✅ Thật (totalTradingVolume.service) | Nhiều ví |
| `GET /api/charts/tradingVolumeDistribution` | period, wallets | ❌ Mock | Cần data từ swap/transfer theo token |
| `GET /api/charts/tradingVolumePerTransaction` | period, wallets, type | ❌ Mock | Cần volume per tx từ swap/transfer |
| `GET /api/charts/holdings` | walletIds, topN, timeUnit | ❌ Mock | Cần holding duration từ balance/token history |
| `GET /api/charts/stablecoinRatio` | period, wallets | ❌ Mock | Cần portfolio + balance history theo thời gian |
| `GET /api/charts/rollingAnnualReturn` | wallets, period, timeUnit | ❌ Mock | Cần PnL/return theo kỳ |
| `GET /api/charts/averageRollingAnnualReturn` | wallets, period, timeUnit | ❌ Mock | Cần PnL/return theo kỳ |
| `GET /api/charts/winrate` | period, wallets | ❌ Mock | Cần trade win/loss từ swap |
| `GET /api/charts/drawdown` | period, wallets | ❌ Mock | Cần equity curve từ balance/PnL |

### 3.1. Cách gọi Chart (ví dụ)

**Balance (lịch sử số dư)**
```http
GET /api/charts/balance?timePeriod=7D&wallets=<addr1>&tokens=
GET /api/charts/balance?timePeriod=30D&wallets=addr1,addr2
```
- Có `tokens`: trả lịch sử theo token (units + USD). Không có: tổng balance USD.

**PnL**
```http
GET /api/charts/pnl?period=7D&wallets=addr1,addr2&aggregation=daily
```

**Distribution**
```http
GET /api/charts/distribution?period=30D&wallets=addr1
GET /api/charts/distribution?period=30D&wallets=addr1,addr2
```
- Nhiều ví hiện trả mock.

**Counterparties (chart)**
```http
GET /api/charts/counterparties?timePeriod=7D&wallets=addr1&limit=10
```
- Backend chỉ dùng 1 địa chỉ (address hoặc phần tử đầu của `wallets`).

**Exchanges (chart)**
```http
GET /api/charts/exchanges?timePeriod=30D&metric=count
```
- Không có tham số wallet → luôn mock / không gắn ví.

**Daily Trading Volume**
```http
GET /api/charts/dailyTradingVolume?period=30D&wallets=addr1,addr2
```

**Total Trading Volume**
```http
GET /api/charts/totalTradingVolume?period=30D&wallets=addr1,addr2
```

**Trading Volume Distribution**
```http
GET /api/charts/tradingVolumeDistribution?period=30D&wallets=addr1,addr2
```
- Hiện mock.

**Trading Volume Per Transaction**
```http
GET /api/charts/tradingVolumePerTransaction?period=30D&wallets=addr1,addr2&type=all
```
- Hiện mock.

**Holdings (holding duration)**
```http
GET /api/charts/holdings?walletIds=addr1,addr2&topN=10&timeUnit=days
```
- Client có thể map `wallets` → `walletIds`. Hiện mock.

**Stablecoin Ratio**
```http
GET /api/charts/stablecoinRatio?period=30D&wallets=addr1,addr2
```
- Hiện mock.

**Rolling / Average Rolling Annual Return**
```http
GET /api/charts/rollingAnnualReturn?wallets=addr1,addr2&period=1Y&timeUnit=month
GET /api/charts/averageRollingAnnualReturn?wallets=addr1,addr2&period=1Y&timeUnit=month
```
- Hiện mock.

**Winrate**
```http
GET /api/charts/winrate?period=30D&wallets=addr1,addr2
```
- Hiện mock.

**Drawdown**
```http
GET /api/charts/drawdown?period=90D&wallets=addr1,addr2
```
- Hiện mock.

---

## 4. API chưa hoàn thiện / thiếu

### 4.1. Chưa gắn wallet / chỉ mock
- **`GET /api/charts/exchanges`**  
  - Thiếu: query `wallets` (hoặc `address`).  
  - Backend đang dùng `generateExchangeData(timePeriod, metric)` → mock.  
  - Cần: gọi `getWalletExchangeCounts(address, chain)` (đã có ở `/api/wallets/exchanges`) và format lại cho chart; hỗ trợ nhiều ví cho comparison.

### 4.2. Nhận wallet nhưng multi-wallet chưa dùng data thật
- **`GET /api/charts/distribution`**  
  - 1 ví: đã dùng `getWalletPortfolio` → thật.  
  - Nhiều ví: đang fallback `generateAssetDistribution(period, wallets)` → mock.  
  - Cần: với từng ví gọi portfolio (hoặc API aggregate), trả `wallets: [{ walletAddress, data[], totalValue }]`.

### 4.3. Chỉ mock, chưa có backend thật
- **Trading Volume Distribution**  
  Cần: aggregate volume theo token (và theo ví) từ swap/transfer trong khoảng period.
- **Trading Volume Per Transaction**  
  Cần: từ swap/transfer tính volume từng giao dịch → thống kê (min/q1/median/q3/max) theo deposits/withdrawals.
- **Holdings (Holding Durations)**  
  Cần: từ balance history / token history tính thời gian giữ từng token (top N) theo ví.
- **Stablecoin Ratio**  
  Cần: time series tỷ lệ stablecoin/total portfolio từ portfolio + balance history theo ngày.
- **Rolling Annual Return / Average Rolling Annual Return**  
  Cần: chuỗi PnL/return theo tháng (hoặc quarter/year), tính rolling return 12 tháng.
- **Winrate**  
  Cần: từ swap (hoặc trade) đếm win/loss, tính % và phân bố magnitude.
- **Drawdown**  
  Cần: từ balance hoặc PnL theo ngày tính equity curve → drawdown từ peak.

### 4.4. Chart Counterparties
- Chỉ dùng **một** wallet (address hoặc phần tử đầu của `wallets`).  
- Trang comparison cần: trả theo từng ví (ví dụ `wallets: [{ walletAddress, counterparties[], rankings }]`) hoặc API riêng nhận nhiều ví.

---

## 5. Ánh xạ Chart → API (2 trang)

### 5.1. Trang `/wallets/:address`

| Section / Tab | Component | API dùng | Params | Ghi chú |
|---------------|-----------|----------|--------|--------|
| Header | WalletOverview | GET /api/wallets/overview, /intelligence | address, period | Thật |
| Activity | BalanceChart (total) | GET /api/charts/balance | timePeriod, wallets=[address] | Thật |
| Activity | BalanceChart (token) | GET /api/charts/balance | timePeriod, wallets, tokens | Thật |
| Activity | PnLChart | GET /api/charts/pnl | period, wallets=[address], aggregation | Thật |
| Activity | Tables | GET /api/wallets/swap, /transfers, /counterparties | address, limit | Thật |
| Asset | AssetDistribution | GET /api/charts/distribution | period, wallets=[address] | Thật (1 ví) |
| Asset | Portfolio table | GET /api/wallets/portfolio | address | Thật |
| Top Exchange | ExchangeComparison | GET /api/charts/exchanges | timePeriod (không có wallet) | **Mock, không theo ví** |
| Top Counterparties | CounterpartyActivity | GET /api/charts/counterparties | timePeriod, wallets=[address] | Thật (1 ví) |

### 5.2. Trang `/comparison/wallets`

| Tab | Component | API dùng | Params | Ghi chú |
|-----|-----------|----------|--------|--------|
| General | BalanceChart | GET /api/charts/balance | timePeriod=30D, wallets=addr1,addr2,... | Thật |
| General | DailyTradingVolume | GET /api/charts/dailyTradingVolume | period=30D, wallets | Thật |
| General | TotalTradingVolumeChart | GET /api/charts/totalTradingVolume | period=30D, wallets | Thật |
| General | TradingVolumeDistribution | GET /api/charts/tradingVolumeDistribution | wallets | Mock |
| General | TradingVolumePerTransaction | GET /api/charts/tradingVolumePerTransaction | wallets | Mock |
| Holdings | AssetDistribution | GET /api/charts/distribution | wallets | 1 ví thật, nhiều ví mock |
| Holdings | StablecoinRatioChart | GET /api/charts/stablecoinRatio | period=30D, wallets | Mock |
| Holdings | HoldingDurations | GET /api/charts/holdings | walletIds=wallets, topN, timeUnit | Mock |
| Risk | RollingAnnualReturn | GET /api/charts/rollingAnnualReturn | period=1Y, wallets, timeUnit | Mock |
| Risk | AverageRollingAnnualReturn | GET /api/charts/averageRollingAnnualReturn | period=1Y, wallets, timeUnit | Mock |
| Risk | PnLChart | GET /api/charts/pnl | wallets (initialWallets) | Thật |
| Risk | WinrateChart | GET /api/charts/winrate | period=30D, wallets | Mock |
| Risk | DrawdownChart | GET /api/charts/drawdown | period=90D, wallets | Mock |

---

## 6. Đề xuất data cần cho từng chart (khi chưa có API thật)

### 6.1. Exchange Comparison (chart)
- **Cần:** `exchanges: Array<{ name, deposits, withdrawals, depositsVolume?, withdrawalsVolume? }>`, `metadata: { period, metric }`.
- **Nguồn:** `GET /api/wallets/exchanges?address=...` đã có; cần chart API nhận `wallets` và gọi service theo từng ví (hoặc endpoint mới nhận nhiều ví).

### 6.2. Distribution (nhiều ví)
- **Cần:** `wallets: Array<{ walletAddress, data: [{ name, value, percentage }], totalValue }>`, `metadata`.
- **Nguồn:** Gọi `getWalletPortfolio` cho từng ví, format giống hiện tại.

### 6.3. Trading Volume Distribution
- **Cần:** Theo ví: volume USD (hoặc count) theo từng token (symbol/mint). Format: `wallets: [{ walletAddress, data: [{ name, value, percentage }], totalVolume }]`.
- **Nguồn:** Aggregate từ swap/transfer theo token trong period.

### 6.4. Trading Volume Per Transaction
- **Cần:** Theo ví: thống kê volume mỗi giao dịch (deposit/withdraw): min, q1, median, q3, max (box plot).
- **Nguồn:** Danh sách volume từng tx từ swap/transfer.

### 6.5. Holding Durations
- **Cần:** Theo ví: top N token với `durationDays` (hoặc weeks/months) – thời gian giữ trung bình hoặc lâu nhất.
- **Nguồn:** Balance history / token balance history: lần đầu có balance → lần cuối (hoặc now).

### 6.6. Stablecoin Ratio
- **Cần:** Time series `data: [{ timestamp, value }]` (ratio stablecoin/total), `currentRatio`, `averageRatio` theo ví.
- **Nguồn:** Portfolio theo ngày (hoặc balance history) → tách stablecoin (USDC, USDT, DAI...) / total.

### 6.7. Rolling / Average Rolling Annual Return
- **Cần:** Time series return (rolling 12 tháng) theo ví; average: thống kê (min, q1, median, q3, max) theo ví.
- **Nguồn:** PnL theo tháng (hoặc balance cuối kỳ) → tính return → rolling.

### 6.8. Winrate
- **Cần:** Theo ví: `winrate`, `totalTrades`, `winningTrades`, `losingTrades`, `winningDistribution`, `losingDistribution` (ranges).
- **Nguồn:** Swap/trade level: so sánh giá trị in/out hoặc PnL từng giao dịch.

### 6.9. Drawdown
- **Cần:** Theo ví: `data: [{ timestamp, value }]` (drawdown %), `maxDrawdown`, `maxDrawdownTimestamp`, `currentDrawdown`.
- **Nguồn:** Balance hoặc PnL theo ngày → equity curve → drawdown từ peak.

---

## 7. Nguồn data đề xuất cho trường còn thiếu (trang comparison/wallets)

| Trường / Chart | Nguồn đề xuất |
|----------------|----------------|
| Overview (multi-wallet) | Gọi tuần tự hoặc song song `GET /api/wallets/overview?address=...` cho từng ví; hoặc thêm endpoint batch overview. |
| Portfolio / Distribution (multi) | Đã có `getWalletPortfolio`; chart distribution cần loop theo `wallets` và trả mảng theo ví. |
| Balance history (đã có) | `getWalletBalanceHistory` / `getWalletTokenBalanceHistory` (walletData.service). |
| PnL (đã có) | `getHistoricalPnLData` (pnlChart.service). |
| Exchanges (chart) | `getWalletExchangeCounts` → format cho chart; thêm query `wallets` (hoặc nhiều request). |
| Counterparties (multi) | Đã có `getWalletCounterparties`; chart cần nhận nhiều ví và trả `wallets: [{ address, counterparties, rankings }]`. |
| Daily / Total Trading Volume | Đã có service DB; chỉ cần đảm bảo `wallets` truyền đúng. |
| Trading volume theo token | Aggregate từ `wallet_swap` + transfer (mint, amount, price hoặc valueUsd) theo period. |
| Volume per transaction | Cùng nguồn swap/transfer → lấy từng tx volume → tính thống kê. |
| Holding duration | Token balance history (theo ngày) → với mỗi token tính khoảng thời gian có balance (first seen → last / now). |
| Stablecoin ratio | Portfolio snapshot theo ngày (hoặc balance history) + danh sách stablecoin mint → ratio time series. |
| Rolling return / Winrate / Drawdown | PnL theo kỳ (đã có từ balance history); trade-level từ swap để win/loss; equity curve từ balance/PnL cho drawdown. |

---

## 8. Tóm tắt hành động

1. **Exchanges chart:** Thêm query `wallets` (hoặc `address`) và dùng `getWalletExchangeCounts`; hỗ trợ nhiều ví cho comparison.
2. **Distribution chart:** Với `wallets` nhiều phần tử, gọi portfolio từng ví và trả mảng theo wallet thay vì mock.
3. **Counterparties chart:** Hỗ trợ trả theo từng ví (multi-wallet response).
4. **Các chart còn mock:** Ưu tiên triển khai backend thật cho: Trading Volume Distribution, Trading Volume Per Transaction, Holdings, Stablecoin Ratio, Rolling Returns, Winrate, Drawdown (theo thứ tự nghiệp vụ).
5. **Trang comparison:** Đảm bảo mọi component truyền đúng `wallets=addr1,addr2,...` và client map đúng tên tham số (ví dụ `walletIds` cho holdings).
