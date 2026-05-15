# Task 03 - Performance và chart rendering của Wallet

## Mục tiêu
- Giảm thời gian load đồ thị `Balance Trend/History` và chart trong `Last Tokens Traded`.
- Sửa lỗi chart `Last Tokens Traded` bị glitch (đường avg buy/sell đứng góc trái).
- Khôi phục cảm giác render mượt/animation hợp lý (nếu phù hợp với UX hiện tại).

## Phạm vi chính
- `client/src/components/charts/BalanceChart/BalanceChart.tsx`
- `client/src/pages/wallet/TokenDetailsDemo.tsx`
- `client/src/components/charts/TimeSeriesTradesScatterChart/index.tsx`
- Luồng fetch chart API và config ECharts liên quan.

## Task con
1. **Profiling luồng load chart**
   - Đo thời gian fetch, transform data, render chart instance.
   - Xác định bottleneck (network, data transform, re-render, chart options).
2. **Tối ưu Balance chart**
   - Kiểm tra prefetch/chunk logic, cache reuse, dependencies gây refetch thừa.
3. **Sửa glitch avg buy/sell mark lines**
   - Kiểm tra cấu hình trục/tọa độ/markLine khi dữ liệu rỗng hoặc đổi range.
   - Đảm bảo line bám đúng y-axis và không nhảy góc trái.
4. **Review animation/render strategy**
   - Đánh giá animation hiện tại so với behavior mong muốn trước đây.
   - Cấu hình lại animation để đảm bảo mượt nhưng không tăng latency đáng kể.
5. **Regression + stress checks**
   - Test data lớn, đổi time range liên tục, đổi token nhanh.

## Kế hoạch thực hiện
### Phase A - Baseline hiệu năng
- Thiết lập benchmark trước tối ưu (TTI chart, first paint chart, interaction latency).

### Phase B - Sửa lỗi render/glitch
- Ưu tiên fix markLine và trạng thái render sai vị trí.
- Chặn các case data edge gây option không hợp lệ.

### Phase C - Tối ưu tải dữ liệu và re-render
- Giảm fetch/transform lặp, giới hạn re-compute nặng.
- Xác nhận hiệu quả qua benchmark sau tối ưu.

### Phase D - Hoàn thiện UX animation
- Cân chỉnh animation theo mức “nhanh và ổn định”, tránh hiệu ứng nhấp nháy.

## Rủi ro & giảm thiểu
- **Rủi ro:** Tối ưu quá mức làm giảm độ chính xác dữ liệu hiển thị.
  - **Giảm thiểu:** Giữ nguyên data contract, chỉ tối ưu luồng xử lý/render.
- **Rủi ro:** Animation mới xung đột với tooltip/hover.
  - **Giảm thiểu:** Test đầy đủ hover + zoom + range switch.

## Tiêu chí hoàn thành
- Thời gian load chart giảm rõ rệt so với baseline.
- Không còn lỗi avg buy/sell line đứng góc trái.
- Chart hoạt động ổn định khi đổi range/token liên tục.
