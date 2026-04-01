# Ghi chép sử dụng AI: Tích hợp Wallet API (Helius)

> **Mục đích**: Tài liệu này track lại cách sử dụng AI (Cursor / Auto) trong việc tích hợp Helius API cho wallet, phục vụ báo cáo sprint và session chia sẻ cách dùng AI trong đồ án.

---

## 1. Tổng quan

- **Feature/Task**: Chuyển từ Birdeye sang Helius để lấy dữ liệu wallet (portfolio, overview, transactions) cho Solana
- **Lý do**: Birdeye free tier quá hạn chế (1 request/phút), Helius có plan miễn phí linh hoạt hơn
- **Công cụ AI sử dụng**: Cursor (AI pair-programming trong editor)
- **Thời gian ước tính làm với AI**: Một số phiên làm việc liên tục, mỗi phiên 15–30 phút

---

## 2. Quy trình làm việc với AI

### Bước 1: Cung cấp ngữ cảnh và yêu cầu rõ ràng

**Cách tôi đã prompt:**

- Đưa ra mục tiêu rõ ràng: *"chuyển từ Birdeye sang Helius vì Birdeye quá chậm vì bị giới hạn 1 rpm và các thông tin cần thiết còn chưa có đủ"*
- Gắn với codebase: tag file cụ thể (ví dụ `@server/src/services/walletData.service.ts`)
- Nêu ràng buộc: *"comment Birdeye ra, không xóa, để sau có thể dùng lại"*

**Ví dụ prompt thực tế:**

```
because the rpm of the Birdeye is only 1, so slow, so now we will test 
to get all data needed by Helius, so please comment the way you used 
Birdeye for data retrieval and try to use the API endpoints of Helius
```

### Bước 2: Cung cấp tài liệu API khi cần

**Cách tôi đã cung cấp docs:**

- Copy-paste trực tiếp từ Helius docs vào chat (Overview, Quick Start, Request/Response Format)
- Đính kèm ảnh chụp màn hình (nếu có) từ API playground

**Ví dụ docs đã share:**

1. **Wallet Balances API** – Lấy portfolio và total asset value  
   - Endpoint: `GET https://api.helius.xyz/v1/wallet/{address}/balances`  
   - Query params: `page`, `limit`, `showZeroBalance`, `showNative`, `showNfts`  
   - Response: `balances[]`, `totalUsdValue`, `pagination`

2. **Wallet Transfers API** – Lấy lịch sử transfer (thay cho `getTransactionsForAddress` khi dùng free plan)  
   - Endpoint: `GET https://api.helius.xyz/v1/wallet/{address}/transfers`  
   - Response: `data[]` với `signature`, `timestamp`, `direction`, `counterparty`, `mint`, `symbol`, `amount`, `amountRaw`, `decimals`  
   - Lưu ý: API này **không** trả về `priceUsd` / `totalUsd`

3. **getTransactionsForAddress** – RPC method (Developer plan trở lên)  
   - Ban đầu dùng method này → nhận 403 Forbidden vì free plan không hỗ trợ  
   - Chuyển sang dùng Wallet Transfers API để tương thích free plan

### Bước 3: Phản hồi lỗi và yêu cầu điều chỉnh

**Cách tôi đã báo lỗi và yêu cầu sửa:**

- Dán log lỗi từ terminal (ví dụ `Birdeye wallet/v2/transfer error 400`, `Helius getTransactionsForAddress error 403`)
- Mô tả hiện tượng: *"Transfer table không hiển thị price, total"*, *"price_usd và total_usd trong DB đều NULL"*

**Ví dụ prompt khi debug:**

```
when I tested, we failed to collect transactions with error 
Helius getTransactionsForAddress error 403 Forbidden
Helius Exclusive Feature - getTransactionsForAddress is only available 
through Helius RPC nodes... requires a Developer plan or higher...
is it the reason? as I am using the free plan only
```

→ AI phân tích và chuyển sang dùng Wallet Transfers API (phù hợp free plan).

### Bước 4: Trao đổi về thiết kế dữ liệu

**Ví dụ câu hỏi đã đặt ra:**

- *"Helius không trả price, vậy lấy price từ đâu?"*
- *"Schema hiện tại đã có sẵn bảng lưu price token chưa?"*

→ AI đề xuất join với `tokenMarketData` (đã có `priceUsd`) thay vì gọi thêm API Helius.

---

## 3. Các phần AI đã implement và mình đã review/sửa

| Phần việc | AI đã làm | Mình đã kiểm tra / điều chỉnh |
|-----------|-----------|--------------------------------|
| `fetchHeliusSolanaPortfolio` | Dùng Wallet Balances API, map `balances[]` → `WalletPortfolioItem[]`, support pagination | Xem lại response format, thử với wallet thật |
| `getWalletOverview` (Solana) | Chuyển từ Birdeye sang Helius, sum `valueUsd` từ portfolio | Verify total asset value khớp với UI |
| `fetchHeliusSolanaTransactions` | Ban đầu dùng `getTransactionsForAddress` (RPC) → 403 → đổi sang Wallet Transfers API | Xác nhận free plan support, test lại transfers |
| `priceUsd` / `totalUsd` trong transactions | Ban đầu set `undefined` vì API không trả về | Hỏi schema → AI đề xuất enrich từ `tokenMarketData` (chưa implement) |
| Comment Birdeye, không xóa | Toàn bộ logic Birdeye được comment trong block `/* ... */` | Đọc qua, đảm bảo có thể uncomment để revert |

---

## 4. Những điều AI làm tốt

- Map nhanh response JSON vào kiểu TypeScript hiện có (`WalletPortfolioItem`, `WalletTransaction`)
- Xử lý pagination (cursor, `hasMore`) đúng pattern
- Đề xuất fallback khi gặp 403 (đổi endpoint)
- Gợi ý dùng dữ liệu sẵn có trong DB (`tokenMarketData`) thay vì gọi thêm API

---

## 5. Những điều AI chưa làm hoặc cần mình uốn nắn

- **Plan/ pricing API**: Ban đầu dùng `getTransactionsForAddress` mà không biết cần Developer plan → sau khi gặp 403 mới đổi sang Wallet Transfers
- **Price enrichment**: Chưa implement enrich `priceUsd`/`totalUsd` từ `tokenMarketData` cho transactions; cần mình nhắc và sẽ làm ở bước tiếp theo
- **Format docs**: Mình phải copy-paste docs vào chat; AI không tự truy cập link Helius

---

## 6. Bài học kinh nghiệm

1. **Prompt rõ ràng**: Nêu rõ mục tiêu, ràng buộc (comment thay vì xóa), và context (free plan).
2. **Cung cấp docs**: Dán trực tiếp phần relevant của docs thay vì chỉ gửi link.
3. **Phản hồi khi lỗi**: Dán log, status code, message lỗi; AI sẽ phân tích và đề xuất hướng xử lý.
4. **Đặt câu hỏi thiết kế**: Hỏi *"DB đã có data X chưa?"* để AI đề xuất tái sử dụng thay vì gọi API mới.
5. **Review code AI sinh ra**: Luôn chạy thử, kiểm tra schema, so sánh với docs API.

---

## 7. Minh chứng có thể dùng trong session báo cáo

- **Commit / branch**: Các commit liên quan đến thay Birdeye → Helius trong `walletData.service.ts`, `wallets.route.ts`
- **File thay đổi chính**: `server/src/services/walletData.service.ts` (thêm `fetchHeliusSolanaPortfolio`, `fetchHeliusSolanaTransactions`, comment Birdeye)
- **Chat log / transcript**: Export hoặc chụp màn hình các đoạn chat với AI (nếu tool hỗ trợ)

---

*Tài liệu này được viết với sự hỗ trợ của AI, dựa trên quá trình làm việc thực tế trong sprint tích hợp Helius Wallet API.*
