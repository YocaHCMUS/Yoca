# Balance Chart Refactor Environment Log (2026-05-09)

## Mục tiêu

Thiết lập lại môi trường test sạch để so sánh trực tiếp BalanceChart V1 và BalanceChartV2 theo cùng 1 ví.

## Thay đổi đã thực hiện

1. Tạo page test riêng cho V1:
   - `client/src/pages/wallet-issues-v1/index.tsx`
   - Chỉ render `BalanceChart` V1 với 1 ví cố định.
   - Tắt auto-refresh để giảm nhiễu khi so sánh hành vi UI.

2. Tạo page test riêng cho V2:
   - `client/src/pages/wallet-issues-v2/index.tsx`
   - Chỉ render `BalanceChartV2` với cùng ví cố định như V1.

3. Cập nhật router để dùng 2 route chuẩn:
   - `/wallet-issues/v1`
   - `/wallet-issues/v2`
   - Khai báo trong `client/src/App.tsx`.

4. Loại bỏ thiết lập route test cũ để làm sạch môi trường:
   - `/walletsfix-v1`
   - `/walletsfix`
   - Đồng thời xóa page cũ `client/src/pages/balance-chart-debug/index.tsx`.

## Nguyên tắc giữ trong môi trường so sánh

1. Cùng một địa chỉ ví giữa V1 và V2 để đối chiếu trực quan.
2. Mỗi route chỉ chứa đúng một chart mục tiêu, tránh nhiễu từ thành phần khác.
3. Ưu tiên phục vụ refactor incremental và đánh giá parity hành vi hiển thị.

## Thay đổi giao diện chart V2 thực hiện hôm nay

1. Bật đường kẻ dọc (vertical split lines) trên trục X để hiển thị ranh ngày (một đường cho mỗi ngày).
   - File thay đổi: `client/src/components/charts/TimeSeriesLineChart/index.tsx`.
   - Cách làm: bật `xAxis.splitLine.show = true` và đặt `xAxis.interval = 24*60*60*1000` để tăng cơ hội split line tại ranh ngày.

2. Giữ các đường kẻ ngang trên trục Y dạng dashed (đã có sẵn) và giữ vị trí trục Y ở `right`.

Ghi chú: thay đổi này là trực tiếp trên component chart dùng chung (`TimeSeriesLineChart`) nên cả V1 và V2 sẽ hiển thị đường dọc ngày nếu cùng dùng component này. Nếu muốn chỉ áp dụng cho V2, mình có thể thêm prop bật/tắt vào `TimeSeriesLineChart`.

## Thay đổi implement hôm nay - 7D/30D switch & tooltip currency

1. Thêm `FilterSwitch` trên `BalanceChartV2` để chuyển giữa `7D` và `30D`.
   - File: `client/src/components/charts/BalanceChartV2/BalanceChartV2.tsx`.
   - Hành vi: chọn sẽ cập nhật `timePeriod` state và `useGet` sẽ fetch lại endpoint với tham số mới.

2. Định dạng giá trị trong tooltip dùng `fmt.num.currency`.
   - File: `client/src/components/charts/BalanceChartV2/BalanceChartV2.tsx` (pass `valueFormatter` prop).
   - Hoặc fallback trong `TimeSeriesLineChart` (đã set) nếu prop không được truyền.

3. Todo/tiếp theo: nếu muốn chỉ bật vertical lines cho V2, thêm prop `showDailySplits` vào `TimeSeriesLineChart`.

4. Thực hiện hôm nay: thêm prop `showDailySplits` vào `TimeSeriesLineChart` và bật cho `BalanceChartV2`.
   - Files thay đổi:
     - `client/src/components/charts/TimeSeriesLineChart/index.tsx`
     - `client/src/components/charts/BalanceChartV2/BalanceChartV2.tsx`
   - Mục đích: chỉ V2 hiển thị đường dọc ranh ngày, giữ V1 không bị ảnh hưởng nếu cần.

5. Thực hiện tiếp theo: thay wrapper layout thô của `BalanceChartV2` bằng `Flex`.
   - File thay đổi: `client/src/components/charts/BalanceChartV2/BalanceChartV2.tsx`
   - Mục đích: dùng abstraction layout hiện có thay vì `div` inline-style.

## Thay đổi implement - 24h change metric (2026-05-09 tiếp)

1. Thêm `compute24hChange` function để tính % thay đổi trong 24h gần nhất.
   - File: `client/src/components/charts/BalanceChartV2/BalanceChartV2.tsx`
   - Logic: tìm snapshot gần nhất cách khoảng 24h từ điểm dữ liệu cuối cùng, tính % thay đổi
   - Return: `{ pct: number, deltaLabel: string }` (e.g., `pct = 5.25, deltaLabel = "1d"`)

2. Render 24h change chip trên chart dùng `TrendNum` component.
   - File: `client/src/components/charts/BalanceChartV2/BalanceChartV2.tsx`
   - Component: `<TrendNum value={change24h.pct} prefixes="plus-minus" formatter={...} />`
   - Màu: tự động xanh lá (tăng) / đỏ (giảm) từ TrendNum
   - Hiển thị: phía trên chart, cạnh filter switch
   - **Note**: Dùng `Txt` component (`<Txt size="sm" secondary>24h:</Txt>`) thay vì hardcoded `<span>` với inline styles để giữ consistency và dễ bảo trì

## V1 ↔ V2 Feature Parity Checklist

| Feature                 | V1 Status | V2 Status | Notes                                          |
| ----------------------- | --------- | --------- | ---------------------------------------------- |
| 7D/30D Toggle           | ✅        | ✅        | FilterSwitch component, state-driven refetch   |
| 24h Change Metric       | ✅        | ✅        | compute24hChange function, TrendNum display    |
| Currency Formatting     | ✅        | ✅        | fmt.num.currency in tooltip via valueFormatter |
| Right-aligned Y-axis    | ✅        | ✅        | Inherited from TimeSeriesLineChart             |
| Horizontal dashed grid  | ✅        | ✅        | Y-axis grid lines (no change needed)           |
| Single-wallet focus     | ✅        | ✅        | Address prop only, no multi-wallet selector    |
| Error state handling    | ⏳        | ⏳        | Depends on useGet error responses              |
| Token metadata display  | ✅        | ⏳        | V1 shows token symbol + logo, V2 pending       |
| Wallet metadata display | ✅        | ⏳        | V1 shows alias/address, V2 pending             |
| Loading state UI        | ✅        | ✅        | InlineLoading passed to TimeSeriesLineChart    |
