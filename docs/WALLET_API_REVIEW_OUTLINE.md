# Outline – Review API Wallet & Comparison

## 1. Phạm vi review
- **Trang chi tiết ví:** `/wallets/:address` (client: `client/src/pages/wallet/index.tsx`)
- **Trang so sánh ví:** `/comparision/wallets` (client: `client/src/pages/walletsComparision/index.tsx`)

## 2. Nguồn code đã quét
- **Server routes:**  
  `server/src/routes/wallets.route.ts`,  
  `server/src/main.ts` (mount),  
  `server/src/routes/charts/*.ts` (balance, pnl, distribution, counterparties, exchanges, dailyTradingVolume, totalTradingVolume, tradingVolumeDistribution, tradingVolumePerTransaction, holdings, stablecoinRatio, rollingAnnualReturn, averageRollingAnnualReturn, winrate, drawdown).
- **Client:**  
  `client/src/pages/wallet/index.tsx`,  
  `client/src/pages/walletsComparision/index.tsx`,  
  `client/src/components/wallet/WalletOverview/WalletOverview.tsx`,  
  `client/src/components/wallet/WalletComparision/GeneralTab.tsx`,  
  `client/src/components/wallet/WalletComparision/HoldingTab.tsx`,  
  `client/src/components/wallet/WalletComparision/RiskTab.tsx`,  
  các component chart được dùng trên 2 trang.
- **API client:**  
  `client/src/services/wallet/walletApi.ts`,  
  `client/src/services/chart/chartApi.ts`.
- **Backend services:**  
  `server/src/services/wallet/walletData.service.js`,  
  `server/src/services/wallet/counterparties.service.js`,  
  `server/src/services/charts/*.service.js`,  
  `server/src/services/mockChartData.service.js` (mock khi chưa có data thật).

## 3. Cấu trúc tài liệu chính (WALLET_AND_COMPARISON_API_REVIEW.md)
1. **Tổng quan**  
   Base path: `/api/wallets`, `/api/charts/*`. Không có route riêng `/api/comparison/wallets`; so sánh thực hiện bằng cách gửi nhiều địa chỉ trong query `wallets` (hoặc `walletIds`) cho từng chart API.
2. **Danh sách API theo nhóm**  
   - Wallet core: overview, portfolio, transactions, transfers, swap, distribution, exchanges, counterparties, identity, intelligence.  
   - Chart APIs: balance, pnl, distribution, counterparties, exchanges, dailyTradingVolume, totalTradingVolume, tradingVolumeDistribution, tradingVolumePerTransaction, holdings, stablecoinRatio, rollingAnnualReturn, averageRollingAnnualReturn, winrate, drawdown.
3. **Chi tiết từng endpoint**  
   Method, path, query params, cách gọi (ví dụ URL/body), response shape tóm tắt.
4. **API chưa hoàn thiện / thiếu**  
   - Chỉ mock, chưa gắn wallet: exchanges (chart).  
   - Nhận wallet nhưng multi-wallet chưa dùng data thật: distribution (nhiều ví → mock).  
   - Chỉ mock, không có backend thật: tradingVolumeDistribution, tradingVolumePerTransaction, holdings, stablecoinRatio, rollingAnnualReturn, averageRollingAnnualReturn, winrate, drawdown.  
   - Chart counterparties: chỉ lấy 1 wallet (address hoặc phần tử đầu của `wallets`).
5. **Ánh xạ Chart → API cho 2 trang**  
   Bảng: trang (wallet / comparison), tab/section, chart component, API dùng, params (wallets, timePeriod/period), ghi chú (real/mock, single/multi).
6. **Đề xuất data cần cho từng chart**  
   Với từng chart chưa đủ API: cấu trúc payload (fields) cần có để render đúng; đặc biệt cho trang comparison (nhiều ví, so sánh theo thời gian).
7. **Nguồn data đề xuất cho trường còn thiếu (comparison/wallets)**  
   - Overview/portfolio/balance: walletData.service, cache, Moralis/Helius.  
   - PnL: pnlChart.service (balance history).  
   - Exchanges: getWalletExchangeCounts (đã có) → cần chart API nhận `wallets`.  
   - Counterparties: counterparties.service (đã có) → chart đã nhận wallet.  
   - Holdings: cần service tính holding duration từ lịch sử token/balance.  
   - Winrate / drawdown / rolling return: cần trade-level hoặc period PnL từ swap/transaction.  
   - Stablecoin ratio: từ portfolio + balance history theo thời gian.  
   - Trading volume distribution / per-transaction: từ swap + transfer, aggregate theo token / theo giao dịch.
