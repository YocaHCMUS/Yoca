# Yoca Business Model — Developer Handbook

## Mục đích và phạm vi

Đây là tài liệu bàn giao nội bộ. Nội dung công khai các giả định, cost proxy, khoảng trống kỹ thuật và điều kiện cập nhật mô hình. Không đưa API key, credential, session token hoặc giá trị `.env` vào file này.

Nguồn chuẩn hiện tại:

- `calculate-business-scenarios.ts`: công thức và kết quả có thể chạy lại.
- `BUSINESS_SCENARIOS_2026-07-19.md`: giải thích kịch bản cơ sở.
- `PROVIDER_QUOTA_RESEARCH_CHECKLIST.md`: giá, quota và operation cost.
- `JOURNEY_COST_INPUTS_2026-07-19.md`: benchmark journey và fan-out.
- `AI_TIER_COST_MODEL_2026-07-19.md`: AI sample cost và quota.
- Thư mục `benchmark-results/runs/`: raw artifacts.

Hai báo cáo và slide là output. Khi một TTL, route, provider hoặc giá bán thay đổi, cập nhật nguồn chuẩn và chạy calculator trước khi sửa output.

## Quyết định pricing đã chốt

| Tier | Persona | Giá tháng/năm | Vai trò sản phẩm |
| --- | --- | ---: | --- |
| Standard/Free | Người dùng mới, khảo sát không thường xuyên | 0 / 0 USD | Trải nghiệm dữ liệu lõi và AI ở mức thử nghiệm |
| Lite | Retail user theo dõi token/ví thường xuyên | 39 / 390 USD | Dung lượng AI thường nhật cao hơn |
| Plus | Active trader/researcher cần phân tích chuyên sâu | 79 / 790 USD | Mở Wash Trading Analysis và Chat |
| Pro | Power user sử dụng nhiều feature mỗi ngày | 149 / 1.490 USD | Quota cao hơn, vẫn là gói cá nhân một chỗ ngồi |

Giá năm bằng 10 tháng sử dụng. Giá được giữ ở 39/79/149 vì nằm giữa các tham chiếu hiện hành: CryptoQuant 29/99 USD, Dune 75/399 USD và Nansen API Pro 69 USD theo tháng hoặc 49 USD/tháng khi trả năm. So sánh chỉ dùng để xác định vùng định vị; tính năng và đối tượng của từng nền tảng không hoàn toàn giống Yoca.

Nguồn khảo sát chính thức ngày 2026-07-19:

- https://cryptoquant.com/en/pricing
- https://docs.dune.com/resources/credits-billing/how-credits-work
- https://academy.nansen.ai/en/articles/1287744-plans-and-pricing
- https://docs.nansen.ai/about/credits-and-pricing-guide

### Quota AI được áp dụng

| Feature | Free | Lite | Plus | Pro |
| --- | ---: | ---: | ---: | ---: |
| Ask Yoca AI | 1 | 3 | 6 | 12 |
| Wallet Chat | 1 | 4 | 8 | 12 |
| Token Chart News | 1 | 2 | 4 | 8 |
| Volatility Summary | 1 | 3 | 4 | 8 |
| Wash Trading Analysis | 0 | 0 | 3 | 5 |
| Wash Trading Chat | 0 | 0 | 5 | 10 |

Quota reset lúc 00:00 UTC. Wash Trading Analysis và Chat yêu cầu Plus. Wallet AI modal cũ không còn được quảng bá trong pricing. Source cũ từng đặt 5–100 lượt/ngày; stress ceiling tối thiểu của mức đó vượt giá Lite/Plus/Pro nên đã được thay bằng bảng trên.

### Trạng thái kỹ thuật sau khi chốt

- `ai-usage.service.ts` chứa quota chuẩn và feature ID `wash_trading_ai_chat`.
- Route Wash Trading Chat yêu cầu đăng nhập, kiểm tra Plus/Pro, reserve usage trước Gemini và release khi xử lý lỗi.
- Pricing UI và popup Wallet Chat hiển thị quota mới.
- Pricing UI giữ giá 39/79/149 và toggle năm 10× giá tháng.
- Cần kiểm tra Stripe Dashboard để bảo đảm Price ID tháng/năm trong environment trỏ đúng 39/390, 79/790 và 149/1.490 USD. Repo không thể tự xác nhận giá nằm sau Price ID.
- Luồng thanh toán SOL hiện dùng Devnet/Testnet với số SOL cố định 0,001/0,005/0,01 nhằm kiểm thử xác minh giao dịch. Đây chưa phải USD→SOL pricing cho Mainnet và không được dùng làm nguồn giá thương mại.

## Việc giới hạn tính năng còn phải hoàn thiện

Mục này chỉ dùng nội bộ, không đưa vào bản hướng giảng viên hoặc slide.

### Alert và chi phí Resend

Alert hiện có thể gửi đồng thời một email qua Resend và một Discord webhook khi giao dịch khớp rule. Password reset cũng dùng Resend, vì vậy hai luồng dùng chung quota email. Discord không có đơn giá gửi tin nhắn trong mô hình nhưng vẫn tạo request, chịu rate limit và làm tăng tải xử lý.

Entitlement dự kiến:

| Tier | Ví theo dõi | Rule hoạt động | Event gửi ra ngoài/tháng |
| --- | ---: | ---: | ---: |
| Free | 0 | 0 | 0 |
| Lite | 2 | 3 | 100 |
| Plus | 5 | 10 | 500 |
| Pro | 15 | 30 | 2.000 |

Một giao dịch khớp rule tính là một event dù gửi qua một hay cả hai kênh. Khi hết quota, hệ thống có thể tiếp tục ghi lịch sử nhưng không gửi email/Discord. Password reset không bị chặn bởi quota Alert.

Calculator tạm giả định người dùng sử dụng 10% hạn mức event và 5% MAU phát sinh một email khôi phục mỗi tháng. Resend Free có 3.000 email/tháng và 100 email/ngày; Pro 20 USD có 50.000 email/tháng. Mô hình nâng lên Pro khi dự báo vượt 2.100 email, tương đương 70% quota Free, để dành headroom cho đợt giao dịch tăng đột biến. Nguồn: https://resend.com/pricing và https://resend.com/docs/knowledge-base/account-quotas-and-limits, khảo sát ngày 2026-07-19.

**TODO kỹ thuật trước khi công bố entitlement Alert:**

- Chặn tạo followed wallet và alert rule ở Free.
- Enforce số ví, số rule hoạt động và số event gửi theo tier tại server.
- Dùng counter bền vững trong database; không dùng bộ đếm process-local.
- Ghi Resend success/failure, quota header và Discord dispatch vào analytics.
- Dành quota riêng cho password reset để Alert không làm gián đoạn khôi phục tài khoản.
- Thêm queue/throttling vì Resend mặc định giới hạn 5 request/giây trên toàn team.

### Wash Trading Chat

Backend đã có feature ID, kiểm tra Plus/Pro, reserve/release usage và hạn mức 5/10 lượt mỗi ngày cho Plus/Pro. Phần còn lại cần hoàn thiện là xử lý trạng thái locked/limit nhất quán trên giao diện và smoke test các trường hợp 401, 403, 429 cùng việc hoàn lượt khi Gemini thất bại. Không mô tả giới hạn này là đã hoàn thiện trong tài liệu hướng giảng viên cho đến khi kiểm tra xong luồng người dùng.

## Phương pháp tính

MAU là số người dùng khác nhau có ít nhất một tương tác cần dữ liệu Yoca trong 30 ngày. Anonymous user cần identifier ổn định khi có analytics thật. Cost model hiện gộp guest và account; revenue dùng payer mix riêng.

Biến journey:

- `M`: Market Radar refresh windows.
- `T`: Token Overview cold loads.
- `W`: Wallet Core wallet–TTL windows.
- `A`: Wallet Activity ranges/pages.
- `Z`: token chart refreshes.
- `X`: Wash Trading refreshes.
- `E/G`: webhook deliveries/management calls.

Cost nền:

```text
CoinGecko = 17M + 15T credits
Birdeye   = 135M CU
Mobula    = T + 21W + pages(A) credits
Helius    = 100 × wallet balance pages + Wash Trading credits
Zerion    = Z + missing mapping batches
AI        = Gemini input/output/thinking + Brave Search
Email     = Alert deliveries + password reset emails → Resend tier
```

Không cộng các đơn vị khác nhau thành một quota chung. Retry chỉ được cộng vào billing khi provider xác nhận cách tính hoặc phép đo usage cho thấy có trừ quota.

### Cost quan sát theo journey

| Journey | Cost proxy cold | Warm repeat quan sát |
| --- | --- | --- |
| Market Radar | 17 CoinGecko + 135 Birdeye CU | 0 provider attempt |
| Token Overview | 15 CoinGecko + 1 Mobula | 0 |
| Wallet Core | 21 Mobula + 100 Helius cho ví một balance page | 0 |
| Wallet Activity | 1–10 Mobula pages trong post-fix samples | 0 |
| Wallet token chart | 1 Zerion request/token; mapping lookup nếu thiếu ID | 0 |
| Wash Trading | 100 Helius Enhanced; upper fallback 176 credits | Reuse transfer input 5 phút khi còn hiệu lực |

AI hiện dùng sample cost/proxy, chưa phải median/p95. Wallet Chat đặc biệt nhạy với tool selection và có thể fan-out sang nhiều provider.

## Assumptions và kết quả

Mô hình duy nhất dùng 8 session/MAU/tháng và payer conversion 2%, gồm Lite/Plus/Pro bằng 1,25%/0,5%/0,25%. Token, wallet, activity, Alert và AI adoption được ghi chi tiết trong calculator.

| MAU | Revenue | Direct cost | Contribution | Margin |
| ---: | ---: | ---: | ---: | ---: |
| 300 | 376,50 | 176,47 | 200,03 | 53,13% |
| 3.000 | 3.765,00 | 1.482,67 | 2.282,33 | 60,62% |
| 30.000 | 37.650,00 | 10.383,73 | 27.266,27 | 72,42% |

Direct cost gồm blockchain data provider, Gemini/Brave, Resend, Render/Supabase và payment processing proxy. Contribution chưa trừ lương, marketing, thuế, pháp lý và support.

Để nhóm dễ hiểu và trình bày thống nhất, calculator không còn xuất nhiều profile nhu cầu hoặc nhiều conversion. Khi có analytics người dùng thật, nhóm thay trực tiếp bộ giả định cơ sở và tính lại, thay vì duy trì nhiều kịch bản song song.

## Phân tích số dư và phân bổ nguồn tiền

Phần này trả lời câu hỏi “Yoca lời bao nhiêu?” theo cách nhóm có thể giải thích được. Quy đổi minh họa dùng 1 USD bằng 25.000 đồng. `Contribution` là số dư sau chi phí trực tiếp, chưa phải lợi nhuận ròng. Chỉ phần được chủ động giữ lại sau ngân sách nhân sự, tăng trưởng, dự phòng và nghĩa vụ doanh nghiệp mới có thể xem là thặng dư vận hành.

### Mốc 300 MAU — MVP tự trang trải

Trong 300 MAU có khoảng 6 người trả phí. Doanh thu là 376,50 USD/tháng; sau 176,47 USD chi phí trực tiếp còn 200,03 USD, tương đương khoảng 5 triệu đồng.

| Phân bổ | Tỷ lệ | USD/tháng | Xấp xỉ VND/tháng |
| --- | ---: | ---: | ---: |
| Dự phòng provider và phát triển sản phẩm | 40% | 80,01 | 2,00 triệu |
| Thu hút và hỗ trợ người dùng | 30% | 60,01 | 1,50 triệu |
| Hỗ trợ 4 thành viên bán thời gian | 20% | 40,01 | 1,00 triệu |
| Hành chính và chi phí phát sinh | 10% | 20,00 | 0,50 triệu |

Khoản hỗ trợ bình quân chỉ khoảng 250 nghìn đồng mỗi người. Mốc này chứng minh sản phẩm có thể tự thanh toán chi phí và tiếp tục phát triển; chưa tạo ra thu nhập ổn định.

### Mốc 3.000 MAU — duy trì đội ngũ thường xuyên

Trong 3.000 MAU có khoảng 60 người trả phí. Doanh thu là 3.765 USD/tháng; sau 1.482,67 USD chi phí trực tiếp còn 2.282,33 USD, tương đương khoảng 57,06 triệu đồng. Lượng người dùng ổn định ở mốc này là tín hiệu sản phẩm có tiềm năng, vì vậy nhóm chuyển sang cơ cấu bốn vị trí thường xuyên thay vì tiếp tục xem đây là công việc phụ.

| Phân bổ | Tỷ lệ | USD/tháng | Xấp xỉ VND/tháng |
| --- | ---: | ---: | ---: |
| Thu nhập đội ngũ | 60% | 1.369,40 | 34,24 triệu |
| Marketing và phát triển người dùng | 20% | 456,47 | 11,41 triệu |
| Dự phòng và phát triển sản phẩm | 10% | 228,23 | 5,71 triệu |
| Hành chính, thuế và pháp lý | 10% | 228,23 | 5,71 triệu |

Nếu bốn thành viên cùng làm thường xuyên, ngân sách đội ngũ bình quân khoảng 342 USD, tương đương 8,56 triệu đồng mỗi người. Đây là mức vận hành thận trọng của một nhóm nhỏ, chưa tạo nhiều dư địa tuyển thêm người.

### Mốc 30.000 MAU — mở rộng thành đơn vị vận hành

Trong 30.000 MAU có khoảng 600 người trả phí. Doanh thu là 37.650 USD/tháng; sau 10.383,73 USD chi phí trực tiếp còn 27.266,27 USD, tương đương khoảng 681,66 triệu đồng. Đây là quy mô một doanh nghiệp nhỏ, nhưng Yoca phải tiếp tục chi mạnh để duy trì 30.000 người dùng và phục vụ 600 khách hàng trả phí.

| Phân bổ | Tỷ lệ | USD/tháng | Xấp xỉ VND/tháng |
| --- | ---: | ---: | ---: |
| Nhân sự khoảng 20 người | 25% | 6.816,57 | 170,41 triệu |
| Marketing, thu hút và giữ người dùng | 40% | 10.906,51 | 272,66 triệu |
| Phát triển sản phẩm và bảo mật | 15% | 4.089,94 | 102,25 triệu |
| Hành chính, thuế và pháp lý | 10% | 2.726,63 | 68,17 triệu |
| Dự phòng | 5% | 1.363,31 | 34,08 triệu |
| Thặng dư vận hành | 5% | 1.363,31 | 34,08 triệu |

Ngân sách nhân sự bình quân khoảng 8,52 triệu đồng/người cho đội ngũ 20 người. Đây là ngân sách bình quân, còn phải điều chỉnh theo vai trò và nghĩa vụ lao động. Thặng dư chỉ chiếm 5%; biến động về chi phí thu hút người dùng, provider hoặc conversion có thể làm phần này giảm đáng kể.

### Lập luận nhóm cần thống nhất

300 MAU giúp Yoca tự nuôi sản phẩm; 3.000 MAU tạo điều kiện duy trì bốn người làm việc thường xuyên với mức thu nhập thận trọng; 30.000 MAU đòi hỏi mở rộng thành doanh nghiệp nhỏ khoảng 20 người nhưng vẫn chỉ giữ 5% thặng dư. Các tỷ lệ phân bổ là nguyên tắc lập ngân sách, không phải cam kết lương hay kết quả đã đạt được.

## Provider breakpoint và policy nâng gói

Base scan từ 100 đến 50.000 MAU cho các tín hiệu ngân sách:

| MAU ước tính | Thay đổi |
| ---: | --- |
| 150 | Mobula Free → Start-up |
| 300 | CoinGecko Demo → Basic |
| 450 | Birdeye Standard → Lite |
| 1.600 | Mobula Start-up → Growth |
| 2.775 | Helius Free → Developer |
| 3.525 | CoinGecko Basic → Analyst |
| 15.925 | Mobula Growth → Enterprise, giá từ 750 USD |
| 26.325 | CoinGecko Analyst → Lite |
| 27.750 | Helius Developer → Developer + credit bổ sung |

Breakpoint phụ thuộc demand assumptions. Policy vận hành:

- Review ở projected 70% quota.
- Chuẩn bị nâng ở khoảng 85%.
- Giữ tối thiểu 20% headroom cho retry, manual refresh và fan-out drift.
- Xem 429, RPS/RPM và p95 latency tách khỏi quota tháng.
- Nâng Render theo CPU/RAM/latency khi có số đo; không nâng chỉ vì MAU.

Mobula trên 1,25 triệu credit dùng giá Enterprise công khai từ 750 USD; giá hợp đồng cụ thể chỉ cần xác nhận khi mua. Helius công bố credit bổ sung cho gói trả phí ở mức 5 USD mỗi 1 triệu credit, nên vượt nhẹ 10 triệu vẫn giữ Developer thay vì lên Business. Zerion Developer của key hiện tại có 2.000 request/ngày; tier kế tiếp là Builder 149 USD/tháng với 250.000 request.

## Hạ tầng và nhân sự

Cost scenario dùng Static Site 0 USD, Render Starter 7 USD làm production floor, Standard 25 USD cho mức cao hơn và ngân sách 25–50 USD ở lát cắt lớn. Supabase dùng Free ban đầu và Pro từ 25 USD. Đây là capacity budget, không phải claim hệ thống chịu được một MAU cụ thể.

Nhân sự và phân bổ nguồn tiền được trình bày riêng ở mục trên. External funding chỉ xuất hiện sau PoC/MVP, traction và kế hoạch sử dụng vốn; baseline vẫn ưu tiên tăng trưởng từ doanh thu.

## Quy trình cập nhật mô hình

1. Khi thêm route/provider operation, gắn `pFetch`/Gemini tracking ID.
2. Chạy journey cold/warm và lưu artifact có timestamp.
3. Đối chiếu unit cost/quota với tài liệu hoặc usage delta.
4. Cập nhật journey cost input.
5. Cập nhật assumptions nếu hành vi sản phẩm đổi.
6. Chạy `npm run business:calculate-scenarios -w=server --verbose`.
7. Kiểm tra provider plan transition, contribution margin và stress ceiling AI.
8. Cập nhật handbook, teacher report và slide theo thứ tự đó.

Không lấy một lần chạy làm mean. Không coi response rỗng hợp lệ là lỗi. Không dùng profitable label/PnL của provider này làm ground truth cho PnL provider khác.

## FAQ nội bộ và phản biện

### Vì sao dùng MAU trong khi provider tính request?

MAU giúp tạo kịch bản kinh doanh. Calculator chuyển MAU thành session, journey, cold resource windows và cuối cùng mới thành request/credit. MAU không được nhân trực tiếp với một cost trung bình toàn hệ thống.

### Vì sao ba mốc MAU vẫn được giữ?

Ba mốc là lát cắt dễ đọc trên slide. Calculator quét liên tục để phát hiện breakpoint nên quyết định nâng cấp không bị khóa vào ba mốc.

### 53–71% có phải lợi nhuận không?

Đó là contribution margin sau direct cost. Lương, marketing, thuế, pháp lý và support chưa được trừ.

### Thầy hỏi: “Rốt cuộc tụi em lời bao nhiêu?”

> Trong kịch bản cơ sở 300 MAU, nhóm em dự kiến thu khoảng 377 USD và còn khoảng 200 USD sau chi phí trực tiếp. Khoản này chủ yếu được giữ cho sản phẩm nên chưa tạo thu nhập đáng kể. Khoảng 3.000 MAU, với 60 người trả phí, mới là mốc đủ duy trì bốn thành viên làm việc thường xuyên ở mức khoảng 8–9 triệu đồng mỗi người. Khi đạt 30.000 MAU, Yoca phải mở rộng đội ngũ và tiếp tục dành phần lớn nguồn tiền cho tăng trưởng; thặng dư vận hành dự kiến chỉ khoảng 5% số dư sau chi phí trực tiếp.

### Vì sao biên đóng góp tăng khi MAU tăng?

Revenue tăng gần tuyến tính theo payer mix, còn provider bán theo gói quota. Giữa hai breakpoint, phần quota chưa dùng tạo operating leverage. Khi đổi gói, cost nhảy bậc.

### Vì sao 300 MAU đã phải nâng provider?

Mô hình giả định wallet cold rate cao và 8 session/MAU. Breakpoint là tín hiệu ngân sách từ bộ giả định cơ sở, chưa phải quan sát production.

### Vì sao quota AI thấp hơn UI cũ?

UI cũ tăng đồng loạt đến 100 lượt/ngày. Stress ceiling của quyền lợi này vượt giá gói trước khi cộng data/hosting. Quota mới dùng cost profile từng feature và giữ headroom.

### Tại sao Standard vẫn có AI?

Một lượt/ngày giúp người dùng hiểu giá trị sản phẩm. Free AI cost là acquisition cost có kiểm soát; abuse được chặn bởi authentication và daily usage counter.

### Tại sao không tự tính toàn bộ PnL?

Wallet có thể có lịch sử rất dài và transaction abstraction không luôn đầy đủ. Yoca dùng provider analysis để giữ latency/coverage trong phạm vi sản phẩm, đồng thời normalize dữ liệu cần hiển thị và kiểm tra response bằng schema.

### Nâng Render hay nâng provider khi trang chậm?

Nâng provider khi limiter/RPS/429 hoặc upstream quota là bottleneck. Nâng Render khi CPU, memory hoặc request queueing là nguyên nhân. End-to-end latency một mình chưa đủ xác định bên cần nâng.

### Vì sao chưa gọi kết quả là benchmark production?

Artifacts hiện chủ yếu là compatibility, cold/warm journey và AI pilot. Chưa có distribution production, median/p95 trên toàn bộ deep subset hoặc capacity test Render.

### Nguồn tiền mở rộng đến từ đâu?

Giai đoạn đầu tái đầu tư revenue. Sau khi PoC/MVP có traction và recurring revenue, nhóm có thể tiếp cận accelerator, strategic partner hoặc angel/seed funding với kế hoạch sử dụng vốn cụ thể.

## Glossary

| Thuật ngữ | Giải thích ngắn |
| --- | --- |
| PoC | Proof of Concept; bản chứng minh ý tưởng có thể thực hiện về kỹ thuật |
| MVP | Minimum Viable Product; phiên bản nhỏ nhất đủ cho người dùng trải nghiệm luồng giá trị chính |
| MAU | Monthly Active Users; người dùng hoạt động khác nhau trong 30 ngày |
| MRR | Monthly Recurring Revenue; doanh thu thuê bao định kỳ theo tháng |
| Conversion | Tỷ lệ người dùng chuyển thành khách hàng trả phí |
| Payer mix | Cơ cấu người trả phí giữa Lite, Plus và Pro |
| Direct cost | Chi phí phát sinh trực tiếp để phục vụ sản phẩm: data, AI, hosting, payment |
| Contribution | Doanh thu trừ direct cost |
| Contribution margin | Contribution chia doanh thu |
| Cash flow | Dòng tiền thực thu và thực chi trong một kỳ |
| Bootstrap | Phát triển chủ yếu bằng nguồn lực nhóm và doanh thu tạo ra |
| Traction | Bằng chứng sản phẩm có người dùng, mức sử dụng hoặc doanh thu ổn định |
| Cold cache | Dữ liệu chưa có hoặc đã stale, cần refresh |
| Warm cache | Dữ liệu còn hiệu lực và có thể tái sử dụng |
| TTL | Thời gian dữ liệu được xem là còn hiệu lực |
| Fan-out | Một hành động tạo ra nhiều request/call phía sau |
| RPS/RPM | Số request mỗi giây/mỗi phút |
| CU/credit | Đơn vị provider dùng để tính quota/chi phí |
| p50/p95 | Mốc latency mà 50%/95% request không vượt quá |
| Headroom | Phần quota/capacity giữ lại để hấp thụ biến động |
| Rate limit | Giới hạn tốc độ gọi API |
| Stress ceiling | Chi phí tối đa theo quyền lợi nếu người dùng dùng gần hết quota |
| Single-flight | Cho các request cùng khóa dùng chung một lần refresh đang chạy |
| Cache stampede | Nhiều request cùng thấy stale và đồng thời gọi provider |

## Nội dung slide đề xuất — tối đa 3 slide

### Slide 1 — Yoca tạo giá trị và doanh thu như thế nào?

**Nội dung hiển thị**

> Market → Token/Pool → Wallet → Wash Trading & AI  
> Freemium subscription: Standard / Lite 39 USD / Plus 79 USD / Pro 149 USD

| Standard | Lite | Plus | Pro |
| --- | --- | --- | --- |
| Trải nghiệm dữ liệu + AI giới hạn | Theo dõi thường xuyên | Mở phân tích wash trading | Power user quota cao |

> PoC → MVP → doanh thu ban đầu → xác nhận thị trường → mở rộng

**Speaker note:** Yoca bán khả năng nối dữ liệu và phân tích thành một hành trình. AI quota được đặt theo cost profile; Plus là tier mở tính năng chuyên sâu.

### Slide 2 — Chi phí được suy ra từ hành trình thật

**Nội dung hiển thị**

> User journey → PostgreSQL/TTL → provider refresh → credit/CU/token

| Journey cold | Cost proxy |
| --- | --- |
| Market Radar | 17 CoinGecko + 135 Birdeye CU |
| Token Overview | 15 CoinGecko + 1 Mobula |
| Wallet Core | 21 Mobula + 100 Helius |
| Wallet Activity | 1–10 Mobula pages |

> Review ở 70% quota · chuẩn bị nâng ở 85% · giữ ≥20% headroom

**Speaker note:** Shared token data có thể reuse; wallet data gần một-đổi-một hơn. Nâng provider dựa trên quota/RPS/429, không dựa duy nhất vào MAU.

### Slide 3 — Ba lát cắt tài chính và kế hoạch mở rộng

**Nội dung hiển thị**

| MAU | Revenue | Direct cost | Contribution margin |
| ---: | ---: | ---: | ---: |
| 300 | 377 USD | 176 USD | 53,13% |
| 3.000 | 3.765 USD | 1.483 USD | 60,62% |
| 30.000 | 37.650 USD | từ 10.384 USD | 72,42% |

> Một giả định xuyên suốt: 2% payer conversion, gồm 1,25% Lite · 0,5% Plus · 0,25% Pro

> 4 thành viên bán thời gian → 4 vị trí thường xuyên → doanh nghiệp nhỏ khoảng 20 người

**Speaker note:** Đây là contribution, chưa phải net profit. Ba mốc là lát cắt; calculator quét liên tục và cost được cập nhật khi provider/pricing thay đổi.

## Checklist trước khi công bố

- [ ] Stripe Price IDs tháng/năm khớp giá đã chốt.
- [ ] Pricing UI không còn Wallet AI legacy và hiển thị đúng quota.
- [ ] Wash Trading Chat 401/403/429 được UI diễn giải rõ.
- [ ] Chạy smoke test reservation/release cho sáu AI feature.
- [ ] Chạy calculator và lưu output dùng cho slide.
- [x] Dùng giá Mobula Enterprise công khai từ 750 USD; xin báo giá chỉ khi chuẩn bị mua.
- [x] Tính Helius Developer kèm credit bổ sung 5 USD/1 triệu trước khi cân nhắc Business.
- [ ] Ghi ngày khảo sát trên slide hoặc speaker note.
- [ ] Mỗi thành viên giải thích được MAU, conversion và contribution margin.
- [ ] Không gọi contribution là net profit.
