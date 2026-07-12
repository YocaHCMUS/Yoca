# Rà soát nhận xét của Thầy 2 — Báo cáo tốt nghiệp Yoca

Ghi chú cách đọc file này: mỗi mục được đối chiếu trực tiếp với bản báo cáo hiện tại. `[x]` = đã kiểm tra, đã ổn/đã sửa. `[ ]` = còn thiếu hoặc cần làm rõ, có ghi kèm vị trí file/dòng liên quan để dễ tìm.

## Đối chiếu bản báo cáo hiện tại với nhận xét dành cho bản cũ — 11/07/2026

**Lưu ý về thời điểm:** toàn bộ nhận xét của thầy và infographic dưới đây được tạo từ **bản báo cáo cũ, trước các batch chỉnh sửa vừa thực hiện**. Đây không phải nhận xét của thầy đối với bản hiện tại. Phần này chỉ dùng các nhận xét cũ làm baseline rồi tự đối chiếu lại với source và báo cáo mới; vì vậy `[x]`/`[ ]` bên dưới là kết quả rà soát nội bộ của nhóm, không phải trạng thái do thầy xác nhận.

Nguồn baseline gồm: nhận xét chung thầy gửi Nhóm A để Nhóm B rút kinh nghiệm; nhận xét trực tiếp cho bản cũ của Nhóm B; và các mục “Hạn chế & gợi ý cập nhật” trong `docs/yoca_infographic_html/`. Infographic là tài liệu AI cô đọng từ bản báo cáo cũ nên chỉ dùng như checklist tham khảo. Khi một nhận xét đã được xử lý trong các batch mới, giữ lại và đánh dấu hoàn thành để tránh sửa lặp hoặc vô tình phục hồi cấu trúc cũ.

**Cập nhật 12/07/2026:** rà lại toàn bộ mục `[ ]` còn mở ở trên, đối chiếu trực tiếp với source (LaTeX report và `server/src`) trước khi sửa. Một số mục hóa ra đã được xử lý trong lần viết trước đó nhưng note chưa cập nhật kịp (ngày khảo sát Chương 2, số tiêu chí bảng đối chiếu) — đã đánh dấu lại đúng trạng thái thay vì sửa trùng. Các mục nội dung còn thiếu thật sự (đạo đức/quyền riêng tư, threat model, API contract example, index rationale, AI context/prompt-injection, wash trading GCN/GAT/GraphSAGE overclaim, kịch bản biên) đã được bổ sung trực tiếp vào báo cáo, có đối chiếu source qua agent điều tra read-only trước khi viết. Phạm vi lần này **không gồm**: chèn ảnh thật, implement Alert History, kiểm tra nhánh CI/CD hay sửa test đỏ — đây là các hạng mục kỹ thuật tách riêng, không phải nội dung báo cáo.

### Nhận xét trực tiếp cho bản cũ của Nhóm B — đối chiếu ưu tiên cao nhất

- [ ] **Một số phần chưa viết xong:** bản báo cáo hiện không còn subsection nội dung trống; merge đã resolve, test suite đã xanh và Alert History đã có implementation tự động. Bản nộp vẫn chưa thể chốt khi ảnh chức năng, database reset/smoke test Alert History và bằng chứng CI/Render chưa hoàn tất.
- [ ] **Một số phần chưa có hình ảnh:** Chương 5 vẫn chưa có screenshot sản phẩm thật. TODO filename và nội dung bắt buộc đã được gắn trực tiếp trong `Chapter4/chapter4.tex`; checklist tổng nằm tại `docs/plans/reports/FINAL_REPORT_SCREENSHOT_CHECKLIST.md`.
- [ ] **Thiết kế dữ liệu từng dài hơn khoảng hai lần các component/layer kiến trúc khác:** đây là nhận xét trên bản cũ, nhưng khi tự đo lại bản hiện tại thì độ lệch vẫn còn: `Chapter4/architecture.tex` có khoảng 53 dòng nội dung khung, trong khi cụm `Chapter3/database/*.tex` khoảng 193 dòng chưa kể hình. Cần cân lại bằng một trong hai hướng: rút phần liệt kê bảng/ERD chi tiết xuống phụ lục, hoặc bổ sung chiều sâu tương xứng cho client, API/domain, provider adapter, validation, AI/payment và deployment. Không nên chỉ thêm chữ cho cân trang; ưu tiên rút phần database chi tiết.

### Nhận xét chung từ Nhóm A áp dụng cho Nhóm B

- [ ] **Rà chính tả và toàn văn là trách nhiệm của nhóm:** Batch 8 mới rà bằng tìm kiếm và PDF ở các phần thay đổi; chưa thể xem là proofread thủ công 100 trang. Cần phân công đọc chéo, đánh dấu người đọc/chương và kiểm tra lại bản PDF cuối sau khi chèn ảnh, CI/CD, test và Alert History.
- [ ] **Một lỗi nhỏ vẫn có thể ảnh hưởng toàn bộ bản nộp:** trước khi chốt phải chạy checklist build sạch, mục lục, citation, tên bảng/hình, số chương, thông tin bìa, secret trong ảnh và các khẳng định “đã hoàn thành”.
- [x] **Chương 2 không sa đà cơ sở lý thuyết cơ bản:** phần công nghệ giáo khoa đã được bỏ; quyết định framework và trade-off đã chuyển sang Chương 4.
- [x] **Chương 3 tương ứng bước phân tích yêu cầu:** đã viết lại theo user journey, nhóm yêu cầu, yêu cầu chất lượng, use case và tiêu chí chấp nhận.
- [x] **Tách kiến trúc thành chapter riêng:** Chương 4 hiện là “Kiến trúc và thiết kế hệ thống”, có sơ đồ tổng thể và giải thích thành phần.
- [x] **Giải thích lựa chọn framework thay vì chỉ định nghĩa:** đã nêu vai trò React/Vite/Hono/Drizzle; tuy nhiên so sánh A-vs-B hiện được viết theo nhu cầu Yoca, không dựng bảng so sánh dài với Express/Vue/Prisma.

### Chương 2 — các điểm phải kiểm tra lại sau đợt viết mới

- [x] URL và hình đại diện của Arkham, Birdeye/CoinGecko, Dune/Nansen đang có trong nội dung.
- [x] **Ngày khảo sát** — rà lại thấy `chapter2.tex` dòng 9 đã có mốc Sprint 1 (07/09/2025 -- 21/09/2025) ngay đầu mục khảo sát nền tảng; mục này thực ra đã được xử lý trước khi note này viết, ghi nhận lại cho đúng trạng thái.
- [ ] Mô tả nền tảng hiện thiên về văn xuôi, chưa dùng nhiều cụm in đậm như nhận xét của thầy. Đây là lựa chọn văn phong có chủ đích (ưu tiên văn xuôi, hạn chế bullet/in đậm dày theo nguyên tắc chung của đợt viết lại); giữ nguyên trừ khi thầy yêu cầu cụ thể lại.
- [x] Bảng đối chiếu — đã có đoạn lập luận trước bảng (`chapter2.tex` dòng 60--69) và đã tăng lên 9 tiêu chí (8 tiêu chí gốc + tiêu chí "Ngôn ngữ và đơn vị hiển thị" mới thêm để nêu bật localization tiếng Việt/VND, một khác biệt thật của Yoca so với 4 nền tảng khảo sát).
- [ ] Infographic đề nghị rubric/điểm số và benchmark cùng token/ví. Chưa bổ sung vì chưa có phương pháp và dữ liệu đo thật; giữ nguyên quyết định không bịa latency/mức trùng khớp.
- [x] Cơ sở học thuật cho wash trading/graph ML — kiểm tra source (`server/src/services/wash-trading-ai.service.ts`) xác nhận GCN/GAT/GraphSAGE hiện chỉ là ba bộ trọng số đặt tên theo các kiến trúc đó cho một hàm chấm điểm heuristic, không phải mô hình GNN đã huấn luyện. Không có cơ sở để trích dẫn paper GCN/GAT/GraphSAGE như đóng góp nghiên cứu; đã sửa câu văn ở `Chapter4/chapter4.tex` (mục wash trading) để mô tả đúng là "bộ trọng số lấy cảm hứng từ GNN", đồng thời không thêm citation không tương ứng với cài đặt thật.

### Chương 1 — gợi ý từ infographic

- [ ] Thiếu số liệu định lượng chứng minh tính cấp thiết (quy mô giao dịch/ví mẫu, số công cụ phải dùng hoặc độ trễ). Chỉ thêm số liệu có nguồn và thời điểm rõ ràng; không lấy số marketing không kiểm chứng.
- [ ] Mục tiêu chưa có KPI vận hành. Do hiện chưa có benchmark, nên ưu tiên tiêu chí chấp nhận định tính có thể kiểm chứng; KPI latency/cache hit/alert delay chỉ thêm sau khi đo thật.
- [x] Persona và user journey chính đã được thu hẹp hơn trong Chương 3, nhưng có thể bổ sung một kịch bản “một ngày sử dụng” nếu cần làm rõ UX.
- [x] Nguyên tắc đạo đức/quyền riêng tư — đã thêm một đoạn cuối mục "Phạm vi ứng dụng" (`Chapter1/chapter1.tex`) nêu rõ: không suy diễn danh tính/chủ sở hữu ví, AI và tín hiệu wash trading chỉ là gợi ý cần đối chiếu, giới hạn thu thập dữ liệu cá nhân và quyền xóa tài khoản.

### Chương 3/4 — gợi ý từ infographic và nhận xét kiến trúc

- [x] Kế hoạch kiểm thử và tiêu chí pass/fail đã có bảng; kết quả thật được ghi ở Chương 5.
- [x] API contract — đã thêm Bảng~\ref{tab:api_contract_example} ở `Chapter4/architecture.tex` minh họa request/response, error envelope `{ error, code }` và ví dụ `WalletAnalysisServiceError`/`WalletAiDailyLimitError` lấy từ source thật (`server/src/services/wallet/walletAnalysis.service.ts`, `server/src/routes/wallets.ts`).
- [x] Threat model — đã thêm section "Ranh giới tin cậy và các điểm cần bảo vệ" ở `Chapter4/architecture.tex`, nêu xác thực chữ ký ví (ed25519 + nonce), xác minh chữ ký webhook Stripe, xác minh giao dịch Solana qua RPC, đồng thời **nêu rõ hạn chế thật**: webhook Helius hiện chỉ dùng shared-secret header, chưa xác minh chữ ký payload.
- [x] Database index rationale — đã thêm đoạn cuối `Chapter3/database/core-tables.tex` liệt kê index thật (`wallet_transfer_history`/`wallet_swap_history` theo `(address, block_timestamp_ms)`, unique index trên `wallet_enhanced_*`, index `user_id` trên `chat_sessions`/`chat_prompts`) kèm lý do theo mẫu truy vấn; không thêm capacity estimate vì chưa đo.
- [x] AI context schema/prompt-injection boundary — đã bổ sung ở `Chapter4/chapter4.tex` (mục AI) và `Chapter4/architecture.tex` (threat model): ngữ cảnh dùng kiểu riêng theo miền (`TokenAiContext`...), dữ liệu không tin cậy được bọc trong dấu phân định kèm chỉ dẫn không thực thi lệnh chèn trong dữ liệu — mô tả đúng mức "guardrail thực dụng", không phải cơ chế đã kiểm chứng độc lập.

### Chương 5 — triển khai, kiểm thử và hình ảnh

- [x] Đã cập nhật kết quả chạy ngày 12/07/2026: client 16/16 file, 178/178 test; server 29/29 file, 204/204 test sau Batch 12, cả hai suite đều xanh.
- [ ] Infographic đề nghị latency p50/p95, cache hit rate, số request tiết kiệm và lỗi 429 trước/sau. Hiện chưa có phép đo lặp lại được nên báo cáo đã chuyển thành giới hạn; chỉ cập nhật khi có benchmark thật.
- [x] Kịch bản biên — đã xác nhận và ghi vào `Chapter4/chapter4.tex` (mục "Phạm vi kiểm thử hiện có") những kịch bản đã có test thật (webhook duplicate signature qua `wallet-alerts.service.test.ts`, prompt-injection guardrail qua `chat-response-guardrails.test.ts`) và những kịch bản còn ở mức thiết kế, chưa có test riêng (ví lịch sử rất dài, token thiếu giá, payment thất bại giữa chừng). Provider timeout/malformed JSON đã có test status 500/502/invalid JSON từ Batch 7, không lặp lại ở đây.
- [ ] Screenshot có chú thích vẫn là backlog bắt buộc; không cần mỗi chức năng một hình nhưng sáu ảnh chính và cặp localization phải đủ chứng minh user journey.
- [ ] Hướng dẫn tái lập triển khai mới ở mức quy trình trong báo cáo; cần đồng bộ workflow CI/CD, migration, environment và smoke check sau khi nhánh kia merge. Rollback/seed data chỉ ghi nếu thực sự tồn tại.
- [ ] Chưa có user testing với người mới/nhà giao dịch/người nghiên cứu. Nếu không tổ chức kịp, phải giữ trong hạn chế, không biến phản hồi nội bộ thành user study.

### Chương 6 — kết luận và roadmap

- [x] Chương 6 đã được viết lại, không còn lặp danh sách chức năng dài và đã nối hạn chế với hướng phát triển.
- [ ] Infographic đề nghị ưu tiên roadmap theo impact/effort hoặc mốc 3--6--12 tháng. Có thể thêm một đoạn ưu tiên ngắn; không cần dựng lịch cam kết nếu nhóm không tiếp tục dự án.
- [ ] Chưa có success metric cho từng hướng như contract pass rate, AI citation coverage hoặc precision/recall wash trading. Các metric nghiên cứu chỉ nên đặt sau khi định nghĩa dataset và cách đo.
- [ ] Chưa có kế hoạch chi phí vận hành/cloud/provider. Phần provider đã có giá/free tier tại thời điểm khảo sát; tổng cost model chỉ bổ sung nếu có cấu hình triển khai thực tế.
- [ ] Compliance/privacy và abuse prevention cần được nhắc nếu hướng phát triển giữ ý tưởng mở Developer API.
- [ ] Benchmark Yoca với nền tảng khác sau cải tiến là hướng phát triển hợp lý nhưng chưa phải kết quả hiện tại.

## Ý 2 & 7 — Chính tả và rà soát chung
- [ ] Thầy không chỉ cụ thể chỗ nào bị sai chính tả — cần cả nhóm tự đọc lại toàn bộ 5 chương.
- [ ] Gợi ý: chia nhau đọc chéo (người này đọc phần người kia viết) sẽ dễ phát hiện hơn tự đọc bài mình viết.

## Ý 4 — Chương 2: Các hệ thống liên quan

### Danh sách nền tảng khảo sát (Arkham, Birdeye, CoinGecko, Dune, Nansen) — `Chapter2/chapter2.tex` dòng 14–57
- [x] **URL hiển thị trực tiếp trong bài** — đã thêm dòng URL ngay dưới mỗi `\subsection{...}` cho cả 5 nền tảng.
- [x] **Thiếu hình đại diện/logo** của từng nền tảng — đã chèn `\includegraphics` cho cả 5 logo từ `images/chapter2/` (arkm, birdeye, coingecko, dune, nansen-logo.png).
- [x] **Ngày nhóm khảo sát** — đã thêm, dùng mốc Sprint 1 (07/09/2025 -- 21/09/2025) theo `Plans.tex`.
- [x] **Danh sách chức năng sơ sài** — đã viết lại, in đậm tên luồng xử lý chính (entity labeling, fund flow tracing, network graph, real-time price tracking, trending detection, price aggregation, on-chain indexing, SQL tùy biến, wallet labeling, smart money) kèm mô tả cơ chế xử lý chi tiết hơn cho cả 5 nền tảng.
- [x] **Hạn chế** — đọc lại thì phần này **đã tốt sẵn**, mỗi nền tảng đều có đoạn nêu rõ hạn chế cụ thể + Yoca giải quyết bằng cách nào (vd. Arkham: vấn đề riêng tư + độ phức tạp → Yoca không định danh thực thể + dùng AI diễn giải). Không cần sửa thêm, chỉ cần đọc lại 1 lượt cho chắc chính tả.

### Bảng đối chiếu tính năng — `Chapter2/platform_comparison_table.tex`
- [x] Đã sửa: cột không còn ghi "SolSight", đã đổi đúng thành "Yoca".
- [ ] Bảng vẫn còn khá ít (7 tiêu chí) và phần dẫn trước bảng chỉ có 2 đoạn văn ngắn (`chapter2.tex` dòng 63–68 hiện tại) → dễ tạo cảm giác "chưa phân tích gì đã đưa Yoca vào so sánh". Nên viết thêm phân tích/lập luận trước khi vào bảng, và cân nhắc bổ sung thêm tiêu chí so sánh. **(chưa làm — sub-item tiếp theo)**

### Cơ sở lý thuyết và công nghệ áp dụng — `Chapter2/chapter2.tex` dòng ~75–150 (mục "Cơ sở lý thuyết và công nghệ áp dụng")
- [ ] **Cần dời phần này sang chapter Kiến trúc** (xem Ý 6 bên dưới) theo đúng góp ý của thầy.
- [ ] Đây hiện là phần dài nhất của Chương 2, trong khi phần "vấn đề cần xử lý / chức năng cần thực hiện" lại ngắn hơn hẳn. Cần cắt bớt các đoạn giải thích khái niệm cơ bản (on-chain là gì, ORM là gì, React/component là gì...), chỉ giữ phần **lý do lựa chọn công nghệ này thay vì công nghệ khác tương đương**.

## Ý 5 — Chương 3: Phân tích, xác định yêu cầu

### Sơ đồ Use Case — `Chapter3/chapter3.tex` dòng 59–70
- [x] Sơ đồ use-case tổng quát hiện chỉ mô tả 2 tác nhân và gộp thành 6 nhóm chức năng lớn trong văn bản — đã bổ sung 2 sơ đồ phụ (Khách, Người dùng đã đăng ký) để liệt kê chi tiết use-case con.
- [x] **Sơ đồ use-case phụ** — đã chèn `guest-user-diagram.pdf` và `registered-user-diagram.pdf` (`images/chapter3/`) vào `chapter3.tex` ngay sau sơ đồ chính, kèm chú thích Hình~\ref{fig:usecase_guest} / \ref{fig:usecase_registered}. Nhóm quyết định chỉ dùng 2 sơ đồ phụ (Khách + Người dùng đã đăng ký), không tách thêm theo 6 nhóm chức năng vì sẽ không phù hợp bố cục.

## Ý 6 — Kiến trúc hệ thống
- [ ] **Tách thành 1 chapter riêng** — hiện đang là 1 section trong Chương 3 (`chapter3.tex` dòng 72–127).
- [ ] **Đầu chapter cần giải thích chi tiết các thành phần chính** — đoạn giới thiệu hiện tại chỉ có 2 đoạn ngắn, cần mở rộng.
- [ ] **Cần nêu rõ lý do chọn framework A thay vì framework B tương đương** (vd. Hono vs Express, React vs Vue) khi dời nội dung công nghệ sang chương kiến trúc mới.
- [ ] **CSDL — thiếu sơ đồ tổng thể** — `Chapter3/database/erd.tex` có 8 sơ đồ ERD chi tiết theo miền nhưng chưa có 1 sơ đồ tổng thể (chỉ tên bảng, không cột) đặt ở đầu phần CSDL như thầy yêu cầu và như lưu ý cũ của nhóm.
- [ ] **Hình ERD đang bị nhỏ** — `Chapter3/database/erd.tex` cần phóng to lại các hình ERD hiện có cho dễ đọc.

## Ý 7 — Technical problems ở Chương 3 và Chương 4
- [x] Chương 4 đã có mục "Giải quyết các thách thức kỹ thuật" (dòng 217), viết theo công thức "vấn đề → giải pháp", khá ổn.
- [ ] Chương 3 chưa có mục tương ứng ở giai đoạn thiết kế — cân nhắc bổ sung 1 section "Các vấn đề kỹ thuật cần giải quyết trong thiết kế".

## Ý 8 — Chương Kết quả cài đặt và thử nghiệm (Chương 4)
- [ ] ⚠️ **Quan trọng nhất**: mục "Kết quả kiểm thử và đánh giá hệ thống" (dòng 266) có 5 mục con đang hoàn toàn trống trong khi đoạn tổng kết chương đã viết như thể đã có kết quả. Cần điền thật hoặc sửa lại đoạn tổng kết + tên chương.
- [ ] Chương 3 cũng có mục "Kế hoạch kiểm thử và tiêu chí chấp nhận" (dòng 220) với 3 mục con trống.
- [ ] "Quy trình tích hợp và triển khai hệ thống" (`chapter4.tex` dòng 29–34) có 3 mục con trống.
- [ ] Nhiều chỗ trong `chapter4.tex` còn placeholder `% CHÈN HÌNH`, khi chèn ảnh thật cần thống nhất nền trắng.
- [ ] Đồng bộ Chương 3 – Chương 4 sau khi hoàn thiện ảnh.

### ⚠️ BẮT BUỘC IMPLEMENT TRƯỚC KHI CHỐT BẢN NỘP — ALERT HISTORY
- [ ] **IMPLEMENT ALERT HISTORY END-TO-END**: ghi lịch sử sau khi delivery thành công; API lấy lịch sử theo đúng user; trạng thái đã đọc/chưa đọc; chống gửi trùng/idempotency; trạng thái delivery thất bại nếu phạm vi cho phép.
- [ ] Bổ sung test cho ownership, ghi lịch sử sau delivery, đánh dấu đã đọc và chống duplicate event.
- [ ] Sau khi implement, đồng bộ Chương yêu cầu, kiến trúc/ERD, chương triển khai, tiêu chí chấp nhận và ảnh giao diện. Không đánh dấu xong chỉ vì báo cáo đã có nội dung mô tả.

### ⚠️ GITHUB ACTIONS CI ĐÃ MERGE NHƯNG CÒN CONFLICT — PHẢI CẬP NHẬT LẠI CHƯƠNG 5
- [ ] Resolve toàn bộ conflict, đặc biệt các phần user auth tier/entitlement và wallet/provider, trước khi xem workflow là trạng thái source cuối.
- [ ] Workflow hiện có typecheck, lint, test client/server và build client/server; đây là CI, chưa có bằng chứng về CD/deploy tự động.
- [ ] Chỉ mô tả trigger, job, environment/secret và kết quả run thực sự tồn tại. Không thêm migration, deploy, rollback hoặc smoke check sau deploy nếu workflow cuối không có.
- [ ] Sau khi workflow chạy ổn định, cập nhật mục quản lý mã nguồn và môi trường, tích hợp liên tục, cùng quy trình triển khai thủ công/thực tế tương ứng.
- [ ] Nếu cần bằng chứng, chỉ dùng workflow file, sơ đồ pipeline hoặc kết quả chạy đã loại thông tin nhạy cảm.

### ⚠️ TEST SUITE HIỆN CHƯA XANH — PHẢI RÀ LẠI TRƯỚC BẢN NỘP
- [x] Baseline đỏ ngày 11/07/2026 đã được thay bằng lần chạy lại ngày 12/07/2026: client 178/178 và server 200/200.
- [x] Các lỗi client cũ ở table/localization, chart click, Quick AI và ThemeProvider đã được xử lý trong source/test sau merge.
- [x] Các lỗi server cũ ở chat metadata/prompt và contract Zerion balance đã được xử lý; suite server hiện xanh.
- [x] Bảng kết quả kiểm thử, Tóm tắt và Chương 6 đã được cập nhật theo số cuối; vẫn phải chạy lại nếu source thay đổi trước bản nộp.

## Ý 9 — Kết luận (Chương 5)
- [x] Phần "Tổng kết các kết quả đạt được" đã khá tốt, tập trung vào kết quả tính năng cụ thể.
- [ ] Rà lại lần nữa cho chắc, đảm bảo không lặp lại nguyên văn mục tiêu/phương pháp từ Chương 1/3.

## Phần đầu/cuối báo cáo — Synopsis và Bảng thuật ngữ
- [ ] Rà và hoàn thiện Synopsis/Tóm tắt sau khi nội dung các chương đã ổn định; bảo đảm mục tiêu, phương pháp, kết quả và hạn chế khớp với bản báo cáo cuối, không viết trước kết quả kiểm thử.
- [ ] Rà `Appendix/glossary.tex`, bổ sung các thuật ngữ chuyên ngành và từ tiếng Anh xuất hiện nhiều trong báo cáo, đặc biệt ở blockchain, dữ liệu provider, cache, PnL, schema, transaction và kiến trúc phần mềm.
- [ ] Kiểm tra Synopsis và Bảng thuật ngữ đã được include đúng trong `main.tex`, xuất hiện ở mục lục/vị trí theo template và không lặp định nghĩa dài đã có trong nội dung chính.

## Ý 3 — Lưu ý chung (không phải nội dung cần sửa)
Lời nhắc trách nhiệm khi nộp báo cáo, không có hành động cụ thể trong nội dung.

---

### Tiến độ Ý 4 (đang làm)
1. ~~URL từng nền tảng~~ ✅
2. ~~Ngày khảo sát~~ ✅
3. ~~In đậm luồng xử lý chính~~ ✅
4. ~~Hạn chế cụ thể~~ ✅ (vốn đã tốt sẵn)
5. ~~Logo từng nền tảng~~ ✅
6. Bảng đối chiếu tính năng (thêm phân tích + tiêu chí) — ⏳ tiếp theo
7. Dời + cắt gọn "Cơ sở lý thuyết" sang chương Kiến trúc — ⏳ chưa làm

### Tóm tắt việc cần làm gấp nhất (theo mức độ ảnh hưởng, không đổi)
1. Điền nội dung thật (hoặc bỏ chữ "thử nghiệm") cho 5 mục kiểm thử trống ở Chương 4.
2. Tách kiến trúc hệ thống thành chương riêng, dời phần công nghệ từ Chương 2 sang, bổ sung lý do chọn framework A thay vì B.
3. Bổ sung sơ đồ CSDL tổng thể (chỉ tên bảng) ở đầu phần thiết kế CSDL.
4. ~~Bổ sung use-case chi tiết + sơ đồ use-case phụ đặt tên khớp với sơ đồ chính~~ ✅ đã chèn 2 sơ đồ phụ.
5. ~~Bổ sung logo cho từng nền tảng ở Chương 2~~ ✅ đã chèn.
6. Chèn ảnh thật (nền trắng thống nhất) thay các placeholder "% CHÈN HÌNH" còn lại ở Chương 4.
7. Rà chính tả toàn bộ 5 chương.
8. Phóng to lại các hình ERD trong `Chapter3/database/erd.tex` (đang nhỏ, khó đọc).

---

## Ghi chú bổ sung sau khi rà soát source code (11/07/2026)

### Nhà cung cấp dữ liệu và lịch sử thay đổi nguồn dữ liệu
- [ ] Kiểm kê lại provider theo **usage thực tế trong service**, không dựa riêng vào các file `server/src/util/util-*.ts`. Hiện CoinMarketCap còn utility nhưng không có service import; không nên trình bày như một nguồn đang vận hành. Dune SIM cũng không còn là nguồn chính của hệ thống.
- [ ] Cập nhật vai trò hiện tại của các nguồn chính: CoinGecko (token list, metadata, market/chart và search), Birdeye (token/pool/trade và một số dữ liệu ví còn lại), Mobula (wallet analysis, PnL, token-level PnL, transfer/swap history, một phần chart và holder), Zerion (lịch sử giá trị/số dư ví), Helius (enhanced transaction, webhook, portfolio và dữ liệu Solana), Moralis (một số luồng token/wallet fallback hoặc enrichment). Cần rà từng endpoint trước khi viết bản cuối.
- [ ] Bổ sung phần giới thiệu ngắn về từng provider: sản phẩm chính, loại dữ liệu Yoca sử dụng, lý do phù hợp, giới hạn kỹ thuật và giới hạn quota/chi phí. Chỉ dùng giá và free tier có nguồn chính thức, kèm ngày truy cập vì các gói thay đổi thường xuyên.
- [ ] Viết lại quá trình chuyển dịch nguồn dữ liệu như một quyết định kỹ thuật: phụ thuộc Birdeye trong giai đoạn đầu; giới hạn khả năng duy trì gói Lite; chuyển phân tích ví và PnL sang Mobula; chuyển lịch sử biến động giá trị ví sang Zerion; giữ nhiều provider để bù độ phủ thay vì tìm một nguồn thay thế hoàn toàn.
- [ ] Nêu rõ PnL có thể tự tính về mặt nguyên tắc nhưng việc thu thập đủ lịch sử giao dịch, định giá token tại thời điểm giao dịch và xử lý ví có tần suất bất thường làm chi phí triển khai/API tăng mạnh. Tránh diễn đạt như thể Yoca chỉ gọi một endpoint và nhận kết quả hoàn chỉnh.
- [ ] Đưa biến động chi phí, quota và schema upstream vào nhóm “các vấn đề kỹ thuật cần giải quyết”. Không nêu chi tiết trao đổi riêng với nhà cung cấp hoặc quy trách nhiệm; mô tả trung tính là điều kiện hỗ trợ/thương mại thay đổi trong quá trình phát triển.

### Kiến trúc dữ liệu thích nghi với API và cache
- [ ] Nhấn mạnh mục tiêu của schema không chỉ là chuẩn hóa dữ liệu, mà còn là giảm số lần gọi API khi cache stale. Tách bảng theo nhịp cập nhật và nguồn dữ liệu để một endpoint không phải chờ 2--3 provider mới tạo được một bản ghi đầy đủ.
- [ ] Giải thích chiến lược tận dụng dữ liệu dư từ response để cập nhật chéo có kiểm soát, ví dụ đồng bộ metadata token thu được từ portfolio/search/pool vào `token_meta`. Phân biệt rõ dữ liệu chủ đạo, dữ liệu enrichment và cache/read model.
- [ ] Trình bày việc schema phải thay đổi nhiều lần như quá trình thích nghi với độ phủ, response shape và quota của provider; không mô tả là thiết kế tùy tiện. Nêu trade-off giữa schema chuẩn hóa, tính độc lập provider, chi phí refresh và tốc độ triển khai.
- [ ] Thừa nhận có chủ đích rằng một số read model còn mang dấu vết migration gấp, điển hình `wallet_analyses` tập trung nhiều trường do ánh xạ gần với kết quả Mobula. Đưa đây vào hạn chế và hướng refactor, không cần phơi toàn bộ chi tiết vật lý trong sơ đồ tổng quan.

### Rà lại đầy đủ miền Wallet trong ERD
- [ ] ERD hiện tại chưa phản ánh đủ các cụm bảng wallet có trong source. Cần quyết định biểu diễn khái niệm cho: overview/portfolio cache; balance history; `wallet_analyses`; transfer/swap history và coverage meta; Helius transaction/enhanced transaction; identity/tag/followed wallet; token-level PnL/details; first fund; AI audit/swap summary cache; alert/webhook liên quan tới ví.
- [ ] Không đưa toàn bộ bảng và cột vào một hình. ERD tổng thể được phép gom theo read model/miền khái niệm để người đọc hiểu kiến trúc; các ERD chi tiết chỉ giữ PK, FK hoặc logical key và các trường có ý nghĩa thiết kế.
- [ ] Kiểm tra lại tên và vai trò các bảng legacy/song song (`wallet_helius_transactions`, `wallet_enhanced_*`, `wallet_transactions`, `wallet_swap`, `wallet_transfer_history`, `wallet_swap_history`) trước khi quyết định bảng nào xuất hiện trong báo cáo.

### Quá trình phát triển giao diện và Design System
- [ ] Bổ sung một khó khăn kỹ thuật về tính nhất quán giao diện: nhóm chọn Carbon Design System sớm khi luồng chức năng và điều hướng chưa ổn định; mức độ hiểu và cách áp dụng component khác nhau giữa thành viên khiến component, spacing, theme và style bị phân mảnh.
- [ ] Viết trung tính, không nhắc hoặc quy trách nhiệm cho giảng viên/thành viên. Tập trung vào nguyên nhân quy trình: prototype ban đầu chưa đủ chi tiết, thiếu quy ước UI chung và thiếu bước review/migration có hệ thống.
- [ ] Nêu biện pháp thực tế: thống nhất design token và semantic style, bọc/chuẩn hóa component dùng chung, ưu tiên migration các màn hình cốt lõi, chấp nhận một số màn hình legacy trong phạm vi đồ án. Không khẳng định đã migrate hoàn toàn nếu source vẫn còn Carbon/Tailwind/SCSS đan xen.

### Kiểm thử và độ tin cậy
- [ ] Không viết như thể nhóm đã có một quy trình QA hoàn chỉnh. Source hiện có Vitest ở cả client và server, gồm component/UI behavior, payment, auth, alert/webhook, route/service, cache coverage, upstream error handling và một số luồng wallet/AI; cần thống kê lại và dùng đúng bằng chứng này.
- [ ] Trình bày chiến lược hiện có là validation và fail-fast: response provider được kiểm tra bằng Zod, lỗi HTTP/error envelope/response sai shape được chuyển thành lỗi upstream có kiểu, Hono RPC và shared types giúp phát hiện sai lệch hợp đồng sớm, Drizzle bảo đảm truy cập schema nhất quán.
- [ ] Phân biệt validation với testing: Zod và strong typing giảm trạng thái dữ liệu mơ hồ nhưng không thay thế kiểm thử API, integration hay end-to-end.
- [ ] Đề xuất phạm vi kiểm thử “vừa đủ báo cáo”: unit test cho normalizer/calculation; contract test bằng fixture cho response provider; route/service test với mock upstream cho 200/400/429/500/502/invalid JSON/schema mismatch; cache test cho fresh/stale/fallback; một số smoke test cho luồng người dùng chính. Không bịa benchmark, coverage hoặc số test pass.
- [ ] Phần hạn chế phải nói rõ external API làm kết quả phụ thuộc quota, độ ổn định và thay đổi response; hiện chưa có load test, E2E đầy đủ hoặc môi trường staging ổn định. Đề xuất circuit breaker/retry có kiểm soát, observability và contract regression test như hướng hoàn thiện.

### Nguyên tắc viết lại
- [ ] Viết theo kiến trúc khái niệm và quyết định thiết kế, không biến báo cáo thành bản sao 1:1 của source. Có thể gom các bảng/luồng legacy để sơ đồ dễ hiểu, nhưng không được tạo số liệu, tính năng hoặc bảo đảm kỹ thuật không tồn tại.
- [ ] Ưu tiên văn xuôi, hạn chế chia subsection và bullet list; mỗi mục theo mạch “bối cảnh -- khó khăn -- quyết định -- trade-off -- kết quả/hạn chế”.
- [ ] Mọi thông tin giá/quota/provider phải có nguồn chính thức và ngày truy cập. Nếu thông tin giữa trang pricing và dashboard/key thực tế khác nhau, ghi theo gói nhóm thực dùng và chú thích thời điểm quan sát.

### Ngữ cảnh phát triển do nhóm bổ sung (dùng làm chất liệu viết, không chép nguyên văn)
- [ ] Giai đoạn đầu, nhóm tự tổng hợp PnL từ Helius Enhanced Transactions. Các trường abstraction như event/data cho swap thường thiếu hoặc không khớp khi đối chiếu Solscan/Birdeye, nên nhóm phải phát triển heuristic dựa trên balance change và program data. Cách này thể hiện năng lực nghiên cứu/chuẩn hóa dữ liệu nhưng không đủ tin cậy và quá chậm với ví lớn; không nên mô tả việc chuyển sang Mobula như từ bỏ phần kỹ thuật.
- [ ] Giải thích giới hạn cốt lõi của PnL: muốn tính đúng cần lịch sử giao dịch đủ sâu, phân loại swap đáng tin cậy và giá token lịch sử tại từng thời điểm. Khối lượng giao dịch của ví không dự đoán trước khiến việc tự thu thập/index toàn bộ vượt phạm vi tài nguyên của đồ án.
- [ ] Ghi nhận migration Mobula + Zerion kéo dài khoảng một tháng và tạm ảnh hưởng các chức năng Balance Chart, PnL, Overview; đây là ví dụ chính cho rủi ro phụ thuộc provider và chi phí thay đổi adapter/cache/schema.
- [ ] Cập nhật lịch sử Balance Chart: ban đầu Birdeye Lite cung cấp total và per-token balance; sau đó chuyển sang Zerion. Zerion từng tính sai total balance do nhận diện token spam/token account, làm số liệu lệch lớn so với portfolio Helius. Hiện total balance dùng Mobula vì khớp hơn, còn per-token history giữ Zerion vì Mobula chưa cung cấp đủ chi tiết. Khi viết chỉ nêu sai lệch phân loại tài sản và quá trình đối chiếu; không khẳng định nguyên nhân nội bộ của Zerion/Blockaid nếu không có tài liệu công khai.
- [ ] Token metadata có fallback/enrichment từ nhiều nguồn, nhưng không quảng bá fallback đa provider như chiến lược áp dụng mọi nơi. Nhóm chủ động hạn chế fallback vì khác biệt response/type làm tăng chi phí bảo trì, kiểm thử và debug.
- [ ] Mô tả tiến hóa schema theo hướng **incremental replacement / evolutionary architecture**: xây luồng hoặc read model mới song song, chuyển consumer sang bản mới, sau đó loại bỏ phần cũ. Rà các bảng PnL/winrate/cache deprecated để không đưa nhầm vào ERD đích.
- [ ] Dùng ví dụ nullability để giải thích defensive schema: ngoài address, metadata như symbol và các chỉ số biến động giá có thể thiếu dù tài liệu API không nêu hết trường hợp. Zod boundary và cột nullable giúp hệ thống fail rõ ở dữ liệu bắt buộc nhưng vẫn chấp nhận enrichment tùy chọn.
- [ ] Ghi đúng DB-first pattern của service: route chỉ gọi `get*`; `get*` đọc cache và kiểm tra staleness; khi stale/missing thì gọi `fetch*`; `fetch*` lấy upstream, validate/normalize, cập nhật DB rồi trả cùng response type. Kiểm tra source trước khi khái quát vì không phải mọi service đều tuân thủ hoàn toàn.
- [ ] UI hiện đại hóa gần hoàn thiện ở Landing, Market Overview và Wallet; Token Pool/Token Overview vẫn có bảng/component legacy. Vấn đề không chỉ là SCSS mà còn là component contract và behavior của design system bị thay bằng component tự xây giữa dự án.
- [ ] Viết khó khăn UI ở cấp quy trình: thay đổi định hướng thẩm mỹ giữa dự án, thiếu component governance và migration plan, dẫn đến chi phí học Carbon không được tận dụng đầy đủ. Không đưa bất đồng cá nhân hoặc nhận xét về giảng viên vào báo cáo.
- [ ] Luồng demo hiện tại: Market Overview -- Token Pool -- Token Overview -- Wallet Overview -- User -- AI Features/Limit. Không tự hạ thấp vì số trang; đánh giá theo chiều sâu dữ liệu, liên kết giữa miền chức năng, caching, validation và khả năng giải thích kết quả. Cần biến luồng này thành một kịch bản xuyên suốt thay vì danh sách trang.
