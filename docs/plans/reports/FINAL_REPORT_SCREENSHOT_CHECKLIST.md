# Screenshot checklist cho báo cáo cuối kỳ

Ảnh chỉ được chụp sau khi dữ liệu demo và giao diện tương ứng ổn định. Mỗi ảnh cần dùng cùng viewport, theme và ngôn ngữ; không lộ API key, email thật, wallet nhạy cảm hoặc dữ liệu thanh toán. Caption phải giải thích giá trị của màn hình trong user journey, không chỉ ghi tên trang.

- [x] Market Overview: một ảnh đủ thấy nhóm market chính, bộ lọc và khả năng đi tiếp đến token/pool. Đã chèn `market-overview.png` vào chapter4.tex.
- [x] Token Pool: pool selector, market metrics, chart và bảng recent transactions; ưu tiên chọn token có dữ liệu đầy đủ. Đã chèn `token-pool.png`.
- [x] Token Overview: identity/stats, chart và một nhóm nội dung chuyên sâu; không cố nhồi mọi tab vào một ảnh. Đã chèn `token-overview.png` (identity/stats/chart) + `token-overview-holders.png` (tab Holders) làm hai figure riêng.
- [x] Wallet Overview/Analysis: holdings, PnL/volume theo kỳ và balance chart; dùng ví demo có lịch sử vừa đủ, không quá nhiễu. Đã chèn `wallet-analysis.png` (tổng quan) + `wallet-analysis-positions.png` (chi tiết theo từng vị thế token).
- [ ] User/Profile: watchlist hoặc linked wallet/subscription trong cùng ngữ cảnh; tránh thông tin cá nhân thật. **Còn thiếu ảnh** — TODO vẫn ở chapter4.tex (`profile-watchlist.png`).
- [x] AI feature và giới hạn sử dụng: phản hồi có dữ liệu nguồn hoặc trạng thái quota rõ ràng. Dùng lại ảnh "Ask Yoca AI" ở Token Overview (đã thấy "4/5 questions remaining today (Free)"), chèn thành `ai-limit.png`.
- [x] Localization: chụp cùng một vùng màn hình ở English/USD và Vietnamese/VND để chứng minh cả dịch chuỗi lẫn formatter tiền tệ/ngày giờ. Dùng cặp Wallet Overview EN/VI đã có sẵn, chèn thành một figure xếp chồng hai ảnh.
- [ ] **BẮT BUỘC — Alert History:** chụp Profile/Alert Center có notification thật, trạng thái read/unread và delivery; che email, webhook, signature và ví nhạy cảm. Lưu thành `images/chapter5/alert-history.png`. **Chưa có ảnh, còn TODO trong chapter4.tex.**
- [ ] **BẮT BUỘC — CI:** chụp GitHub Actions run có typecheck, lint, test và build đạt; không để lộ repository secret. Lưu thành `images/chapter5/github-actions-ci.png`. **Chưa có ảnh** — workflow `.github/workflows/ci.yml` đã sẵn sàng, chỉ cần push và chụp run xanh.
- [ ] **BẮT BUỘC — Deployment:** chụp trạng thái deploy thành công của Render Static Site và Web Service hoặc hai ảnh ghép rõ tên service/trạng thái; che deploy hook và biến môi trường. Lưu thành `images/chapter5/render-deployment.png`. **Chưa có ảnh, còn TODO trong chapter4.tex.**
- [ ] Chỉ thêm Auth, Payment hoặc Wash Trading nếu ảnh chứng minh được chức năng mà các ảnh bắt buộc chưa thể hiện. Hai TODO này (`auth-modal.png`, `wash-trading.png`) vẫn là optional, chưa cần xử lý.
- [x] Rà lại toàn bộ `% Ảnh cần chụp` trong Chương 5: 8/11 slot đã có figure thật; còn 3 slot bắt buộc (Alert History, CI, Deployment) và 1 slot thường (Profile/Watchlist) vẫn là TODO comment vì chưa có ảnh nguồn — không phải lỗi build.
- [ ] Sau khi chèn ảnh, build PDF và kiểm tra chữ trong ảnh còn đọc được ở tỷ lệ in A4.

## Tên file bắt buộc để Codex chèn tự động

- [x] `images/chapter5/market-overview.png`
- [x] `images/chapter5/token-pool.png`
- [x] `images/chapter5/token-overview.png`
- [x] `images/chapter5/wallet-analysis.png`
- [ ] `images/chapter5/profile-watchlist.png`
- [x] `images/chapter5/ai-limit.png`
- [x] `images/chapter5/localization-en-usd.png`
- [x] `images/chapter5/localization-vi-vnd.png`
- [ ] `images/chapter5/alert-history.png`
- [ ] `images/chapter5/github-actions-ci.png`
- [ ] `images/chapter5/render-deployment.png`
