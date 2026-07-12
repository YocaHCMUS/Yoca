# Thống kê chức năng theo Actor — phục vụ vẽ Use-case Diagram (Yoca)

> Tổng hợp từ khảo sát code thực tế (routes backend, pages frontend, DB schema). Dùng làm nguồn để vẽ sơ đồ use-case.

## 1. Danh sách Actor

| Actor | Ghi chú |
|---|---|
| **Khách (Guest)** | Chưa đăng nhập, xem được phần lớn dữ liệu public |
| **Người dùng đã đăng ký (Registered User)** | Đã login (password / Google OAuth / ký ví Solana) |
| **Gói trả phí (Free/Lite/Plus/Pro)** | Không phải actor riêng — là mức phân quyền (permission level) của Registered User, giới hạn số lần dùng AI |
| **Hệ thống ngoài** (Stripe, Helius webhook, n8n) | Actor phụ (external system), không bắt buộc phải vẽ, chỉ cần nếu muốn thể hiện luồng webhook/thanh toán |

## 2. Chức năng của Guest (chưa đăng nhập)

- Xem trang chủ (landing page)
- Xem Market: top gainers/losers, bảng DEX, giao dịch gần đây
- Xem chi tiết Token: biểu đồ giá, thống kê thị trường, holders, pools, lịch unlock, tin tức, tín hiệu volatility
- Chat AI theo từng token (giới hạn theo IP)
- Tìm kiếm token / pool / wallet
- Xem hồ sơ Wallet: overview, portfolio, PnL, swap, transfer, holdings, funder/first-fund, hoạt động theo ngày, chi tiết giao dịch
- So sánh nhiều ví (wallet comparison)
- Xem Wash-Trading Detection của 1 token: circular trade, star topology, volume anomaly
- Xem transaction graph / historical data
- Xem trang Pricing

## 3. Chức năng của Registered User (cộng thêm trên Guest)

### Xác thực & tài khoản
- Đăng ký (email/password)
- Đăng nhập bằng password / Google OAuth / ký chữ ký ví Solana
- Quên mật khẩu / đặt lại mật khẩu (qua mã gửi email)
- Đăng xuất
- Xem phiên đăng nhập hiện tại

### Hồ sơ & thiết lập
- Xem/cập nhật thông tin cá nhân (tên hiển thị, email)
- Đổi mật khẩu / thêm mật khẩu
- Liên kết / hủy liên kết ví Solana vào tài khoản (xác thực bằng chữ ký)
- Xóa tài khoản (yêu cầu xác thực lại + gõ xác nhận)
- Quản lý watchlist token và watchlist ví (thêm/xóa/kiểm tra)
- Gắn nhãn / tag cho ví (wallet labels)
- Xem lịch sử subscription và lịch sử thanh toán

### Alerts (theo dõi & cảnh báo)
- Follow / unfollow ví để theo dõi
- Xem danh sách ví đang follow
- Tạo / sửa / xóa rule cảnh báo (theo khối lượng swap/transfer, một lần hoặc lặp lại, có ngày hết hạn)
- Cấu hình kênh nhận cảnh báo: webhook Discord, bật/tắt email, đổi email nhận
- CRUD cảnh báo giá token (token price alert)
- CRUD cảnh báo giao dịch (trading alert)

### AI Chat workspace
- Chat với AI assistant (có giới hạn lượt/ngày)
- Tạo / xem danh sách / xem chi tiết / cập nhật / xóa session chat
- Tạo / xem / sửa / xóa / fork prompt mẫu (public hoặc private)
- Xem lượt dùng AI trong ngày

### Chức năng AI phân tích (giới hạn theo tier)
- Ask Yoca AI, Volatility Signal Summary, Token Chart News Summary — dùng được từ tier Free (có giới hạn số lần, tăng theo Lite/Plus/Pro)
- Wallet AI Analysis, Wash Trading AI Analysis — **chỉ tier Plus/Pro**

### Thanh toán & Subscription
- Đăng ký gói (Lite/Plus/Pro) qua Stripe (SetupIntent + thẻ/tài khoản ngân hàng)
- Đăng ký/thanh toán gói bằng giao dịch on-chain Solana (devnet/testnet/mainnet, verify server-side)
- Xác nhận thủ công một payment intent đang chờ
- Hủy subscription
- Xem trước & thực hiện nâng cấp gói (có tính proration)

## 4. Subsystem không phải use-case trực tiếp của user

Các hệ thống nền chạy tự động, có thể vẽ dạng include/extend hoặc actor phụ nếu cần, không phải thao tác người dùng chủ động:

- News aggregation: thu thập RSS + lọc bằng AI
- Wash-trading detection engine: thuật toán đồ thị (GCN/GAT/GraphSAGE) + narrative AI
- Charts export: xuất PNG/SVG/CSV từ các biểu đồ
- Helius webhook ingestion: nhận sự kiện on-chain để fan-out alert

## 5. Bảng tham chiếu file nguồn

| Module | File |
|---|---|
| Routing/pages tổng | `client/src/App.tsx` |
| Auth | `server/src/routes/users.ts`, `server/src/routes/auth.ts`, `client/src/components/auth/*`, `server/src/db/users.ts` |
| Hồ sơ/watchlist/subscription | `server/src/routes/profile.ts` |
| Thanh toán | `server/src/routes/payment.route.ts`, `server/src/db/payment.ts` |
| Alerts | `server/src/routes/alerts.route.ts`, `server/src/routes/alerts/alerts-token.ts`, `server/src/routes/alerts/alerts-trading.ts` |
| AI Chat | `server/src/routes/chat.route.ts`, `server/src/services/ai-usage.service.ts` |
| Wallet analytics | `server/src/routes/wallets.ts`, `server/src/routes/wallets/*` |
| Token/market | `server/src/routes/tokens.ts`, `trades.ts`, `search.ts`, `news.ts`, `token-*.ts` |
| Wash trading | `server/src/routes/wash-trading.route.ts` |
| DB schema | `server/src/db/{users,payment,wallets,alerts,schema}.ts` |
