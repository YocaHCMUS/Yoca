# Task 05 - Wallet Portfolio watchlist unauthenticated flow

## Mục tiêu
Cho phép người dùng chưa đăng nhập vẫn bấm thao tác thêm vào watchlist; hệ thống hiển thị popup đăng nhập thay vì chặn click hoàn toàn.

## Phạm vi chính
- Danh sách Portfolio / token list có hành động Add to Watchlist.
- Cơ chế auth guard ở level page wrapper hoặc action wrapper.
- Popup đăng nhập và callback sau đăng nhập.

## Task con
1. **Audit điểm chặn hiện tại**
   - Xác định nơi disable click khi chưa đăng nhập (UI-level hay handler-level).
2. **Thiết kế guard mới cho action**
   - Action vẫn click được.
   - Nếu unauthenticated: mở login popup + lưu intent action.
3. **Xử lý post-login continuation (nếu có)**
   - Sau khi login thành công, có thể thực hiện lại hành động thêm watchlist.
4. **Xử lý dùng chung qua wrapper**
   - Đánh giá tạo cơ chế dùng chung cho các action cần auth trong page wrapper.
5. **Kiểm thử trải nghiệm người dùng**
   - Flow chưa login -> click -> popup -> login -> cập nhật watchlist.

## Kế hoạch thực hiện
### Phase A - Chuẩn hóa auth-intercept pattern
- Xây pattern `requireAuthAction` dùng lại cho các thao tác cần đăng nhập.

### Phase B - Tích hợp cho Watchlist
- Gắn pattern vào nút Add to Watchlist ở Portfolio list.

### Phase C - UX polish + fallback
- Thêm thông báo rõ ràng khi hủy login hoặc login thất bại.
- Đảm bảo không tạo trạng thái UI mâu thuẫn (nút bật/tắt sai).

## Rủi ro & giảm thiểu
- **Rủi ro:** Trigger popup lặp nhiều lần khi user bấm liên tục.
  - **Giảm thiểu:** Debounce/lock tạm trong lúc popup mở.
- **Rủi ro:** Action intent bị mất sau login redirect.
  - **Giảm thiểu:** Lưu intent ngắn hạn trong state/context.

## Tiêu chí hoàn thành
- User chưa đăng nhập bấm được nút watchlist và nhận popup đăng nhập.
- Sau đăng nhập, watchlist cập nhật đúng theo kỳ vọng.
- Cơ chế guard có thể tái sử dụng cho các action cần auth khác.
