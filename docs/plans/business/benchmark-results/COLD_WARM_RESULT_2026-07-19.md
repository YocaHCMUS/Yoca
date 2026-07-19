# Cold/warm benchmark result — 2026-07-19

Run: `runs/2026-07-19T07-40-56-131Z_journey-cold`. Database được reset ngay trước run; mỗi journey dùng một resource ổn định và được lặp lại ngay để đo warm behavior.

| Journey | Cold | Warm | Cold provider attempts | Warm provider attempts | Endpoint pass |
| --- | ---: | ---: | ---: | ---: | ---: |
| Market Radar | 25.440 ms | 661 ms | 23 | 0 | 12/12 |
| Token Overview | 17.570 ms | 1.141 ms | 17 | 0 | 16/16 |
| Wallet Core | 5.476 ms | 799 ms | 7 | 0 | 8/8 |

Immediate warm repeat tránh 100% provider attempts trong ba sample. Đây là kiểm tra hành vi reuse ngay sau cold fetch, không được diễn giải thành cache-hit ratio của traffic production.

## Provider units của cold pass

| Journey | Provider usage thành công quan sát được |
| --- | --- |
| Market Radar | CoinGecko 17 credits; Birdeye 135 CU gồm hai trader list x 30 CU và một token list x 75 CU. Có ba Birdeye 429/retry chưa cộng vào CU vì chưa xác nhận request lỗi có bị tính phí. |
| Token Overview | CoinGecko 15 credits; Mobula 2 credits cho hai lần holder positions. |
| Wallet Core | Mobula 21 credits: bốn Wallet Analysis x 5 và một Wallet Positions x 1; Helius Wallet API 200 credits từ hai balance calls. |

## Quan sát kiến trúc

- Market Radar fan-out theo pagination/batch: 17 request CoinGecko trong một cold journey, nên chi phí refresh phụ thuộc số page và batch chứ không chỉ số route client.
- Ba Birdeye operation được gọi đồng thời làm phát sinh 429 dù limiter code đang cho phép khoảng 13 request/giây. Standard key thể hiện giới hạn thực tế thấp hơn khi chạy đồng thời; cần quyết định giảm concurrency trước benchmark tải.
- Token holder route và holder-stats route cùng cold-start tạo hai Mobula holder calls cho cùng token.
- Wallet Overview, Portfolio, Token list và Win rate chạy đồng thời tạo bốn Mobula Wallet Analysis calls và hai Helius Wallet Balances calls cho cùng ví.
- Các duplicate cold calls cho thấy cache database đã hiệu quả sau khi có dữ liệu nhưng chưa có request coalescing/single-flight khi nhiều route cùng miss một lúc.

## Quota-only boundary sơ bộ

Các phép chia dưới đây chỉ cho thấy giới hạn nếu mọi journey đều cold; chưa phải MAU forecast vì shared cache, TTL, retry, interaction và traffic mix chưa được đưa vào.

- CoinGecko Demo 10.000 credit/tháng / 17 ≈ 588 cold Market Radar refresh.
- Birdeye Standard 30.000 CU/kỳ / 135 ≈ 222 cold Market Radar refresh.
- Mobula Free 10.000 credit/tháng / 21 ≈ 476 cold Wallet Core journey.
- Helius Free 1.000.000 credit/tháng / 200 = 5.000 cold Wallet Core journey.

Ngưỡng nâng gói sau cùng phải dựa trên số refresh theo TTL, tỷ lệ cold/warm đo từ traffic, peak concurrency, 429 và các interaction chưa nằm trong runner.
