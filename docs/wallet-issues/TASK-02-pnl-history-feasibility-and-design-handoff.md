# Task 02 - PnL history recalculation feasibility & design handoff

## Mục tiêu
Đánh giá khả năng tính lại lịch sử PnL phản ánh biến động balance theo hướng trace swaps thay vì dựa chủ yếu vào lịch balance hiện tại.

## Bối cảnh
- Hiện chưa có API lịch sử PnL chuyên biệt.
- Yêu cầu nghiệp vụ: nếu chưa khả thi kỹ thuật/nguồn dữ liệu, cần handoff rõ ràng cho design.

## Phạm vi chính
- API/chart data contract cho wallet PnL.
- Dòng dữ liệu swap/transfer liên quan tới biến động tài sản.
- Tài liệu phân tích khả thi và đề xuất UX fallback.

## Task con
1. **Gap analysis dữ liệu**
   - So sánh dữ liệu hiện có với dữ liệu cần để reconstruct PnL theo trade flow.
2. **Thiết kế phương án kỹ thuật**
   - Phương án A: xây mới API PnL history.
   - Phương án B: tạm tính gần đúng từ dữ liệu sẵn có + giới hạn rõ ràng.
3. **Đánh giá chi phí/chất lượng**
   - Độ chính xác, độ trễ, chi phí xử lý, độ phức tạp bảo trì.
4. **Handoff design nếu chưa khả thi**
   - Đề xuất trạng thái UI: disclaimer, trạng thái “đang chuẩn bị dữ liệu”, hoặc fallback metric.

## Kế hoạch thực hiện
### Phase A - Discovery
- Thu thập yêu cầu nghiệp vụ chi tiết cho “PnL đúng nghĩa” (realized/unrealized/theo mốc thời gian).
- Chốt định nghĩa metric trước khi thiết kế API.

### Phase B - Feasibility assessment
- Lập matrix khả thi cho từng phương án (dữ liệu, effort, risk).
- Chọn phương án ngắn hạn và dài hạn.

### Phase C - Quyết định triển khai hoặc handoff
- Nếu khả thi: chuẩn hóa backlog API + frontend integration.
- Nếu chưa khả thi: đóng gói design handoff với thông điệp UX rõ ràng.

## Rủi ro & giảm thiểu
- **Rủi ro:** Mơ hồ định nghĩa PnL dẫn tới sai kỳ vọng.
  - **Giảm thiểu:** Chốt business definition trước implementation.
- **Rủi ro:** Dữ liệu swaps thiếu trường cần thiết.
  - **Giảm thiểu:** Đề xuất mở rộng API hoặc chấp nhận fallback có cảnh báo.

## Tiêu chí hoàn thành
- Có tài liệu đánh giá khả thi được chấp thuận.
- Có quyết định rõ: triển khai API mới hoặc handoff design.
- Nếu handoff: có guideline UX cụ thể cho trạng thái chưa khả thi.
