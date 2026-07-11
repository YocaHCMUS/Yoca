# Working plan — chỉnh sửa báo cáo cuối kỳ Yoca

File nội bộ để theo dõi tiến độ giữa nhóm và Codex. Không đưa vào báo cáo, không dùng như nội dung nộp. `note_nhan_xet.md` tiếp tục giữ vai trò đối chiếu feedback của thầy; file này giữ cấu trúc đích, thứ tự batch và các việc phải kiểm chứng trong quá trình viết.

Quy ước:
- `[ ]` chưa làm.
- `[-]` đang làm hoặc đã có bản nháp nhưng chưa kiểm chứng xong.
- `[x]` hoàn tất sau khi đã đối chiếu source, tài liệu và nội dung liên quan.
- Không đánh dấu hoàn tất chỉ vì đã viết được văn bản; hình, reference và nội dung các chương liên quan cũng phải khớp.

## Nguyên tắc chung cho mọi batch

- [ ] Trước khi viết một phần, đọc lại nội dung hiện tại và xác định phần nào giữ, phần nào dời, phần nào bỏ.
- [ ] Đối chiếu source code thật: route, service, schema/type, database table, test và config liên quan. Không suy luận type hoặc luồng chỉ từ tên file.
- [ ] Với provider/framework/sản phẩm bên ngoài, ưu tiên tài liệu chính thức; ghi lại ngày truy cập đối với pricing, quota và giới hạn có thể thay đổi.
- [ ] Nếu lời kể của nhóm, source và tài liệu không khớp, dừng phần kết luận đó và hỏi lại trước khi viết.
- [ ] Chỉ chọn các chi tiết kỹ thuật giúp giải thích quyết định. Không đưa toàn bộ lịch sử phát triển hoặc mọi khó khăn vào báo cáo.
- [ ] Được phép giản lược bảng, component và pipeline thành mô hình khái niệm, nhưng không tạo tính năng, số liệu hay bảo đảm kỹ thuật không tồn tại.
- [ ] Viết với tư cách người trong nhóm: dùng “nhóm chúng em/nhóm em” khi kể lựa chọn và trải nghiệm; dùng “Yoca/hệ thống” khi mô tả hành vi kỹ thuật. Tránh lặp chủ ngữ máy móc.
- [ ] Ưu tiên văn xuôi và mạch kể; hạn chế subsection, bullet và các đoạn liệt kê dài trong bản báo cáo.
- [ ] Với phần có lịch sử thay đổi, dùng mạch vừa đủ: kỳ vọng ban đầu → vấn đề quan sát được → cách xử lý → trade-off/kết quả còn hạn chế.
- [ ] Không làm kiến trúc có vẻ được thiết kế hoàn hảo từ đầu. Thừa nhận ngắn các điều chỉnh quan trọng khi chúng giúp người đọc hiểu quyết định hiện tại.
- [ ] Không đưa mâu thuẫn cá nhân, quy trách nhiệm cho thành viên/giảng viên hoặc chi tiết trao đổi nhạy cảm với provider vào báo cáo.
- [ ] Sau mỗi batch, rà reference chéo, thuật ngữ, tên chức năng, tên provider và giọng văn với các phần đã hoàn tất trước đó.

## Cấu trúc đích dự kiến

- [ ] Chốt cấu trúc 6 chương sau khi kiểm tra yêu cầu template và ảnh hưởng đến đánh số/reference.
- [ ] Chương 1 — Giới thiệu: bối cảnh, mục tiêu, phạm vi, cách tiếp cận, đóng góp và bố cục.
- [ ] Chương 2 — Các hệ thống và nguồn dữ liệu liên quan: khảo sát nền tảng tương tự, khoảng trống của Yoca, giới thiệu provider thật sự được dùng và ràng buộc dữ liệu.
- [ ] Chương 3 — Phân tích và đặc tả yêu cầu: người dùng, tình huống sử dụng, yêu cầu chức năng/phi chức năng, use case và tiêu chí chấp nhận.
- [ ] Chương 4 — Kiến trúc và thiết kế hệ thống: kiến trúc tổng thể, tích hợp provider, contract/validation, cache, database/ERD, luồng nghiệp vụ và các quyết định kỹ thuật chính.
- [ ] Chương 5 — Triển khai, kiểm thử và đánh giá: môi trường, luồng chức năng đã cài đặt, hình giao diện, khó khăn triển khai, phạm vi kiểm thử có thật và đánh giá hạn chế.
- [ ] Chương 6 — Kết luận và hướng phát triển: kết quả có bằng chứng, đóng góp, hạn chế và hướng cải thiện.
- [ ] Nếu không tách thành 6 chương, giữ cùng ranh giới nội dung nhưng ghi rõ mapping trở lại cấu trúc 5 chương; không để phần công nghệ quay lại Chương 2 theo kiểu giáo khoa.

## Batch 0 — kiểm kê và chuẩn bị hạ tầng báo cáo

- [x] Lập inventory file/chapter/input/image/reference hiện tại và xác định nơi cần thêm chapter mới.
- [x] Kiểm tra main.tex, package hỗ trợ landscape/rotation, bibliography, label và quy tắc đặt hình/bảng.
- [x] Tạo Puppeteer config dùng `/usr/bin/chromium-browser` cho `mmdc`; giữ cờ no-sandbox khi môi trường yêu cầu.
- [x] Tạo lệnh/script render đồng nhất toàn bộ `.mmd` sang PDF, gồm nền trắng, kích thước và output path ổn định.
- [x] Xác định cách compile LaTeX hiện có và cách kiểm tra PDF mà không làm thay đổi source ngoài phạm vi báo cáo.
- [x] Lập danh sách placeholder, mục trống, hình thiếu và reference có nguy cơ hỏng trước khi di chuyển nội dung.

## Batch 1 — Chương 2: hệ thống liên quan và provider dữ liệu

- [ ] Rút gọn khảo sát Arkham, Birdeye, CoinGecko, Dune và Nansen; giữ sản phẩm chính, cách tiếp cận đáng học hỏi, giới hạn và liên hệ với Yoca.
- [ ] Giảm mô tả mang tính quảng bá hoặc khẳng định cơ chế nội bộ không có nguồn đáng tin cậy.
- [ ] Bổ sung đoạn lập luận trước bảng so sánh: lý do chọn đối tượng và tiêu chí; không đưa Yoca vào bảng quá đột ngột.
- [ ] Rà lại tiêu chí bảng theo chức năng thật của Yoca: market/token/pool, wallet, transaction, alert, AI explanation, khả năng tiếp cận và mức tùy biến.
- [ ] Lập bản đồ endpoint/service → provider → cache/table trước khi viết provider. Phân biệt active, fallback/enrichment, legacy và utility không còn consumer.
- [ ] Kiểm chứng vai trò CoinGecko, Birdeye, Mobula, Zerion, Helius, Moralis và các nguồn AI/payment thực tế. Không liệt kê CoinMarketCap hoặc Dune SIM như nguồn vận hành nếu source không dùng.
- [ ] Research ngắn về sản phẩm chính, API phù hợp với Yoca, free tier/quota/pricing và giới hạn của từng provider bằng nguồn chính thức.
- [ ] Chọn cách trình bày provider súc tích; không biến Chương 2 thành catalog API. Tập trung vào lý do lựa chọn và ràng buộc đã ảnh hưởng đến thiết kế.
- [ ] Viết ngắn lịch sử thay đổi nguồn dữ liệu: Birdeye ban đầu → Mobula/Zerion/Helius theo từng miền; giữ chi tiết đủ để dẫn sang Chương Kiến trúc.
- [ ] Nêu PnL và lịch sử ví là dữ liệu có thể tự suy ra về nguyên tắc nhưng chi phí index, định giá lịch sử và tính không ổn định của transaction abstraction vượt phạm vi đồ án.
- [ ] Dời toàn bộ phần React/Hono/ORM/monorepo/caching đang mang tính kiến trúc sang Chương 4; Chương 2 chỉ giữ nền tảng thật sự cần cho việc hiểu bài toán.
- [ ] Cập nhật logo/hình provider nếu cần; mỗi hình phải có caption/reference có ích, tránh logo đứng riêng không được nhắc lại.
- [ ] Rà citations và bổ sung bibliography cho Mobula, Zerion, Helius, Moralis cùng pricing/docs đã sử dụng.

## Batch 2 — Chương 3: phân tích và đặc tả yêu cầu

- [ ] Tách nội dung yêu cầu khỏi kiến trúc/cài đặt; không giải thích Hono, PostgreSQL, cache hoặc provider chi tiết trong chương này.
- [ ] Rà các chức năng thật theo route/page hiện có; phân biệt chức năng hoàn thiện, chức năng giới hạn và phần chỉ còn dấu vết trong source.
- [ ] Dùng một user journey xuyên suốt để kết nối các chức năng: Market Overview → Token Pool → Token Overview → Wallet Overview → User → AI Features/Limit.
- [ ] Giữ sơ đồ use case tổng quát và hai sơ đồ phụ nếu chúng phản ánh đúng actor/use case; sửa caption, tên use case và phần giải thích để không lặp danh sách chức năng.
- [ ] Rà yêu cầu phi chức năng theo khả năng chứng minh: tính đúng hợp đồng dữ liệu, phản hồi khi upstream lỗi, cache, bảo mật/xác thực, usability và maintainability.
- [ ] Không đưa SLA, hiệu năng hoặc độ ổn định định lượng nếu chưa đo.
- [ ] Viết kế hoạch kiểm thử và tiêu chí chấp nhận ở mức thiết kế; các tiêu chí phải nối được sang kết quả ở Chương 5.
- [ ] Hạn chế chia nhỏ các mục trống. Có thể dùng một bảng kịch bản/tiêu chí nếu rõ hơn nhiều subsection ngắn.
- [ ] Viết lại tổng kết Chương 3 để chỉ tóm tắt yêu cầu và phạm vi, không tóm tắt kiến trúc đã được dời đi.

## Batch 3 — Chương 4: kiến trúc tổng thể và quyết định công nghệ

- [ ] Tạo chapter kiến trúc mới và dời nội dung phù hợp từ Chương 2/3; cập nhật label/reference/bố cục chương ở Chương 1 và phần tổng kết.
- [ ] Mở chương bằng vấn đề kiến trúc thật: hợp nhất dữ liệu từ nhiều provider có độ phủ, schema, quota, chi phí và độ tin cậy khác nhau.
- [ ] Rà kiến trúc source trước khi đặt tên layer/module; không mô tả clean architecture hoặc microservice nếu source không thể hiện.
- [ ] Mô tả monorepo/full-stack TypeScript và monolith phân lớp theo lợi ích thật với phạm vi đồ án.
- [ ] Kiểm chứng pattern route → `get*` → cache/staleness → `fetch*` → validate/normalize → upsert → response; ghi là pattern chủ đạo nếu có ngoại lệ.
- [ ] Giải thích boundary validation: Zod response schema, trường bắt buộc/tùy chọn, error envelope, invalid JSON và typed upstream error.
- [ ] Liên hệ Hono RPC/shared types/Drizzle với mục tiêu phát hiện sai lệch sớm; không xem type safety là thay thế runtime validation hay testing.
- [ ] Viết lý do chọn React/Vite/Hono/Drizzle/PostgreSQL/ECharts dựa trên nhu cầu Yoca và trade-off; bỏ phần định nghĩa giáo khoa.
- [ ] Kiểm chứng retry, rate limit, API-key rotation, stale fallback và multi-provider fallback trong code trước khi khẳng định.
- [ ] Phân biệt rõ multi-provider theo miền với fallback đa provider. Nêu nhóm hạn chế fallback tràn lan vì khác biệt type và chi phí bảo trì.
- [ ] Bổ sung sơ đồ kiến trúc tổng thể mới hoặc chỉnh hình hiện có: client, Hono API, domain/service, validation/adapter, PostgreSQL/cache, provider và AI/payment.
- [ ] Sơ đồ kiến trúc chỉ thể hiện quan hệ khái niệm; tránh danh sách framework/logo quá nhiều và tránh đường nối không giải thích được.

## Batch 4 — dữ liệu, cache, schema evolution và ERD

- [ ] Rà toàn bộ schema Drizzle, migration và consumer service trước khi quyết định bảng active/legacy/deprecated.
- [ ] Viết mục tiêu database theo hai lớp: dữ liệu nền tương đối chuẩn hóa và cache/read model phi chuẩn hóa có chủ đích.
- [ ] Giải thích tách bảng theo nguồn dữ liệu, nhịp cập nhật và khả năng refresh; tránh một row cần 2–3 provider mới hoàn chỉnh.
- [ ] Viết chiến lược DB-first và coverage metadata cho lịch sử; phân biệt TTL cache, interval coverage và snapshot/read model.
- [ ] Kiểm chứng việc tận dụng enrichment dư để cập nhật chéo, ví dụ portfolio/search/pool bổ sung `token_meta`; không khái quát vượt quá code.
- [ ] Dùng nullability của symbol/logo/price change làm ví dụ cho schema phòng thủ trước response không đầy đủ.
- [ ] Mô tả thay đổi schema theo hướng evolutionary architecture/incremental replacement: xây model mới, chuyển consumer, rồi loại bỏ model cũ.
- [ ] Xác định các bảng wallet legacy/song song và bảng nào còn consumer trước khi vẽ ERD.
- [ ] Tạo ERD tổng thể chỉ có entity/tên bảng hoặc miền, thể hiện User/Payment, Token/Market, Wallet/Analysis, Transaction, Alert và AI/cache.
- [ ] Tách ERD chi tiết đủ đọc trên A4. Dự kiến tách `token-market` và `alert-history`; cân nhắc landscape cho `identity-payment` và enhanced transaction.
- [ ] Rà miền Wallet gồm overview/portfolio, total/per-token balance history, `wallet_analyses`, transfer/swap history, coverage meta, Helius/enhanced transaction, identity/tag/follow, token PnL, first fund và AI caches.
- [ ] Cho phép gom nhiều bảng vật lý thành một khái niệm trên ERD tổng thể; ERD chi tiết phải ghi rõ logical relation và physical FK.
- [ ] Chỉ giữ PK, FK/logical key và trường chính trên hình; phần văn bản giải thích quyết định thay vì đọc lại từng đường nối.
- [ ] Render lại toàn bộ Mermaid, kiểm tra tỷ lệ PDF và xem trực tiếp từng hình trước khi include vào LaTeX.
- [ ] Cập nhật caption/label/đoạn dẫn và đảm bảo hình xuất hiện gần đoạn giải thích tương ứng.

## Batch 5 — câu chuyện kỹ thuật PnL, provider migration và độ tin cậy

- [ ] Chọn mức chi tiết vừa đủ cho quá trình tự tổng hợp PnL từ Helius Enhanced Transactions.
- [ ] Nêu vấn đề event/data swap thiếu hoặc không đáng tin cậy, nhu cầu đối chiếu explorer/provider và heuristic dựa trên balance/program data.
- [ ] Không trình bày heuristic như decoder tổng quát đã chính xác; ghi rõ giới hạn kiểm chứng và hiệu năng với ví lớn.
- [ ] Giải thích vì sao lịch sử giao dịch không dự đoán trước, định giá tại thời điểm giao dịch và độ sâu dữ liệu khiến tự index toàn bộ vượt phạm vi.
- [ ] Viết migration khoảng một tháng sang Mobula/Zerion như một quyết định điều chỉnh phạm vi; không kể toàn bộ diễn biến nội bộ.
- [ ] Viết Balance Chart theo miền: trước dùng Birdeye; total balance hiện ưu tiên Mobula; per-token history giữ Zerion. Kiểm tra code cuối cùng trước khi chốt.
- [ ] Nêu việc đối chiếu Zerion total với Helius portfolio đã phát hiện sai lệch phân loại tài sản/token spam; không khẳng định chi tiết nội bộ Blockaid nếu không có nguồn công khai.
- [ ] Thể hiện băn khoăn “tự làm hay dùng provider” theo cách trưởng thành: nhóm tập trung giá trị vào chuẩn hóa, kiểm soát chất lượng, cache và khả năng thay nguồn thay vì tự xây indexer vượt phạm vi.
- [ ] Đưa phần phù hợp vào mục vấn đề kỹ thuật/decision record, không lặp nguyên câu chuyện ở Chương 2, Chương 4 và Chương 5.

## Batch 6 — giao diện và hình chức năng

- [ ] Rà source UI theo trang/component/style system: Carbon React, Carbon token/theme, SCSS module, Tailwind và component tự xây.
- [ ] Xác định màn hình gần hoàn thiện: Landing, Market Overview, Wallet; xác định bảng/component legacy ở Token Pool và Token Overview.
- [ ] Viết khó khăn ở cấp quy trình/kỹ thuật: chọn design system sớm khi navigation chưa ổn định, thay đổi định hướng giữa dự án, thiếu component governance và migration plan.
- [ ] Không ghi bất đồng cá nhân hoặc vai trò của giảng viên. Không tuyên bố migration hoàn tất nếu behavior/component legacy vẫn tồn tại.
- [ ] Nêu vấn đề không chỉ là style: component contract, interaction behavior, accessibility, loading/error/empty state và khả năng bảo trì.
- [ ] Quyết định bộ hình tối thiểu theo user journey thay vì mỗi subsection một screenshot.
- [ ] Danh sách hình dự kiến: Market Overview; Token Pool; Token Overview; Wallet Overview/analysis; User/profile/watchlist; AI feature/limit; có thể thêm auth/alert/payment nếu cần chứng minh chức năng.
- [ ] Mỗi hình phải có dữ liệu dễ đọc, nền thống nhất, không lộ key/thông tin nhạy cảm và caption mô tả giá trị thay vì chỉ tên trang.
- [ ] Thay toàn bộ `% CHÈN HÌNH`; bỏ placeholder không cần thiết thay vì cố chụp mọi màn hình.
- [ ] Đồng bộ thuật ngữ UI trong ảnh với phần mô tả chức năng và use case.

## Batch 7 — triển khai, kiểm thử và đánh giá

- [ ] Rà package scripts, Vitest config và toàn bộ `.test/.spec` ở client/server; phân loại test theo unit, component, route/service, contract/fixture và integration có mock.
- [ ] Ghi đúng những gì test hiện có chứng minh: auth, payment, alert/webhook, AI, wallet/PnL, cache coverage, rate limit, upstream error và một số component.
- [ ] Không gọi Zod/strong typing là kiểm thử; trình bày chúng như lớp validation/fail-fast hỗ trợ độ tin cậy.
- [ ] Xây phạm vi “vừa đủ báo cáo”: normalizer/calculation unit test; provider contract test bằng fixture; route/service test với mock upstream; cache fresh/stale/error; component state; smoke test luồng demo.
- [ ] Chọn status cần kiểm tra: 200, validation 400, rate limit 429, upstream 500/502, invalid JSON, error envelope và schema mismatch.
- [ ] Xác định test nào cần bổ sung thật và test nào chỉ là hướng phát triển. Không viết kết quả trước khi test tồn tại/chạy được.
- [ ] Nếu được phép chạy test, ghi lại lệnh, môi trường, số test và kết quả thật; không dùng số liệu từ trí nhớ hoặc ước lượng.
- [ ] Không chạy compile/type-check TypeScript để xác nhận theo quy tắc repo.
- [ ] Phần hiệu năng chỉ đưa số liệu đã đo. Ưu tiên cache hit/miss và một vài luồng provider có ý nghĩa; nếu không đo được thì chuyển thành đánh giá định tính/hạn chế.
- [ ] Viết hạn chế rõ: chưa có load test đầy đủ, E2E/staging còn hạn chế, external API có thể đổi response/quota và lỗi 4xx/5xx vẫn ảnh hưởng trải nghiệm.
- [ ] Viết quy trình tích hợp/triển khai dựa trên config/source thật; không tạo CI/CD hoặc monitoring chưa tồn tại.
- [ ] Sửa tổng kết chương để chỉ khẳng định đúng kết quả đã trình bày.

## Batch 8 — kết luận, đồng bộ và rà toàn văn

- [ ] Viết lại đóng góp dựa trên kết quả cuối: lớp dữ liệu nhiều provider, cache/read model, phân tích token-wallet, validation/type contract, UI journey và AI explanation.
- [ ] Không dùng số trang/tính năng làm thước đo duy nhất; nhấn chiều sâu của luồng Market → Pool → Token → Wallet → User → AI.
- [ ] Nêu hạn chế có chọn lọc: phụ thuộc provider, một số read model provider-specific, UI migration chưa hoàn tất và phạm vi kiểm thử còn giới hạn.
- [ ] Hướng phát triển phải nối trực tiếp với hạn chế: contract regression, observability/retry/circuit breaker, giảm coupling provider, hoàn thiện UI component governance, E2E/load test.
- [ ] Đồng bộ Chương 1 về mục tiêu, đóng góp và bố cục với cấu trúc/chức năng thật sau khi sửa.
- [ ] Rà toàn bộ label/ref/citation/caption/table of contents/list of figures/list of tables sau khi đổi chương.
- [ ] Rà thuật ngữ Việt/Anh, cách viết tên provider/framework, viết hoa và ký hiệu code/database.
- [ ] Rà giọng văn: bỏ câu chung chung, đoạn lặp, kết luận không có bằng chứng, danh sách dày và các chuyển đoạn máy móc.
- [ ] Rà chính tả toàn bộ báo cáo; ưu tiên đọc theo PDF để phát hiện câu dài, ngắt trang, bảng/hình quá nhỏ và khoảng trắng bất thường.
- [ ] Cập nhật `note_nhan_xet.md` sau cùng theo trạng thái thực, không dùng plan này thay cho việc đối chiếu feedback.

## Câu hỏi/mâu thuẫn phải giữ mở cho đến khi từng batch xử lý

- [ ] Provider cuối cùng của từng chart/token/wallet endpoint là gì; service nào còn fallback hoặc legacy consumer?
- [ ] `wallet_analyses` và các bảng PnL/winrate cũ: bảng nào active, bảng nào chỉ còn schema/migration?
- [ ] Total balance hiện đã chuyển hoàn toàn sang Mobula chưa; per-token Zerion có fallback/cache behavior nào?
- [ ] Những phần Helius heuristic/decoder cũ còn được route hiện tại sử dụng ở đâu?
- [ ] Có log/email/dashboard nào đủ để ghi chính xác thời gian Birdeye educational access và quota đặc biệt của Zerion không?
- [ ] Các trang/chức năng nào nhóm chắc chắn sẽ demo và chụp hình trong bản nộp?
- [ ] Có thể bổ sung/chạy test thật đến mức nào trước hạn nộp; có database/provider fixture an toàn để test không?
- [ ] Quy trình deploy/CI/CD thực tế hiện tại là gì; nội dung nào trong Chương triển khai đang chỉ là placeholder?
- [ ] Template/hướng dẫn của khoa có chấp nhận tách thành 6 chương và trang landscape cho ERD không?

## Trạng thái tổng

- [x] Thu thập feedback ban đầu và ngữ cảnh lịch sử từ nhóm.
- [x] Xác nhận lỗi `mmdc` mặc định và thử render thành công bằng Chromium config.
- [x] Kiểm kê sơ bộ provider usage, wallet schema và test files.
- [x] Batch 0 — inventory/hạ tầng báo cáo.
- [ ] Batch 1 — Chương 2/provider.
- [ ] Batch 2 — yêu cầu/use case.
- [ ] Batch 3 — kiến trúc tổng thể.
- [ ] Batch 4 — database/cache/ERD.
- [ ] Batch 5 — PnL/migration/độ tin cậy.
- [ ] Batch 6 — UI/hình chức năng.
- [ ] Batch 7 — triển khai/kiểm thử/đánh giá.
- [ ] Batch 8 — kết luận/đồng bộ/rà toàn văn.
