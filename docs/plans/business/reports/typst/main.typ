#import "theme.typ": *
#import "components.typ": *

#let data = json("../../slides/data/scenarios.json")

#show: report-theme.with(
  title: "Mô hình kinh doanh và kế hoạch vận hành Yoca",
  author: ("Nhóm phát triển Yoca",),
)

// Trang bìa
#set page(margin: 0mm)
#block(width: 100%, height: 297mm, fill: white, inset: (x: 24mm, y: 24mm))[
  #grid(
    rows: (auto, 1fr, auto),
    [
      #text(size: 9pt, weight: "semibold", fill: blue, tracking: 0.1em)[YOCA · ĐỒ ÁN TỐT NGHIỆP]
      #v(8pt)
      #line(length: 42mm, stroke: 2.2pt + blue)
    ],
    align(left + horizon)[
      #set par(leading: 0.95em)
      #text(size: 31pt, weight: "semibold", fill: ink)[Mô hình kinh doanh\ và kế hoạch vận hành]
      #v(16pt)
      #text(size: 13pt, fill: muted)[Phân tích dựa trên hành trình sử dụng, quota dịch vụ và ba mốc quy mô]
      #v(28pt)
      #grid(
        columns: (1fr, 1fr, 1fr), gutter: 10pt,
        metric-card([Mô hình], [Freemium], note: [4 gói thuê bao]),
        metric-card([Kịch bản], [2%], note: [người dùng trả phí]),
        metric-card([Quy mô], [3 mốc], note: [300 · 3.000 · 30.000 MAU]),
      )
    ],
    [
      #text(size: 9pt, fill: subtle)[Nhóm phát triển Yoca]
      #h(1fr)
      #text(size: 9pt, fill: subtle)[Tháng 7 · 2026]
    ],
  )
]

#set page(
  paper: "a4",
  margin: 20mm,
)
#counter(page).update(1)

#pagebreak()
#align(center)[#text(size: 21pt, weight: "semibold")[Nội dung báo cáo]]
#v(10pt)
#outline(title: none, depth: 2, indent: 12pt)

#v(18pt)
#callout(
  [Phạm vi],
  [Báo cáo trình bày mô hình doanh thu, cơ sở hình thành chi phí trực tiếp và kế hoạch mở rộng của Yoca. Số liệu được tổng hợp từ benchmark cục bộ ngày 19/7/2026, quota công khai của nhà cung cấp và một kịch bản nhu cầu thống nhất.],
)

#pagebreak()
= Định hướng sản phẩm và mô hình doanh thu

Yoca hỗ trợ người dùng theo dõi thị trường tài sản số, khảo sát token và pool, phân tích hoạt động ví, nhận diện dấu hiệu wash trading và sử dụng trợ lý AI theo ngữ cảnh. Hành trình của sản phẩm nối bốn lớp thông tin: thị trường, tài sản, ví và phân tích nâng cao. Người dùng có thể bắt đầu từ Market Radar, mở Token Overview, đánh giá danh mục ví rồi tiếp tục với lịch sử giao dịch, PnL, wash trading hoặc trợ lý AI.

Mô hình doanh thu được xây dựng theo hướng freemium kết hợp thuê bao. Standard cung cấp trải nghiệm dữ liệu lõi và quota AI thử nghiệm. Lite phục vụ người dùng theo dõi token và ví thường xuyên. Plus mở nhóm phân tích wash trading chuyên sâu. Pro dành cho người dùng cá nhân có tần suất nghiên cứu cao. Cấu trúc này tạo lối vào miễn phí cho người dùng mới và gắn doanh thu với các tác vụ có chi phí biến đổi lớn hơn.

== Giá trị cung cấp

#block(breakable: false)[
  #grid(
    columns: (1fr, 1fr), gutter: 9pt,
    callout([Dữ liệu hợp nhất], [Các phản hồi từ nhiều provider được chuẩn hóa thành dữ liệu token, pool, ví và giao dịch có cấu trúc.], tone: "neutral"),
    callout([Phân tích theo hành trình], [Người dùng chuyển từ tín hiệu thị trường sang tài sản và ví trong cùng một luồng tra cứu.], tone: "neutral"),
    callout([Tái sử dụng dữ liệu], [Database-first giúp nhiều lượt xem dùng chung dữ liệu còn hiệu lực và giảm mức tiêu thụ quota.], tone: "neutral"),
    callout([AI theo ngữ cảnh], [Trợ lý AI khai thác dữ liệu Yoca và tìm kiếm bổ sung theo giới hạn của từng gói.], tone: "neutral"),
  )
]

= Phương pháp xác định chi phí

== Đơn vị phân tích

Chi phí được đo theo một lần làm mới của từng hành trình. Backend đọc dữ liệu đã chuẩn hóa trong PostgreSQL, kiểm tra thời hạn sử dụng rồi mới gọi provider khi dữ liệu cần cập nhật. Cùng một token được nhiều người xem trong một cửa sổ cập nhật có thể tái sử dụng kết quả. Phân tích ví mang tính cá nhân hơn nên tỷ lệ làm mới cao hơn.

#v(4pt)
#grid(
  columns: (1fr, 1fr), gutter: 10pt,
  flow-step([01], [Ghi nhận hành trình], [Chạy Market Radar, Token Overview và Wallet Core với tập dữ liệu ổn định.]),
  flow-step([02], [Tách cold và warm], [Cold làm mới provider; warm đọc dữ liệu còn hiệu lực trong database.]),
  flow-step([03], [Đối chiếu đơn vị], [Quy đổi từng operation sang credit, CU hoặc request theo tài liệu provider.]),
  flow-step([04], [Chiếu lên quy mô], [Kết hợp mức sử dụng với session, adoption và tỷ lệ thuê bao trả phí.]),
)

== Kết quả cold và warm

#figure(
  benchmark-chart(data.benchmarks),
  caption: [Thời gian phản hồi cold và warm của ba hành trình lõi],
) <benchmark-cold-warm>

Kết quả ở @benchmark-cold-warm cho thấy warm database giảm thời gian phản hồi khoảng 6,9 đến 38,5 lần trong lần chạy quan sát. Cơ chế này đồng thời giảm số provider request phát sinh ở các lượt xem lặp lại. Benchmark được sử dụng làm đầu vào kỹ thuật cho mô hình chi phí và được giữ riêng với phép đo tải production.

#source-note([Benchmark cục bộ ngày 19/7/2026; 12 endpoint Market Radar, 16 endpoint Token Overview và 8 endpoint Wallet Core.])

= Hệ sinh thái dữ liệu và quota

Yoca sử dụng sáu nhà cung cấp dữ liệu blockchain trong các hành trình đang phân tích. Mỗi nhà cung cấp áp dụng một đơn vị thanh toán riêng, vì vậy quota được theo dõi độc lập. CoinGecko, Mobula và Helius tính theo credit; Birdeye và Moralis dùng compute unit (CU); Zerion theo số request. Giá và giới hạn được khảo sát từ tài liệu chính thức @coingecko-pricing @birdeye-pricing @mobula-pricing @helius-pricing @zerion-api @moralis-pricing.

#figure(
  report-table(
    4,
    ([Provider], [Vai trò trong Yoca], [Gói hiện tại], [Hạn mức chính]),
    (
      ([CoinGecko], [Market và token market data], [Demo], [10.000 credits/tháng]),
      ([Birdeye], [Market Radar, pool và price history], [Standard], [30.000 CU/kỳ hiện tại]),
      ([Mobula], [Wallet analysis, PnL và activity], [Free], [10.000 credits/tháng; 1 RPS]),
      ([Helius], [Wallet balances, enhanced transaction và webhook], [Free], [1 triệu credits/tháng]),
      ([Zerion], [Biểu đồ balance theo từng token], [Developer], [2.000 requests/ngày; 10 RPS]),
      ([Moralis], [Bổ sung token metadata], [Free], [40.000 CU/ngày]),
    ),
    widths: (0.85fr, 1.65fr, 0.75fr, 1.35fr),
  ),
  caption: [Vai trò và hạn mức của các provider trong mô hình],
) <provider-quota>

== Mức sử dụng theo tác vụ

#figure(
  report-table(
    4,
    ([Tác vụ làm mới], [Provider], [Mức sử dụng quan sát], [Yếu tố làm thay đổi]),
    (
      ([Market Radar], [CoinGecko · Birdeye], [17 credits · 135 CU], [Số market endpoint và retry]),
      ([Token Overview], [CoinGecko · Mobula], [15 credits · 1 credit], [Số batch token/pool]),
      ([Wallet Core], [Mobula · Helius], [21 credits · 100 credits], [Số trang holdings]),
      ([Wallet Activity], [Mobula], [1–10 credits], [Mật độ giao dịch và phân trang]),
      ([Wallet Token Chart], [Zerion], [1 request/token], [Số token được người dùng chọn]),
      ([Token Metadata], [Moralis], [10 CU], [Lần bổ sung metadata]),
    ),
    widths: (1.15fr, 1.2fr, 1.2fr, 1.45fr),
  ),
  caption: [Đơn vị provider cho một lần làm mới],
) <journey-units>

Những con số trong @journey-units là cost proxy của một lần thực thi thành công. Khi hành trình có phân trang hoặc retry, tracker lưu từng attempt để mức sử dụng phản ánh đúng fan-out. Quy tắc vận hành bắt đầu rà soát ở 70% quota, chuẩn bị nâng gói ở 85% và duy trì tối thiểu 20% khoảng dự phòng cho tải đột biến.

= Phân khúc và bảng giá

Giá thuê bao tháng được chốt ở 0, 39, 79 và 149 USD. Giá năm tương đương mười tháng và cung cấp quyền truy cập trong mười hai tháng. Vùng giá được đối chiếu với CryptoQuant, Dune và Nansen tại thời điểm khảo sát tháng 7/2026 @cryptoquant-pricing @dune-billing @nansen-pricing.

#figure(
  report-table(
    5,
    ([Gói], [Giá tháng], [Giá năm], [Đối tượng], [Quyền lợi chính]),
    (
      ([Standard], [\$0], [\$0], [Người dùng mới], [Dữ liệu lõi và AI ở mức trải nghiệm]),
      ([Lite], [\$39], [\$390], [Người theo dõi thường xuyên], [Quota AI thường nhật cao hơn]),
      ([Plus], [\$79], [\$790], [Active trader/researcher], [Wash Trading Analysis và Chat]),
      ([Pro], [\$149], [\$1.490], [Power user cá nhân], [Quota cao cho toàn bộ nhóm phân tích]),
    ),
    widths: (0.75fr, 0.7fr, 0.75fr, 1.35fr, 2fr),
  ),
  caption: [Bảng giá và phân khúc người dùng],
) <pricing-tiers>

Quota AI được phân theo đặc điểm phát sinh chi phí. Ask Yoca có thể mở rộng tìm kiếm; Wallet Chat sử dụng nhiều công cụ dữ liệu; Token Chart News tạo tóm tắt theo sự kiện; Wash Trading kết hợp dữ liệu giao dịch và diễn giải từ mô hình. Gemini được tính theo input, output và thinking token; Brave Search được tính theo request @gemini-pricing @brave-pricing.

== Giả định cơ sở

#grid(
  columns: (1fr, 1fr, 1fr), gutter: 8pt,
  metric-card([Tỷ lệ trả phí], [2%], note: [1,25% Lite · 0,5% Plus · 0,25% Pro]),
  metric-card([Mức hoạt động], [8 phiên], note: [trên mỗi MAU mỗi tháng]),
  metric-card([Chu kỳ đo], [30 ngày], note: [MAU có ít nhất một tương tác dữ liệu]),
)

Một phiên được phân bổ cho Market Radar, Token Overview, Wallet Core, Wallet Activity, AI và Alert theo tỷ lệ sử dụng trong calculator. Tỷ lệ cold của token giảm khi quy mô tăng vì dữ liệu phổ biến được chia sẻ giữa nhiều người dùng. Dữ liệu ví giữ tỷ lệ cold cao hơn do mỗi địa chỉ tạo một tập phân tích riêng.

= Kịch bản tài chính

== Doanh thu và chi phí trực tiếp

#figure(
  finance-chart(data.scenarios),
  caption: [Tỷ trọng chi phí trực tiếp và số dư đóng góp theo doanh thu],
) <finance-composition>

#figure(
  report-table(
    5,
    ([MAU], [Người trả phí], [Doanh thu/tháng], [Chi phí trực tiếp], [Số dư đóng góp]),
    (
      ([300], [6], [\$376,50], [\$176,47], [\$200,03 · 53,13%]),
      ([3.000], [60], [\$3.765,00], [\$1.482,67], [\$2.282,33 · 60,62%]),
      ([30.000], [600], [\$37.650,00], [\$10.383,73], [\$27.266,27 · 72,42%]),
    ),
    widths: (0.7fr, 0.95fr, 1.15fr, 1.15fr, 1.4fr),
  ),
  caption: [Kết quả kịch bản cơ sở tại ba mốc quy mô],
) <financial-results>

Số dư đóng góp trong @financial-results là phần còn lại sau blockchain data provider, Gemini và Brave Search, Render và Supabase, email giao dịch cùng phí thanh toán. Khoản này được dùng cho nhân sự, marketing, thuế, pháp lý, hỗ trợ khách hàng, dự phòng và phát triển sản phẩm.

== Cơ cấu chi phí tại 3.000 MAU

#grid(
  columns: (0.9fr, 1.1fr), gutter: 16pt, align: horizon,
  figure(
    cost-mix-chart(data.costMix3k),
    caption: [Tỷ trọng chi phí trực tiếp tại 3.000 MAU],
  ),
  [
    #report-table(
      3,
      ([Nhóm chi phí], [USD/tháng], [Tỷ trọng]),
      data.costMix3k.map(item => (
        grid(
          columns: (7pt, 1fr), gutter: 5pt, align: horizon,
          rect(width: 7pt, height: 7pt, fill: rgb(item.color)),
          [#item.name],
        ),
        item.value,
        item.share,
      )),
      widths: (1.4fr, 0.8fr, 0.65fr),
    )
    #v(7pt)
    #text(size: 8.7pt, fill: muted)[AI và tìm kiếm chiếm tỷ trọng lớn nhất. Blockchain data provider đứng thứ hai và có đặc điểm tăng theo từng bậc quota. Hai nhóm này quyết định phần lớn thời điểm điều chỉnh entitlement hoặc nâng gói dịch vụ.]
  ],
)

= Kế hoạch vận hành và mở rộng

== Các ngưỡng nâng gói đầu tiên

#figure(
  report-table(
    3,
    ([MAU ước tính], [Dịch vụ], [Điều chỉnh ngân sách]),
    (
      ([150], [Mobula], [Free → Start-up]),
      ([300], [CoinGecko], [Demo → Basic]),
      ([450], [Birdeye], [Standard → Lite]),
      ([1.600], [Mobula], [Start-up → Growth]),
      ([2.775], [Helius], [Free → Developer]),
      ([3.525], [CoinGecko], [Basic → Analyst]),
    ),
    widths: (0.9fr, 1.1fr, 2fr),
  ),
  caption: [Các breakpoint đầu tiên trong kịch bản cơ sở],
) <provider-breakpoints>

Breakpoint trong @provider-breakpoints là tín hiệu lập ngân sách. Quyết định vận hành kết hợp mức quota dự phóng, lỗi 429, giới hạn RPS/RPM và độ trễ p95. Cách theo dõi này giúp nhóm phân biệt tình huống thiếu quota với tình huống thiếu throughput hoặc tài nguyên máy chủ.

== Hạ tầng và tổ chức

#figure(
  report-table(
    4,
    ([Quy mô], [Render API], [Supabase], [Tổ chức vận hành]),
    (
      ([300 MAU], [Starter], [Free], [Bốn thành viên bán thời gian; ưu tiên duy trì MVP]),
      ([3.000 MAU], [Standard], [Pro Micro], [Bốn vị trí thường xuyên; bổ sung ngân sách tăng trưởng]),
      ([30.000 MAU], [Hai Standard instance], [Pro Small], [Doanh nghiệp nhỏ khoảng 20 người]),
    ),
    widths: (0.8fr, 1.1fr, 1.05fr, 2.05fr),
  ),
  caption: [Cấu hình hạ tầng và tổ chức theo ba mốc quy mô],
) <infrastructure-scale>

Frontend Vite được triển khai dưới dạng Render Static Site. API chạy như Render Web Service và PostgreSQL được lưu trữ trên Supabase. Cấu hình trong @infrastructure-scale là mức ngân sách dung lượng ứng với từng giai đoạn; quá trình nâng cấp dựa trên CPU, bộ nhớ, p95 latency, connection pool và dung lượng database. Giá hạ tầng được đối chiếu từ Render và Supabase @render-pricing @supabase-pricing. Email khôi phục và Alert sử dụng Resend, được đưa vào chi phí theo quota gửi thư @resend-pricing.

== Phân bổ nguồn lực

Ở 300 MAU, số dư đóng góp khoảng 200 USD mỗi tháng giúp trang trải hoạt động sản phẩm và tạo quỹ dự phòng nhỏ. Mốc 3.000 MAU tạo khoảng 2.282 USD số dư đóng góp, đủ duy trì bốn vị trí thường xuyên ở mức ngân sách thận trọng cùng chi phí marketing và phát triển sản phẩm. Tại 30.000 MAU, mô hình dành phần lớn nguồn lực cho nhân sự, thu hút người dùng, bảo mật và dự phòng; thặng dư vận hành được giữ ở mức 5%.

Nguồn vốn ban đầu đến từ đóng góp của nhóm và doanh thu thuê bao. Sau giai đoạn MVP, dữ liệu về người dùng hoạt động, tỷ lệ chuyển đổi, chi phí thu hút khách hàng và doanh thu định kỳ tạo cơ sở để tiếp cận chương trình hỗ trợ startup, đối tác chiến lược hoặc vòng vốn thiên thần/seed.

#figure(
  report-table(
    3,
    ([Mốc], [Trọng tâm], [Nguyên tắc phân bổ số dư đóng góp]),
    (
      ([300 MAU], [Tự trang trải MVP], [Sản phẩm và dự phòng 40%; thu hút/hỗ trợ người dùng 30%; hỗ trợ nhóm 20%; hành chính 10%]),
      ([3.000 MAU], [Duy trì đội ngũ], [Thu nhập đội ngũ 60%; marketing 20%; sản phẩm và dự phòng 10%; hành chính, thuế và pháp lý 10%]),
      ([30.000 MAU], [Mở rộng doanh nghiệp nhỏ], [Nhân sự 25%; marketing 40%; sản phẩm và bảo mật 15%; hành chính 10%; dự phòng 5%; thặng dư vận hành 5%]),
    ),
    widths: (0.8fr, 1.15fr, 3.05fr),
  ),
  caption: [Định hướng phân bổ nguồn lực theo quy mô],
) <resource-allocation>

= Kết luận

Kịch bản cơ sở cho thấy bảng giá Yoca có khả năng trang trải chi phí trực tiếp tại cả ba mốc quy mô với tỷ lệ chuyển đổi 2%. Nền tảng database-first giữ vai trò quan trọng vì làm tăng khả năng tái sử dụng dữ liệu và giảm provider usage ở các lượt xem lặp lại. Phân tích ví, AI và tìm kiếm vẫn là các nhóm cần theo dõi sát do chi phí gắn nhiều hơn với từng người dùng.

Mô hình được duy trì bằng chu trình đo hành trình, đối chiếu quota, cập nhật calculator và rà breakpoint. Khi dữ liệu vận hành tích lũy, các giả định về session, adoption và tỷ lệ cold được thay bằng số đo thực tế; cấu trúc tính toán và các đơn vị provider vẫn giữ nguyên để nhóm so sánh qua từng giai đoạn.

#pagebreak()
= Bảng thuật ngữ và chữ viết tắt

#figure(
  report-table(
    3,
    ([Thuật ngữ], [Tên đầy đủ hoặc cách đọc], [Ý nghĩa trong báo cáo]),
    (
      ([MAU], [Monthly Active Users], [Số người dùng khác nhau có ít nhất một tương tác dữ liệu trong cửa sổ 30 ngày.]),
      ([CU], [Compute Unit], [Đơn vị Birdeye và Moralis dùng để tính mức sử dụng API.]),
      ([Credit], [Tín dụng API], [Đơn vị quota của CoinGecko, Mobula và Helius; chi phí mỗi operation phụ thuộc provider.]),
      ([RPS / RPM], [Requests per second / minute], [Số request tối đa trong một giây hoặc một phút.]),
      ([p95 latency], [Phân vị 95 của độ trễ], [Mức thời gian mà 95% request hoàn thành nhanh hơn hoặc bằng giá trị này.]),
      ([Cold], [Lần tải cần làm mới dữ liệu], [Yêu cầu phải gọi một hoặc nhiều provider để cập nhật dữ liệu.]),
      ([Warm], [Lần tải dùng dữ liệu còn hiệu lực], [Yêu cầu đọc dữ liệu đã lưu trong database mà chưa cần làm mới provider.]),
      ([Database-first], [Ưu tiên dữ liệu trong cơ sở dữ liệu], [Luồng đọc database, kiểm tra thời hạn rồi mới gọi provider khi cần cập nhật.]),
      ([Fan-out], [Mức mở rộng request], [Số provider request phát sinh từ một hành trình do batch, phân trang, tool hoặc retry.]),
      ([Quota], [Hạn mức sử dụng], [Số credit, CU hoặc request được phép dùng trong một chu kỳ.]),
      ([Headroom], [Khoảng dự phòng], [Phần quota hoặc tài nguyên được giữ lại cho tải đột biến, retry và sai lệch dự báo.]),
      ([TTL], [Time to live], [Khoảng thời gian dữ liệu được xem là còn hiệu lực trước khi cần làm mới.]),
      ([Conversion rate], [Tỷ lệ chuyển đổi], [Tỷ lệ MAU chuyển từ gói miễn phí sang thuê bao trả phí.]),
      ([Contribution], [Số dư đóng góp], [Doanh thu còn lại sau chi phí trực tiếp để trang trải nhân sự và hoạt động doanh nghiệp.]),
      ([Freemium], [Miễn phí kết hợp trả phí], [Mô hình cung cấp gói cơ bản miễn phí và thu phí cho hạn mức hoặc phân tích cao hơn.]),
      ([PnL], [Profit and Loss], [Kết quả lãi hoặc lỗ của hoạt động giao dịch trong một khoảng thời gian.]),
      ([Provider], [Nhà cung cấp dữ liệu], [Dịch vụ bên ngoài cung cấp dữ liệu blockchain, thị trường, ví hoặc AI cho Yoca.]),
      ([Breakpoint], [Ngưỡng chuyển gói], [Mốc nhu cầu dự kiến khiến gói dịch vụ hiện tại cần được rà soát hoặc nâng cấp.]),
    ),
    widths: (0.9fr, 1.5fr, 2.6fr),
  ),
  caption: [Các thuật ngữ và chữ viết tắt sử dụng trong báo cáo],
) <business-glossary>

#pagebreak()
= Tài liệu tham khảo

#bibliography("bibliography.bib", title: none, style: "ieee")
