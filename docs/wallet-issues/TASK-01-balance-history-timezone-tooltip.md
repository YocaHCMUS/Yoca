# Task 01 - Balance History naming, timezone và tooltip stability

## Mục tiêu
- Đổi tên hiển thị `Balance Trend` -> `Balance History` và cập nhật localization tương ứng.
- Sửa lệch ngày so với database (hiển thị đúng UTC như dữ liệu nguồn).
- Khắc phục hiện tượng tooltip bị nháy/mất trên `BalanceChart.tsx`.
- Chuẩn hóa formatting dùng `fmt` từ `LocalizationContext` và dùng Carbon token thay vì hardcode màu.

## Phạm vi chính
- `client/src/components/charts/BalanceChart/BalanceChart.tsx`
- `client/src/config/localization/en.ts`
- `client/src/config/localization/vi.ts`
- Các utility chart/timezone liên quan (`chart-helpers`, `tooltip-helpers`) nếu cần.

## Task con
1. **Audit naming + localization key**
   - Rà tất cả key/text còn dùng `balanceTrend` trong wallet/chart UI.
   - Xác định key chuẩn mới và mapping tương thích ngược nếu cần.
2. **Audit timezone pipeline**
   - Trace dữ liệu từ API trả về timestamp đến formatter trục X + tooltip.
   - Xác định điểm convert timezone gây lệch ngày (server hoặc client).
3. **Fix tooltip stability**
   - Rà cấu hình `trigger`, `axisPointer`, `series z-index`, `emphasis`, `showSymbol`.
   - Loại bỏ tình trạng tooltip chỉ nháy theo frame.
4. **Formatting + theme token refactor**
   - Thay formatter hardcode bằng `fmt` từ localization context.
   - Đổi palette hardcode sang Carbon token/theme token.
5. **Regression check**
   - Kiểm tra các timePeriod phổ biến (7D/30D/90D).
   - Kiểm tra light/dark theme và multi-wallet/token mode.

## Kế hoạch thực hiện
### Phase A - Chuẩn hóa tên gọi
- Hoàn tất rename ở title/chart legend/localization.
- Xác nhận không còn text cũ trên UI wallet.

### Phase B - Điều tra lệch ngày UTC
- So sánh dữ liệu API raw và dữ liệu render điểm chart.
- Chốt root-cause nằm ở server hoặc client.
- Đưa ra phương án fix ưu tiên tại điểm convert sai.

### Phase C - Sửa tooltip + chuẩn hóa style/format
- Điều chỉnh cấu hình tooltip/hover interaction để ổn định.
- Chuẩn hóa formatter + màu theo localization/theming.

### Phase D - Kiểm thử hồi quy
- Test thủ công theo ma trận: timezone, period, theme, token filter.
- Đảm bảo rename + timezone + tooltip cùng hoạt động ổn định.

## Rủi ro & giảm thiểu
- **Rủi ro:** Sửa tooltip làm ảnh hưởng behavior chart khác.
  - **Giảm thiểu:** Chỉ giới hạn thay đổi trong BalanceChart, test chart interaction đầy đủ.
- **Rủi ro:** Lệch ngày do server normalize theo timezone khác.
  - **Giảm thiểu:** Chốt contract timestamp (UTC) và thêm test contract nếu cần.

## Tiêu chí hoàn thành
- Không còn text `Balance Trend` trên wallet chart.
- Ngày hiển thị trùng ngày database theo UTC.
- Tooltip hiển thị ổn định khi hover line.
- BalanceChart dùng `fmt` + Carbon token (không hardcode màu chính).
