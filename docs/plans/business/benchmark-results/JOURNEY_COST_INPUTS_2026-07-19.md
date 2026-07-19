# Journey cost inputs — 2026-07-19

File này nối số provider attempt quan sát được với đơn vị billing đã đối chiếu trong `PROVIDER_QUOTA_RESEARCH_CHECKLIST.md`. Đây là đầu vào kỹ thuật cho mô hình chi phí, không phải dự báo traffic hay doanh thu.

## Đơn vị refresh

Không lấy page view nhân trực tiếp với provider cost. Ba biến dưới đây chỉ tăng khi dữ liệu phải được làm mới:

- `M`: số lượt refresh Market Radar trong tháng. Dữ liệu dùng chung toàn hệ thống.
- `T`: tổng số token–TTL window phải refresh cho Token Overview trong tháng. Nhiều người xem cùng token trong một TTL window chỉ tính một lần.
- `W`: tổng số wallet–TTL window phải refresh cho Wallet Core trong tháng. Hai lượt xem cùng ví trong TTL window có thể dùng lại dữ liệu database.
- `A`: tổng số wallet activity range phải refresh trong tháng. Cost thay đổi theo mật độ giao dịch và số page swaps/transfers cần quét.
- `Z`: tổng số token chart phải refresh trong tháng. Một token được chọn tương ứng một Zerion chart request; mapping lookup được tính thêm khi token chưa có Zerion ID trong database.
- `X`: số Wash Trading analysis không dùng được transfer cache 5 phút. Tách `X_enhanced` và `X_fallback` theo nguồn dữ liệu.
- `E`: số Helius webhook event deliveries trong tháng; `G` là số create/update/delete webhook management calls.

Interaction như Wallet Activity pagination, token chart theo từng token, Wash Trading, AI và webhook được tính riêng; không ngầm gộp vào `M`, `T` hoặc `W`.

## Cost quan sát theo journey

| Journey refresh | CoinGecko | Birdeye | Mobula | Helius | Zerion | Warm repeat |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Market Radar `M` | 17 credit | 135 CU thành công | 0 | 0 | 0 | 0 provider attempt |
| Token Overview `T` | 15 credit | 0 | 1 credit | 0 | 0 | 0 provider attempt |
| Wallet Core `W` | 0 | 0 | 21 credit | 200 credit | 0 | 0 provider attempt |
| Wallet Activity `A` | 0 | 0 | 1–10 credits trong các post-fix samples | 0 | 0 | 0 provider attempt |
| Wallet Token Chart `Z` | 0 | 0 | 0 | 0 | 1 request/token; lượt ba token đầu tiên còn một mapping lookup | 0 provider attempt |

Nguồn run:

- Market Radar observed-first: `runs/2026-07-19T09-06-48-529Z_journey-observed/`.
- Token Overview cold: `runs/2026-07-19T09-01-00-323Z_journey-cold/`.
- Wallet Core cold: `runs/2026-07-19T09-03-47-373Z_journey-cold/`.
- Wallet Activity observed-first: `runs/2026-07-19T09-35-25-204Z_journey-observed/`.
- Wallet Activity post-fix: `runs/2026-07-19T09-59-59-065Z_journey-observed/`.
- Wallet Token Chart observed-first: `runs/2026-07-19T09-38-14-672Z_journey-observed/`.

Market Radar có hai retry Birdeye trong run. Bảng chỉ cộng cost của ba response thành công. Request lỗi chỉ được đưa vào quota sau khi xác nhận Birdeye có trừ CU cho lỗi hay không.

## Công thức quota nền

Các công thức chưa gồm retry, interaction và traffic nền:

```text
CoinGecko_credit = 17M + 15T
Birdeye_CU       = 135M
Mobula_credit    = T + 21W + pages(A)
Helius_credit    = 200W
Zerion_request   = Z + missing_mapping_batches
Helius_wash      = 100X_enhanced + 176X_fallback
Helius_webhook   = E + 100G
```

Với quota free hiện đã xác nhận, từng provider tạo một ràng buộc độc lập:

```text
17M + 15T <= 10,000 CoinGecko credit/tháng
135M      <= 30,000 Birdeye CU/kỳ
T + 21W + pages(A) <= 10,000 Mobula credit/tháng
200W      <= 1,000,000 Helius credit/tháng
Z + missing_mapping_batches <= 2,000 Zerion request/ngày
```

Không được cộng các quota khác đơn vị vào một tổng chung. Trong phạm vi các journey hiện tại, Birdeye giới hạn Market Radar trước CoinGecko; Mobula thường giới hạn Wallet Core trước Helius.

Với Wallet Activity, `pages(A)` phải lấy từ phân phối page count thay vì một hằng số. Baseline trước sửa là 2, 2 và 15 calls. Sau client lazy loading, shared coverage metadata và page-level single-flight, concurrent light case dùng 1 call; sequential heavy case dùng 6 calls rồi tab sau đọc database; đúng ví baseline nặng giảm 15 xuống 10. Upper bound hiện tại là 10 unique pages/range thay vì 20 calls từ hai vòng độc lập.

Wallet Token Chart xác nhận fan-out tuyến tính theo số token được chọn. Interaction ba token đầu tiên tạo bốn Zerion requests: một fungible mapping lookup theo batch và ba chart calls. Warm repeat không gọi provider. Vì Zerion dùng quota ngày, biến này phải được kiểm tra theo peak daily active usage thay vì chỉ quy đổi theo tháng.

Wash Trading không được gọi bằng benchmark route riêng vì production endpoint yêu cầu entitlement, trừ AI usage và có thể gọi Gemini. Bound được lấy từ control flow hiện hành: Enhanced-success dùng 100 credits; fallback đầy đủ dùng một Enhanced attempt cùng tối đa 76 Standard RPC calls, tổng 176 credits. Đây là upper bound theo code, chưa phải phân phối traffic quan sát.

Webhook không gắn với page view. Helius tính 1 credit cho mỗi event delivery và 100 credits cho mỗi management call. Yoca hiện chỉ lưu cấu hình webhook cùng alert history đã match, không lưu toàn bộ deliveries; do đó `E` phải là giả định theo số ví được theo dõi và event rate cho đến khi bổ sung event counter.

## Headroom và ngưỡng nâng gói

Mô hình dùng ngưỡng vận hành thay vì chờ quota cạn:

- Cảnh báo khi projected usage của kỳ đạt 70% quota; lập phương án nâng gói khi base projection đạt 80% hoặc kịch bản thận trọng vượt 100%.
- Giữ ít nhất 20% quota headroom cho retry, refresh thủ công, traffic nền và thay đổi fan-out.
- Xem throughput là bottleneck riêng: cảnh báo khi peak một phút đạt 70% giới hạn hoặc có 429 trong benchmark tải hợp lệ; không dùng quota tháng để biện minh cho burst vượt RPS.
- Provisional latency SLO cho benchmark: warm journey p95 không quá 2 giây; provider refresh p95 không quá 30 giây. Chỉ cân nhắc nâng gói vì latency khi limiter/provider wait là nguyên nhân chính, không phải query hoặc xử lý nội bộ.
- Error-rate gate: điều tra ngay khi 429 hoặc upstream error vượt 1% trong một run có ít nhất 100 request; chưa nâng gói trước khi loại được bug retry, duplicate refresh và cấu hình limiter sai.

Các ngưỡng trên là quy tắc ra quyết định nội bộ cho giai đoạn đồ án. Khi có traffic thật, thay projected usage bằng rolling 7-day run rate và giữ nguyên nguyên tắc headroom.

## Đầu vào còn thiếu trước ba kịch bản MAU

- Số session trung bình trên một MAU trong tháng.
- Tỷ lệ session mở Market Radar, Token Overview và Wallet Core.
- Số token và ví khác nhau được xem trong một TTL window; đây là biến quyết định reuse, không phải một cache-hit ratio chung.
- Fan-out thực tế của Wallet Activity, Zerion token chart, Moralis swaps, Wash Trading và webhook event.
- AI invocation và token input/output theo từng tính năng.

Ba mốc 300, 3.000 và 30.000 MAU chỉ được tính sau khi chốt các đầu vào này dưới dạng giả định sản phẩm. Số đo journey phía trên không thay đổi khi giả định MAU thay đổi.
