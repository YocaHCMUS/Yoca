# Task 04 - Reorder Activity/Risk và đổi màu Buy/Sell trong bảng Swap

## Mục tiêu
- Sắp xếp lại thứ tự nội dung tab `Activity / Risk`, ưu tiên khối swap và transfer lên trước.
- Cập nhật màu Buy/Sell trong bảng swap: Buy = xanh, Sell = đỏ.

## Phạm vi chính
- `client/src/pages/wallet/index.tsx`
- Các renderer/cell style liên quan swap table.
- Token màu/theming đang dùng trong wallet table.

## Task con
1. **Review cấu trúc Activity / Risk hiện tại**
   - Xác định thứ tự chart/table đang render.
2. **Đề xuất thứ tự mới theo ưu tiên nghiệp vụ**
   - Đưa swap + transfer lên trước; các chart phân tích theo sau.
3. **Chuẩn hóa màu Buy/Sell**
   - Mapping màu theo semantic token: buy=success, sell=error.
   - Kiểm tra tương phản màu cho cả light/dark theme.
4. **Kiểm thử hiển thị bảng**
   - Đảm bảo sort/filter/pagination không bị ảnh hưởng.

## Kế hoạch thực hiện
### Phase A - Reorder layout
- Chuyển vị trí block dữ liệu trong tab Activity/Risk theo thứ tự mới.

### Phase B - Update visual semantics Buy/Sell
- Áp dụng màu semantic thống nhất trong cell/label/table row.

### Phase C - Regression test
- Rà hành vi click row, mở modal swap, phân trang server-side.

## Rủi ro & giảm thiểu
- **Rủi ro:** Đổi thứ tự block gây ảnh hưởng export/report.
  - **Giảm thiểu:** Đối chiếu luồng export PDF/XLSX sau khi reorder.
- **Rủi ro:** Màu mới thiếu tương phản ở dark mode.
  - **Giảm thiểu:** Dùng token hệ thống thay vì mã màu cứng.

## Tiêu chí hoàn thành
- Tab Activity/Risk hiển thị swap + transfer trước.
- Buy/Sell màu đúng semantic (xanh/đỏ) và đọc tốt ở cả 2 theme.
