# BalanceChart V1 - Feature Inventory và Control Flow

## Mục tiêu

Tài liệu này tổng hợp các tính năng mà `BalanceChart` V1 đang hỗ trợ, mô tả luồng điều khiển của từng nhóm tính năng để làm baseline cho việc chuyển đổi sang `BalanceChartV2` theo hướng đơn giản hóa.

## Phạm vi đọc code

- `client/src/components/charts/BalanceChart/BalanceChart.tsx`

## Tổng quan kiến trúc V1

`BalanceChart` V1 là một component tổng hợp nhiều trách nhiệm trong cùng một file:

1. Quản lý filter/selection state cho token + wallet.
2. Tổ chức fetch dữ liệu theo 2 kênh (`general` và `token`) với cache tự quản.
3. Prefetch token theo chunk để tăng khả năng hiển thị nhanh khi người dùng đổi tag.
4. Chuẩn hóa, merge metadata, và compose series để vẽ chart.
5. Render control UI (selector, tag chips, 7D/30D toggle, summary chips).
6. Build option ECharts và quản lý loading/error/retry.

## Danh sách tính năng V1 và luồng điều khiển

### 1) Dual-fetch data model: general stream + token stream

Tính năng:

- Luôn có một luồng dữ liệu tổng quát (`generalQuery`) theo wallet + timePeriod.
- Thêm một luồng dữ liệu token (`tokenQuery`) khi có token tag đang active.

Control flow:

1. Derive `generalQuery` từ `filters.timePeriod`, `walletsString`, `timezone`.
2. Derive `activeTokenTags` từ `selectedTags`.
3. Derive `tokenQuery` (có `tokens`) nếu có token active.
4. Gọi 2 `useStandardChartController`:

- Controller 1: `fetchBalanceTrendWithCache(generalQuery)`
- Controller 2: `fetchBalanceTrendWithCache(tokenQuery)` hoặc `emptyTokenResponse` nếu không có token.

5. Merge loading state của 2 controller bằng `mergeLoadingState`.

### 2) Cache kết quả và cache in-flight theo query key

Tính năng:

- Tránh gọi API trùng lặp khi query giống nhau.
- Tránh race condition bằng in-flight promise cache.

Control flow:

1. Tạo key qua `getBalanceQueryCacheKey` (timePeriod, tokens, wallets, timezone, aggregation).
2. Nếu có trong `balanceQueryResponseCache` -> trả về ngay.
3. Nếu có trong `balanceQueryInFlightCache` -> await promise đang chạy.
4. Nếu chưa có -> gọi `fetchBalanceTrend`, save response cache, clear in-flight.

### 3) Chuẩn hóa series data trước khi dùng

Tính năng:

- Ép kiểu number cho timestamp/value.
- Loại bỏ điểm không hợp lệ.
- Sort tăng theo timestamp.
- Dedupe timestamp trùng (giữ điểm cuối).

Control flow:

1. Cả `generalRawData` và `tokenRawData` đều qua `normalizeSeriesData` trong `useMemo`.
2. Kết quả normalized được dùng thống nhất cho: chart, summary, và tính 24h change.

### 4) Đồng bộ filter chart với context + time window 7D/30D

Tính năng:

- Sử dụng `useChartFiltersSync` để nhận filter đầu vào và set lại `timePeriod`.
- Có state riêng `chartWindowDays` (7 hoặc 30) để cắt cửa sổ hiển thị client-side.

Control flow:

1. Khởi tạo từ `initialFilters`.
2. Mỗi khi `filters.timePeriod` đổi -> update `chartWindowDays` qua `getWindowDaysFromTimePeriod`.
3. Nút 7D/30D vừa đổi `chartWindowDays` vừa gọi `setTimePeriod("7D"|"30D")`.
4. Dữ liệu sau cùng được cắt theo `cutoffTimestamp = latest - windowDays * ONE_DAY_MS`.

### 5) Cơ chế tag selection (ALL, token, wallet)

Tính năng:

- `selectedTags` mặc định là `[ALL]`.
- Hỗ trợ 3 loại tag:
- `ALL`
- Token symbol (VD: SOL, BTC)
- Wallet tag (prefix `WALLET::`)
- Giới hạn số token tag và có cơ chế thay thế token cũ nhất.

Control flow:

1. `tokenOptions` được build từ metadata + tokenSelectorOptions + prefetched tokens + wallet list.
2. Người dùng chọn option -> `selectorValue`.
3. Bấm Add/Switch -> `addTag(selectorValue)`.
4. `addTag` xử lý:

- Multi-wallet: chỉ giữ 1 tag active.
- Single-wallet: cho phép nhiều tag đến `maxTokenTags`; nếu vượt giới hạn thì loại token cũ nhất theo `tokenSelectionOrder`.

5. Bấm nút close trên chip -> `removeTag(tag)` (không cho xóa nếu còn 1 tag duy nhất).

### 6) Hành vi đặc thù cho multi-wallet mode

Tính năng:

- Nếu có nhiều wallet, control chuyển từ add-many sang switch-one.
- Có thể xem:
- Tổng tất cả wallet (`ALL`)
- Từng wallet riêng (`WALLET::<address>`)
- Một token trên nhiều wallet (series mỗi wallet)

Control flow:

1. `isMultiWallet = wallets.length > 1`.
2. `useEffect` reset tag về 1 phần tử khi chuyển vào multi-wallet.
3. Trong `displaySeries`:

- Nếu active wallet tag -> lấy đúng series wallet đó.
- Nếu `ALL` -> map tất cả wallet series.
- Nếu token tag -> lọc token series theo symbol và map theo wallet index.

### 7) Prefetch token theo chunk

Tính năng:

- Đọc candidate tokens và prefetch theo lô (`MAX_TOKENS_PER_REQUEST = 10`).
- Mục tiêu: khi thêm token tag thì có data sẵn để hiển thị nhanh hơn.

Control flow:

1. Build `candidateTokenSymbols` từ:

- `tokenSelectorOptions`
- `generalData.metadata.tokens`
- `tokenData.metadata.tokens`

2. `useEffect` prefetch khi candidate/timePeriod/wallet/timezone đổi.
3. Chia chunk, gọi API cho mỗi chunk, chỉ giữ USD series.
4. Parse token symbol từ tên series (`parseTokenSymbolFromSeriesName`).
5. Save vào `prefetchedTokenSeriesBySymbol`.

### 8) Merge metadata token/wallet cho display label

Tính năng:

- Merge `tokenMeta` và `walletMeta` từ cả 2 data stream.
- Ưu tiên tên identity/label thay vì địa chỉ thô.

Control flow:

1. Tạo `tokenMeta` với giá trị default cho `ALL`.
2. Merge metadata từ `generalData` trước, `tokenData` sau.
3. Tạo `walletMeta` merged từ 2 stream.
4. Dùng metadata để render option label, series label, và summary chip.

### 9) Compose display series theo selected tags

Tính năng:

- Từ dữ liệu raw đã normalize, build `displaySeries` là input cho chart.
- Hỗ trợ fallback token series từ prefetch map.

Control flow:

1. Tách `generalUsdSeries` và `tokenUsdSeries`.
2. Rẽ nhánh theo `isMultiWallet` và active tags.
3. Single-wallet:

- `ALL` -> lấy series tổng.
- Token -> tìm theo symbol trong token stream hoặc prefetch map.

4. Multi-wallet:

- Wallet tag -> lấy series wallet duy nhất.
- `ALL` -> lấy tất cả wallet series.
- Token tag -> lấy token series cho từng wallet.

### 10) Tính toán summary chip change metric

Tính năng:

- Hiển thị % thay đổi theo mốc gần 24h nhất.
- Hiển thị delta label dạng `Xd` và có cơ chế approx theo sai số thời gian.

Control flow:

1. Với mỗi row summary, gọi `compute24hChange(points)`.
2. Tìm baseline điểm <= `latest - 24h`; nếu không có thì fallback điểm trước latest.
3. Nếu baseline hợp lệ -> tính `pct`.
4. UI hiển thị màu dương/âm/trung tính + text fallback khi không đủ dữ liệu.

### 11) Build ECharts option với theme, legend, tooltip, area

Tính năng:

- Vẽ line chart smooth có area gradient.
- Legend điều kiện theo số series.
- Tooltip axis format theo timezone + local formatter.
- Trục y định dạng compact currency.

Control flow:

1. Nếu `windowedDisplaySeries` rỗng -> `chartOption = null`.
2. Lấy `baseOption` theo theme.
3. Map từng series -> line config (color, symbol, areaStyle).
4. Set xAxis time formatter, yAxis currency formatter.
5. Set tooltip formatter qua `formatAxisTooltip`.

### 12) Loading, empty, error, retry state quan sát được

Tính năng:

- Trạng thái tổng hợp giữa general/token.
- Retry trigger cho cả 2 stream.
- Empty state dựa trên series đã cắt cửa sổ.

Control flow:

1. `loadingState = mergeLoadingState(...)`.
2. `BaseChart` nhận `loadingState`, `isEmpty`, `onRetry`.
3. `onRetry` gọi `refetchGeneral(false)` và `refetchToken(false)`.

### 13) Instrumentation/phát hiện re-render

Tính năng:

- Gắn `BalanceChart.whyDidYouRender = true`.
- Import `@/debug/wdyr` để theo dõi render behavior khi debug.

Control flow:

1. Khi chạy môi trường có WDYR hook, component được monitor re-render để profiling.

## Luồng điều khiển end-to-end (tóm tắt)

1. Component mount, đọc `initialFilters`, khởi tạo state tag/window.
2. `useChartFiltersSync` tạo `filters` + `walletsString`.
3. Derive `generalQuery` và `tokenQuery`.
4. Chạy 2 controller fetch + cache để lấy `generalRawData`/`tokenRawData`.
5. Normalize data, merge metadata token/wallet, tính candidate token list.
6. Chạy prefetch chunk để bổ sung map token series.
7. Build `tokenOptions` cho combobox.
8. Người dùng thao tác add/switch/remove tag hoặc đổi 7D/30D.
9. Recompute `displaySeries` -> `windowedDisplaySeries` -> `chartOption`.
10. Render chart + summary chips + control UI trong `BaseChart`.
11. Nếu error/loading/empty thì `BaseChart` xử lý state; retry sẽ refetch cả 2 stream.

## Định hướng chuyển đổi V2 (opinionated)

1. Server là nơi lấy, làm sạch, chuẩn hóa và cung cấp dữ liệu hiển thị ở mức cuối cho client.
2. Client chỉ map dữ liệu sang format hiển thị, không xử lý nghiệp vụ nặng hoặc pipeline làm sạch dữ liệu.
3. Không gọi dữ liệu từ server là raw data trong ngữ cảnh component chart; đây là response data đã chuẩn hóa theo hợp đồng API.
4. Mỗi chart component chỉ nên có một mode hiển thị chính; khác mode thì tách component riêng.
5. ECharts là lớp render, không cần hệ thống kế thừa/base config phức tạp cho riêng bài toán Balance Chart.
6. Tạm thời không ưu tiên tối ưu hóa sớm: bỏ cache nội bộ component, bỏ in-flight cache, bỏ auto-refresh mặc định.
7. Ưu tiên type inference, hạn chế tạo type trung gian không cần thiết và hạn chế cast thủ công.
8. Component tự fetch bằng `useGet` với endpoint trực tiếp; không dùng thêm lớp abstraction `chartApi` cho use case này.

## Kiểm chứng phạm vi sử dụng hiện tại

1. `BalanceChart` đang được dùng cho trang ví đơn.
2. `BalanceChart` cũng đang được dùng cho trang so sánh ví.
3. Scope tài liệu này chỉ tập trung track thay thế cho khu vực ví đơn bằng `BalanceChartV2`.
4. Phần so sánh ví là track riêng, không chặn tiến độ migration incremental của ví đơn.

## Ghi chú scope migration (quan trọng)

1. Đây là incremental migration theo từng bước nhỏ, nhưng mục tiêu cuối là thay thế hoàn toàn `BalanceChart` V1 trong khu vực ví đơn.
2. Cách làm là phát triển song song một bản thay thế `BalanceChartV2`, không chỉnh vá dần trên tư duy cũ.
3. Trong track này không đặt mục tiêu backward compatibility cho kiến trúc nội bộ của V1.
4. `BalanceChartV2` chỉ cần hiển thị 1 wallet, nhưng phải đạt parity các options/khả năng hiển thị cần thiết mà V1 đang cung cấp cho ví đơn.
5. Chỉ chuyển callsite khi V2 đã đạt tiêu chí thay thế thực tế.

## Kế hoạch migration đã chỉnh sửa

1. Phase 0 - Chốt mục tiêu thay thế cho ví đơn
   - Chốt rõ danh sách options của V1 cần giữ trong ví đơn (ví dụ: chọn kỳ thời gian, trạng thái loading/empty/error, tooltip/format hiển thị).
   - Chốt contract API cho 1 wallet theo hướng server chuẩn hóa sẵn dữ liệu hiển thị.
   - Quy ước đặt tên trong client: không dùng hậu tố `RawData` cho response từ server.

2. Phase 1 - Dựng khung `BalanceChartV2` tối giản nhưng chạy được end-to-end
   - Dùng `useGet(client.api.charts.balance, ...)` ngay trong component.
   - Render line chart 1 wallet + các trạng thái cơ bản.
   - Không mang sang cache Map, prefetch chunk, dual-fetch orchestration, auto-refresh mặc định.

3. Phase 2 - Bổ sung parity options của V1 cho ví đơn
   - Bổ sung tuần tự các options hiển thị đã chốt ở Phase 0.
   - Mỗi lần bổ sung phải giữ nguyên nguyên tắc: client chỉ map dữ liệu, không dựng pipeline xử lý nghiệp vụ.
   - Không thêm mode multi-wallet vào `BalanceChartV2`.

4. Phase 3 - Chuyển đổi callsite ví đơn sang V2
   - Tích hợp V2 vào khu vực ví đơn.
   - Chạy kiểm tra hành vi hiển thị và trải nghiệm để xác nhận thay thế thực tế.
   - Giữ V1 song song tạm thời cho đến khi pass tiêu chí chấp nhận.

5. Phase 4 - Hoàn tất thay thế trong khu vực ví đơn
   - Gỡ `BalanceChart` V1 khỏi callsite ví đơn.
   - Dọn code liên quan V1 chỉ phục vụ ví đơn.
   - Đóng track migration ví đơn khi đã thay thế hoàn toàn.

## Tiêu chí chấp nhận sau khi chỉnh kế hoạch

1. `BalanceChartV2` hiển thị ổn định cho 1 wallet và đạt parity options đã chốt từ V1 cho ví đơn.
2. `BalanceChartV2` dùng `useGet` trực tiếp, không đi qua `chartApi`.
3. Không còn cache/prefetch/auto-refresh mặc định kiểu V1 trong track ví đơn.
4. Không còn cách đặt tên gây hiểu nhầm "raw data" cho response đã chuẩn hóa từ server.
5. Callsite ví đơn đã chuyển sang V2 và có thể loại bỏ V1 trong khu vực này.
