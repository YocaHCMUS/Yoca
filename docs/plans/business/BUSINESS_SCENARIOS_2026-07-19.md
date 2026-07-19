# Kịch bản chi phí và doanh thu — 2026-07-19

Tài liệu nội bộ này dựng ba kịch bản 300, 3.000 và 30.000 MAU từ cùng một bộ giả định. Mục tiêu là làm rõ điểm hòa vốn vận hành và thời điểm nâng gói, không biến số MAU thành một dự báo tăng trưởng đã được kiểm chứng. Công thức có thể chạy lại bằng `calculate-business-scenarios.ts` khi số đo production thay đổi.

## Phạm vi và giả định cơ sở

Trong tài liệu này, MAU là số người dùng khác nhau có ít nhất một tương tác cần dữ liệu từ Yoca trong cửa sổ 30 ngày. Khái niệm bao gồm cả tài khoản và khách chưa đăng nhập; khi triển khai analytics, khách cần anonymous identifier ổn định để không đếm mỗi page view thành một người mới. Mô hình chưa tách hai nhóm vì provider cost phụ thuộc hành trình và tài nguyên được xem, còn doanh thu chỉ lấy từ tỷ lệ thuê bao trả phí.

Mô hình dùng cơ cấu 92% Standard, 5% Lite, 2% Plus và 1% Pro; giá tháng lần lượt là 0, 39, 79 và 149 USD. Mỗi MAU có tám phiên hoạt động trong tháng. Đây là giả định kinh doanh, chưa phải analytics người dùng thật.

Một phiên không được quy đổi thẳng thành một lần gọi provider. Yoca đọc database trước và chỉ refresh khi dữ liệu stale, nên mô hình dự báo theo số cold load hoặc cửa sổ refresh:

- Market Radar có 180, 720 và 2.880 cửa sổ có nhu cầu refresh ở ba quy mô. Mỗi refresh cold quan sát được dùng 17 CoinGecko credit và 135 Birdeye CU.
- 70% phiên mở Token Overview; tỷ lệ cold load là 30%, 30% và 20% khi quy mô tăng và cache được chia sẻ tốt hơn. Một cold load dùng proxy 15 CoinGecko credit và 1 Mobula credit.
- 50% phiên mở Wallet Core; 90% địa chỉ/cửa sổ bị xem là cold vì ví mang tính cá nhân. Một cold load dùng 21 Mobula credit và 100 Helius credit theo benchmark hiện tại.
- 20% phiên mở Wallet Activity; 35% cần refresh và trung bình đọc ba page Mobula. Wallet token chart được giả định xuất hiện ở 15% phiên, 30% số lượt là cold và mỗi lượt chọn hai token.
- AI dùng adoption cơ sở trong `AI_TIER_COST_MODEL_2026-07-19.md`. Brave Search chỉ được tính cho fallback Ask Yoca 25%, một search mỗi Token Chart News và ba search mỗi Volatility theo pilot. 1.000 Search request đầu tháng được bù bằng credit 5 USD.

## Kết quả cơ sở

| Chỉ tiêu/tháng | 300 MAU | 3.000 MAU | 30.000 MAU |
| --- | ---: | ---: | ---: |
| Thuê bao Lite / Plus / Pro | 15 / 6 / 3 | 150 / 60 / 30 | 1.500 / 600 / 300 |
| Doanh thu ghi nhận | 1.506,00 USD | 15.060,00 USD | 150.600,00 USD |
| Blockchain data provider | 85,00 USD | 523,00 USD | 1.787,00 USD* |
| Gemini + Brave Search | 71,78 USD | 762,84 USD | 7.673,43 USD |
| Render + Supabase | 7,00 USD | 50,00 USD | 80,00 USD |
| Phí thanh toán giả định | 50,87 USD | 508,74 USD | 5.087,40 USD |
| Tổng chi phí trực tiếp | 214,66 USD | 1.844,58 USD | 14.627,83 USD |
| Số dư đóng góp | 1.291,34 USD | 13.215,42 USD | 135.972,17 USD |
| Biên đóng góp | 85,75% | 87,75% | 90,29% |

`*` Mobula tại 30.000 MAU vượt 1,25 triệu credit của Growth. Mô hình dùng 750 USD là giá khởi điểm Enterprise, vì vậy tổng 1.787 USD chỉ là sàn ngân sách, chưa phải báo giá cam kết.

Chi phí thanh toán dùng proxy Stripe công khai 2,9% + 0,30 USD cho mỗi giao dịch thành công. Yoca chưa chốt pháp nhân, quốc gia merchant và phương thức thanh toán, nên con số này chỉ dùng để tránh bỏ quên payment processing; báo giá thực tế phải thay thế nó.

## Điểm đổi gói theo dải MAU

Ba cột trên chỉ là lát cắt trình bày. Calculator còn quét từ 100 đến 50.000 MAU với bước 25 và ghi lại lúc gói nhỏ nhất không còn đủ quota. Kết quả cơ sở hiện tại:

| MAU ước tính | Provider | Chuyển gói |
| ---: | --- | --- |
| 150 | Mobula | Free → Start-up |
| 300 | CoinGecko | Demo → Basic |
| 450 | Birdeye | Standard → Lite |
| 1.600 | Mobula | Start-up → Growth |
| 2.775 | Helius | Free → Developer |
| 3.525 | CoinGecko | Basic → Analyst |
| 15.925 | Mobula | Growth → Enterprise, giá sàn |
| 26.325 | CoinGecko | Analyst → Lite |
| 27.650 | Helius | Developer → Business |

Các điểm này là tín hiệu lập ngân sách, không phải trigger tự động. Market Radar được nội suy theo nhu cầu giữa ba mức quan sát giả định và chặn ở 2.880 cửa sổ refresh/tháng; tỷ lệ cold Token Overview giảm dần từ 30% xuống 20% khi cache được chia sẻ trên tập người dùng lớn hơn. Sai số của hai giả định này có thể dịch chuyển CoinGecko và Birdeye đáng kể. Quyết định thật dùng mức tiêu thụ dự phóng trong 30 ngày, headroom cho peak traffic, tỷ lệ 429 và thời gian chuẩn bị nâng gói.

Một policy vận hành phù hợp là bắt đầu đánh giá khi dự báo đạt 70% quota, chuẩn bị nâng ở 85%, và không chờ đến khi provider từ chối request. Với provider có giới hạn throughput riêng như Mobula Wallet Analysis, RPS/RPM vẫn có thể buộc nâng hoặc thay đổi kiến trúc trước khi hết quota tháng.

## Nhu cầu provider và gói được chọn

| Provider | 300 MAU | 3.000 MAU | 30.000 MAU |
| --- | --- | --- | --- |
| CoinGecko | 10.620 credits → Basic 35 USD | 87.840 → Basic 35 USD | 552.960 → Lite 499 USD |
| Birdeye | 24.300 CU → Standard 0 USD | 97.200 → Lite 39 USD | 388.800 → Lite 39 USD |
| Mobula | 23.688 credits → Start-up 50 USD | 236.880 → Growth 400 USD | 2.352.000 → Enterprise từ 750 USD |
| Helius | 108.576 credits → Free | 1.085.760 → Developer 49 USD | 10.857.600 → Business 499 USD |
| Zerion | 216 requests → Developer 0 USD | 2.160 → Developer 0 USD | 21.600 → Developer 0 USD |

Zerion Developer cho 2.000 request/ngày, nên ba tổng tháng trên chưa vượt throughput trung bình. Tuy nhiên giá tier kế tiếp chưa có nguồn public đủ chắc chắn; mô hình không gán một mức giá giả. Tại 30.000 MAU, Helius chỉ vượt Developer khoảng 8,6%. Nếu tài khoản cho mua credit bổ sung trên Developer, phương án đó có thể rẻ hơn Business; hiện mô hình chọn gói công khai đủ quota để giữ kịch bản an toàn.

## Hạ tầng

Frontend Vite tiếp tục là Render Static Site, không có compute fee riêng trong baseline. API dùng Render Starter 7 USD ở 300 MAU, Standard 25 USD ở 3.000 MAU và hai Standard instance, tổng 50 USD, ở 30.000 MAU. Database dùng Supabase Free ở 300 MAU, Pro Micro 25 USD ở 3.000 MAU và Pro Small khoảng 30 USD sau compute credit ở 30.000 MAU.

Các lựa chọn instance là ngân sách dung lượng, chưa phải kết quả load test. Trước khi khẳng định 30.000 MAU, cần đo CPU, memory, p95 latency, connection pool và database size. Autoscaling Render cần workspace phù hợp; nếu chạy hai instance thủ công thì session pooler và single-flight process-local không ngăn refresh trùng giữa hai process.

## Cách đọc kết quả

Biên tăng theo MAU vì doanh thu thuê bao tăng tuyến tính trong khi provider bán theo bậc quota. Điều này không chứng minh hệ thống đã chịu được 30.000 MAU. Hai rủi ro lớn nhất là Mobula Wallet Core và adoption AI của người dùng Standard: một bên tạo bước nhảy gói dữ liệu, bên còn lại phát sinh chi phí dù không có doanh thu trực tiếp.

Kịch bản 300 MAU đã vượt free quota CoinGecko và Mobula theo giả định cơ sở. Vì vậy không nên viết rằng toàn bộ production có thể duy trì miễn phí. Cách trình bày phù hợp là free tier đủ cho thử nghiệm ban đầu; khi có lưu lượng đều đặn, Yoca nâng có chọn lọc provider theo số credit/CU quan sát được.

## Độ nhạy theo nhu cầu sử dụng

Ba profile giữ nguyên MAU, giá bán và tỷ lệ trả phí để chỉ quan sát ảnh hưởng của hành vi sử dụng. `Favorable` dùng 6 phiên/MAU, cache reuse cao hơn và 60% AI adoption của baseline. `Base` dùng các giả định đã trình bày. `Pressure` dùng 12 phiên/MAU, gần như mọi Wallet Core là cold, Wallet Activity dày hơn và AI usage bằng 160% baseline.

| MAU | Profile | Data provider | Gemini + Brave | Tổng chi phí trực tiếp | Biên đóng góp |
| ---: | --- | ---: | ---: | ---: | ---: |
| 300 | Favorable | 50,00 USD | 29,55 USD | 137,43 USD | 90,87% |
| 300 | Base | 85,00 USD | 71,78 USD | 214,66 USD | 85,75% |
| 300 | Pressure | 124,00 USD | 179,28 USD | 361,16 USD | 76,02% |
| 3.000 | Favorable | 474,00 USD | 340,53 USD | 1.373,27 USD | 90,88% |
| 3.000 | Base | 523,00 USD | 762,84 USD | 1.844,58 USD | 87,75% |
| 3.000 | Pressure | 617,00 USD | 1.837,82 USD | 3.013,56 USD | 79,99% |
| 30.000 | Favorable | 967,00 USD | 3.450,29 USD | 9.584,69 USD | 93,64% |
| 30.000 | Base | 1.787,00 USD | 7.673,43 USD | 14.627,83 USD | 90,29% |
| 30.000 | Pressure | 1.787,00 USD | 18.423,23 USD | 25.377,63 USD | 83,15% |

Kết quả cho thấy AI adoption làm biên biến động liên tục, còn data provider biến động theo bậc quota. Provider cost giống nhau giữa Base và Pressure ở 30.000 MAU không có nghĩa usage bằng nhau; cả hai cùng rơi vào những gói công khai đã chọn. Riêng Mobula vẫn là giá sàn Enterprise nên độ nhạy provider tại quy mô này chưa thể xem là báo giá cuối.

Conversion được chạy riêng trên demand profile Base. Cơ cấu Lite/Plus/Pro vẫn giữ tỷ lệ 5:2:1, chỉ thay tổng tỷ lệ trả phí thành 4%, 8% và 12%.

| MAU | Payer conversion | Doanh thu | Tổng chi phí trực tiếp | Biên đóng góp |
| ---: | ---: | ---: | ---: | ---: |
| 300 | 4% | 753,00 USD | 189,20 USD | 74,87% |
| 300 | 8% | 1.506,00 USD | 214,66 USD | 85,75% |
| 300 | 12% | 2.259,00 USD | 240,12 USD | 89,37% |
| 3.000 | 4% | 7.530,00 USD | 1.589,98 USD | 78,88% |
| 3.000 | 8% | 15.060,00 USD | 1.844,58 USD | 87,75% |
| 3.000 | 12% | 22.590,00 USD | 2.099,19 USD | 90,71% |
| 30.000 | 4% | 75.300,00 USD | 12.081,77 USD | 83,96% |
| 30.000 | 8% | 150.600,00 USD | 14.627,83 USD | 90,29% |
| 30.000 | 12% | 225.900,00 USD | 17.173,90 USD | 92,40% |

Conversion thấp làm biên giảm nhưng chưa làm số dư đóng góp âm trong các tổ hợp này. Điều đó phụ thuộc mạnh vào mức giá đang đề xuất và chưa tính lương, marketing, thuế, hỗ trợ hay chi phí pháp lý; không được diễn giải bảng như lợi nhuận ròng.

## Độ nhạy còn phải bổ sung hoặc giữ thành giới hạn

- Phân phối Wallet Activity page thay vì chỉ dùng trung bình ba page.
- Market Radar theo cửa sổ refresh thực tế; không lấy 24 giờ chia TTL nếu không có người dùng liên tục.
- Hai phương án Helius 30.000 MAU: Developer cộng credit bổ sung và Business.
- Báo giá Mobula cho mức 2,37 triệu credit; thay giá sàn Enterprise bằng giá thật.
- Load test Render/Supabase để thay ngân sách instance bằng cấu hình đo được.
- Tỷ lệ thuê bao năm. Nếu 30% người trả phí chọn năm với hai tháng miễn phí, doanh thu ghi nhận theo tháng giảm khoảng 5%; fixed fee trên mỗi giao dịch lại giảm vì chỉ thu một lần mỗi năm.

## Trạng thái quota AI

Cost forecast dùng adoption theo feature, không giả định mọi người dùng sử dụng hết quota. Quota v0 trong `AI_TIER_COST_MODEL_2026-07-19.md` đã được đồng bộ vào entitlement và Pricing UI ngày 2026-07-19. Wallet AI cũ không còn được quảng bá; Wash Trading Analysis và Chat có hạn mức riêng từ Plus.

Trước khi phát hành pricing thật, nhóm vẫn phải smoke test reserve/release của các feature và xác nhận Stripe Price ID tháng/năm trên dashboard. Calculator dùng expected adoption nên không thay thế phép kiểm tra stress ceiling khi quyền lợi thay đổi.

## Nguồn giá

Giá được rà ngày 2026-07-19 từ tài liệu chính thức: Mobula Pricing, CoinGecko API Pricing, Birdeye Pricing, Helius Pricing, Render Pricing/Free Deploy, Supabase Pricing, Brave Search API, Gemini API Pricing và Stripe Pricing. Chi tiết quota, endpoint unit cost và URL nằm trong `PROVIDER_QUOTA_RESEARCH_CHECKLIST.md`.
