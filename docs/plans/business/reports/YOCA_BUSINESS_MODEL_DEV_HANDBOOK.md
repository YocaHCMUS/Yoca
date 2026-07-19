# Yoca Business Model — Developer Handbook

## Mục đích và phạm vi

Đây là tài liệu bàn giao nội bộ. Nội dung công khai các giả định, cost proxy, khoảng trống kỹ thuật và điều kiện cập nhật mô hình. Không đưa API key, credential, session token hoặc giá trị `.env` vào file này.

Nguồn chuẩn hiện tại:

- `calculate-business-scenarios.ts`: công thức và kết quả có thể chạy lại.
- `BUSINESS_SCENARIOS_2026-07-19.md`: giải thích scenario và sensitivity.
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

Base dùng 8 session/MAU/tháng, payer conversion 8% với Lite/Plus/Pro bằng 5%/2%/1%. Token, wallet, activity và AI adoption được ghi chi tiết trong calculator.

| MAU | Revenue | Direct cost | Contribution | Margin |
| ---: | ---: | ---: | ---: | ---: |
| 300 | 1.506,00 | 214,66 | 1.291,34 | 85,75% |
| 3.000 | 15.060,00 | 1.844,58 | 13.215,42 | 87,75% |
| 30.000 | 150.600,00 | 14.627,83 | 135.972,17 | 90,29% |

Direct cost gồm blockchain data provider, Gemini/Brave, Render/Supabase và payment processing proxy. Contribution chưa trừ lương, marketing, thuế, pháp lý và support.

### Demand sensitivity

| MAU | Favorable | Base | Pressure |
| ---: | ---: | ---: | ---: |
| 300 | 90,87% | 85,75% | 76,02% |
| 3.000 | 90,88% | 87,75% | 79,99% |
| 30.000 | 93,64% | 90,29% | 83,15% |

Các số là contribution margin. Favorable dùng 6 session, cache reuse cao và 60% AI usage của base. Pressure dùng 12 session, wallet cold cao, activity dày và 160% AI usage.

### Conversion sensitivity trên base demand

| MAU | 4% payer | 8% payer | 12% payer |
| ---: | ---: | ---: | ---: |
| 300 | 74,87% | 85,75% | 89,37% |
| 3.000 | 78,88% | 87,75% | 90,71% |
| 30.000 | 83,96% | 90,29% | 92,40% |

Payer mix giữ tỷ lệ Lite:Plus:Pro bằng 5:2:1. Conversion là giả định, chưa phải product analytics.

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
| 15.925 | Mobula Growth → Enterprise floor |
| 26.325 | CoinGecko Analyst → Lite |
| 27.650 | Helius Developer → Business |

Breakpoint phụ thuộc demand assumptions. Policy vận hành:

- Review ở projected 70% quota.
- Chuẩn bị nâng ở khoảng 85%.
- Giữ tối thiểu 20% headroom cho retry, manual refresh và fan-out drift.
- Xem 429, RPS/RPM và p95 latency tách khỏi quota tháng.
- Nâng Render theo CPU/RAM/latency khi có số đo; không nâng chỉ vì MAU.

Mobula trên 1,25 triệu credit dùng giá Enterprise từ 750 USD nên chỉ là floor. Helius quanh 10 triệu credit cần kiểm tra khả năng mua thêm credit Developer trước khi mặc định Business. Zerion Developer 0 USD có 2.000 request/ngày; giá tier kế tiếp chưa có nguồn public đủ chắc chắn.

## Hạ tầng và nhân sự

Cost scenario dùng Static Site 0 USD, Render Starter 7 USD làm production floor, Standard 25 USD cho mức cao hơn và ngân sách 25–50 USD ở lát cắt lớn. Supabase dùng Free ban đầu và Pro từ 25 USD. Đây là capacity budget, không phải claim hệ thống chịu được một MAU cụ thể.

Giai đoạn đầu có hai maintainer nòng cốt và công sức chưa tạo thành cash salary. Doanh thu ưu tiên provider, hạ tầng, reserve và sản phẩm. Khi recurring revenue ổn định, bổ sung compensation và support/ops. External funding chỉ xuất hiện sau PoC/MVP, traction và kế hoạch sử dụng vốn; baseline vẫn có thể tăng trưởng từ doanh thu.

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

### 85–90% có phải lợi nhuận không?

Đó là contribution margin sau direct cost. Lương, marketing, thuế, pháp lý và support chưa được trừ.

### Vì sao contribution margin tăng khi MAU tăng?

Revenue tăng gần tuyến tính theo payer mix, còn provider bán theo gói quota. Giữa hai breakpoint, phần quota chưa dùng tạo operating leverage. Khi đổi gói, cost nhảy bậc.

### Vì sao 300 MAU đã phải nâng provider?

Base giả định wallet cold rate cao và 8 session/MAU. Favorable profile cho kết quả khác. Breakpoint là tín hiệu ngân sách từ assumptions, chưa phải quan sát production.

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
| Sensitivity analysis | Thay đổi một nhóm giả định để xem kết quả biến động ra sao |
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
| 300 | 1.506 USD | 215 USD | 85,75% |
| 3.000 | 15.060 USD | 1.845 USD | 87,75% |
| 30.000 | 150.600 USD | từ 14.628 USD | 90,29% |

> Base assumption: 8% payer conversion  
> Pressure margin: 76,02% / 79,99% / 83,15%

> Hai maintainer giai đoạn đầu → tái đầu tư doanh thu → bổ sung nhân sự/nguồn vốn khi có traction

**Speaker note:** Đây là contribution, chưa phải net profit. Ba mốc là lát cắt; calculator quét liên tục và cost được cập nhật khi provider/pricing thay đổi.

## Checklist trước khi công bố

- [ ] Stripe Price IDs tháng/năm khớp giá đã chốt.
- [ ] Pricing UI không còn Wallet AI legacy và hiển thị đúng quota.
- [ ] Wash Trading Chat 401/403/429 được UI diễn giải rõ.
- [ ] Chạy smoke test reservation/release cho sáu AI feature.
- [ ] Chạy calculator và lưu output dùng cho slide.
- [ ] Thay Mobula Enterprise floor nếu có báo giá thật.
- [ ] Kiểm tra Helius Developer overage trước khi chọn Business.
- [ ] Ghi ngày khảo sát trên slide hoặc speaker note.
- [ ] Mỗi thành viên giải thích được MAU, conversion và contribution margin.
- [ ] Không gọi contribution là net profit.

