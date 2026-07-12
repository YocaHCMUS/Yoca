# Rà soát nhận xét của Thầy 2 — Báo cáo tốt nghiệp Yoca

Ghi chú cách đọc file này: mỗi mục được đối chiếu trực tiếp với bản báo cáo hiện tại. `[x]` = đã kiểm tra, đã ổn/đã sửa. `[ ]` = còn thiếu hoặc cần làm rõ, có ghi kèm vị trí file/dòng liên quan để dễ tìm.

## Ý 2 & 7 — Chính tả và rà soát chung
- [ ] Thầy không chỉ cụ thể chỗ nào bị sai chính tả — cần cả nhóm tự đọc lại toàn bộ 5 chương.
- [ ] Gợi ý: chia nhau đọc chéo (người này đọc phần người kia viết) sẽ dễ phát hiện hơn tự đọc bài mình viết.

## Ý 4 — Chương 2: Các hệ thống liên quan

### Danh sách nền tảng khảo sát (Arkham, Birdeye, CoinGecko, Dune, Nansen) — `Chapter2/chapter2.tex` dòng 14–57
- [x] **URL hiển thị trực tiếp trong bài** — đã thêm dòng URL ngay dưới mỗi `\subsection{...}` cho cả 5 nền tảng.
- [ ] **Thiếu hình đại diện/logo** của từng nền tảng — cần bạn cung cấp file ảnh (logo chính thức của Arkham, Birdeye, CoinGecko, Dune, Nansen), mình sẽ viết code `\includegraphics` chèn vào khi có ảnh.
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
- [ ] Sơ đồ use-case tổng quát hiện chỉ mô tả 2 tác nhân và gộp thành 6 nhóm chức năng lớn trong văn bản. Cần liệt kê chi tiết hơn các use-case con trong từng nhóm.
- [ ] **Không tìm thấy sơ đồ use-case phụ nào trong file `.tex` hiện tại** (chỉ có duy nhất 1 hình `usecase.png`). Cần kiểm tra lại file ảnh gốc, đối chiếu tên use-case con với tên trong sơ đồ chính, bổ sung sơ đồ phụ còn thiếu.

## Ý 6 — Kiến trúc hệ thống
- [ ] **Tách thành 1 chapter riêng** — hiện đang là 1 section trong Chương 3 (`chapter3.tex` dòng 72–127).
- [ ] **Đầu chapter cần giải thích chi tiết các thành phần chính** — đoạn giới thiệu hiện tại chỉ có 2 đoạn ngắn, cần mở rộng.
- [ ] **Cần nêu rõ lý do chọn framework A thay vì framework B tương đương** (vd. Hono vs Express, React vs Vue) khi dời nội dung công nghệ sang chương kiến trúc mới.
- [ ] **CSDL — thiếu sơ đồ tổng thể** — `Chapter3/database/erd.tex` có 8 sơ đồ ERD chi tiết theo miền nhưng chưa có 1 sơ đồ tổng thể (chỉ tên bảng, không cột) đặt ở đầu phần CSDL như thầy yêu cầu và như lưu ý cũ của nhóm.

## Ý 7 — Technical problems ở Chương 3 và Chương 4
- [x] Chương 4 đã có mục "Giải quyết các thách thức kỹ thuật" (dòng 217), viết theo công thức "vấn đề → giải pháp", khá ổn.
- [ ] Chương 3 chưa có mục tương ứng ở giai đoạn thiết kế — cân nhắc bổ sung 1 section "Các vấn đề kỹ thuật cần giải quyết trong thiết kế".

## Ý 8 — Chương Kết quả cài đặt và thử nghiệm (Chương 4)
- [ ] ⚠️ **Quan trọng nhất**: mục "Kết quả kiểm thử và đánh giá hệ thống" (dòng 266) có 5 mục con đang hoàn toàn trống trong khi đoạn tổng kết chương đã viết như thể đã có kết quả. Cần điền thật hoặc sửa lại đoạn tổng kết + tên chương.
- [ ] Chương 3 cũng có mục "Kế hoạch kiểm thử và tiêu chí chấp nhận" (dòng 220) với 3 mục con trống.
- [ ] "Quy trình tích hợp và triển khai hệ thống" (`chapter4.tex` dòng 29–34) có 3 mục con trống.
- [ ] Nhiều chỗ trong `chapter4.tex` còn placeholder `% CHÈN HÌNH`, khi chèn ảnh thật cần thống nhất nền trắng.
- [ ] Đồng bộ Chương 3 – Chương 4 sau khi hoàn thiện ảnh.

## Ý 9 — Kết luận (Chương 5)
- [x] Phần "Tổng kết các kết quả đạt được" đã khá tốt, tập trung vào kết quả tính năng cụ thể.
- [ ] Rà lại lần nữa cho chắc, đảm bảo không lặp lại nguyên văn mục tiêu/phương pháp từ Chương 1/3.

## Ý 3 — Lưu ý chung (không phải nội dung cần sửa)
Lời nhắc trách nhiệm khi nộp báo cáo, không có hành động cụ thể trong nội dung.

---

### Tiến độ Ý 4 (đang làm)
1. ~~URL từng nền tảng~~ ✅
2. ~~Ngày khảo sát~~ ✅
3. ~~In đậm luồng xử lý chính~~ ✅
4. ~~Hạn chế cụ thể~~ ✅ (vốn đã tốt sẵn)
5. Logo từng nền tảng — ⏳ chờ bạn gửi ảnh
6. Bảng đối chiếu tính năng (thêm phân tích + tiêu chí) — ⏳ tiếp theo
7. Dời + cắt gọn "Cơ sở lý thuyết" sang chương Kiến trúc — ⏳ chưa làm

### Tóm tắt việc cần làm gấp nhất (theo mức độ ảnh hưởng, không đổi)
1. Điền nội dung thật (hoặc bỏ chữ "thử nghiệm") cho 5 mục kiểm thử trống ở Chương 4.
2. Tách kiến trúc hệ thống thành chương riêng, dời phần công nghệ từ Chương 2 sang, bổ sung lý do chọn framework A thay vì B.
3. Bổ sung sơ đồ CSDL tổng thể (chỉ tên bảng) ở đầu phần thiết kế CSDL.
4. Bổ sung use-case chi tiết + sơ đồ use-case phụ đặt tên khớp với sơ đồ chính.
5. Bổ sung logo cho từng nền tảng ở Chương 2 (còn lại duy nhất phần này trong cụm "danh sách nền tảng").
6. Chèn ảnh thật (nền trắng thống nhất) thay các placeholder "% CHÈN HÌNH" còn lại ở Chương 4.
7. Rà chính tả toàn bộ 5 chương.