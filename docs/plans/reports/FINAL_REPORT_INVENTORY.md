# Final report inventory — Batch 0

Tài liệu nội bộ ghi lại trạng thái kỹ thuật trước khi tái cấu trúc. Không đưa vào báo cáo.

## Entry points và cấu trúc hiện tại

- Entry point bản cuối: `docs/reports/final_report/main.tex`.
- Bibliography đang dùng: `References/references.bib` qua `biblatex`; backend hiện rơi về BibTeX.
- Nội dung chính hiện gồm 5 chapter: `Chapter1` đến `Chapter5`.
- Phần database được include từ `Chapter3/database/database.tex`, sau đó tách thành overview, ERD, core tables và cache/integrity.
- `proposal.tex`, `Chapter2/Plans.tex`, các appendix mẫu và các file bibliography khác không thuộc luồng nội dung chính hiện tại.
- `main.pdf` đang có thay đổi sẵn trong worktree; pipeline mới mặc định build sang `/tmp/yoca-final-report-build` để không ghi đè.

## Hình và sơ đồ hiện có

- Chương 2 có logo Arkham, Birdeye, CoinGecko, Dune và Nansen.
- Chương 3 có use-case tổng quát, guest use-case, registered-user use-case và ảnh kiến trúc hiện tại.
- Database có 8 Mermaid/PDF: identity-payment, alert-history, token-market, token-content, wallet-analytics, wallet-portfolio-balance, wallet-history và enhanced-transaction-detail.
- Tỷ lệ PDF ERD không đồng nhất; các hình rộng cần được xử lý trong Batch 4.
- `mmdc` global phiên bản 11.16.0 không tự tìm được `chrome-headless-shell`; Chromium hệ thống có tại `/usr/bin/chromium-browser`.
- Đã xác nhận render thành công khi truyền Puppeteer config và chạy Chromium ngoài sandbox Codex.

## Placeholder và phần trống

- Chương 3 còn TODO cho sơ đồ kiến trúc và ba sequence diagram; block hình hiện đang comment.
- Chương 3 có ba subsection kế hoạch kiểm thử chưa có nội dung.
- Database còn hai TODO runtime liên quan alert history/delivery/read state; phải kiểm chứng trạng thái code ở batch tương ứng.
- Chương 4 có ba subsection quy trình tích hợp/triển khai chưa có nội dung.
- Chương 4 có 7 placeholder `% CHÈN HÌNH`: auth, market, search, token, pool, wallet và wash trading.
- Chương 4 có 5 subsection kiểm thử/đánh giá chưa có nội dung nhưng tổng kết đã khẳng định kết quả.

## Compile và layout

- Công cụ có sẵn: `latexmk`, `pdflatex`, `bibtex`, `biber`.
- Build trực tiếp với `-outdir` cần tạo trước cây thư mục con cho `.aux` của các lệnh `\\include`; script Batch 0 xử lý việc này.
- Package `rotating` có sẵn và có thể dùng `sidewaysfigure` cho ERD ngang. `pdflscape` hiện không được tìm thấy trong TeX Live.
- Clean build bằng script đã hoàn tất: PDF A4, 101 trang, xuất vào `/tmp` và không ghi đè `main.pdf` trong repository.
- PDF use-case được tạo ở PDF 1.7 trong khi pdfTeX hỗ trợ tối đa PDF 1.5; hiện là warning, cần cân nhắc chuẩn hóa PDF nếu trở thành lỗi ở bản cuối.
- Log clean build vẫn có duplicate destination cho page 1--2 và các figure/table anchor. Đã bỏ khai báo `hyperref` bị trùng nhưng warning không biến mất; đây là vấn đề counter/anchor của template hoặc aux/include behavior, cần xử lý cùng lúc tái cấu trúc và đánh số hình.
- Hai PDF use-case vẫn phát cảnh báo PDF 1.7 so với giới hạn 1.5 của pdfTeX; không chặn build.
- Trang ngang có thể triển khai bằng `rotating`; chưa sửa preamble hoặc ERD trong Batch 0.

## Reference và rủi ro khi tái cấu trúc

- Kiểm tra tĩnh hiện chưa phát hiện `\\ref` trỏ tới label không tồn tại trong source chính.
- Label trùng được tìm thấy là `Appendix1`, nằm trong các appendix/template ngoài luồng chính; cần tránh include đồng thời mà không đổi label.
- Khi thêm Chương Kiến trúc, phải cập nhật: include order trong `main.tex`, phần bố cục ở Chương 1, câu dẫn/tổng kết Chương 2–5, label chapter và mọi câu nhắc số chương bằng văn bản.
- Di chuyển database/sequence diagram sẽ thay số hình; dùng `\\ref` thay vì ghi số trực tiếp.
- Các logo Chương 2 hiện nằm trong figure nhưng không có caption/label; cần quyết định giữ dạng minh họa trang trí hay chuyển thành figure có reference.

## Pipeline được thêm trong Batch 0

- `puppeteer-config.json`: chỉ định Chromium hệ thống và flags headless sandbox.
- `scripts/render-mermaid.sh [output_dir]`: render toàn bộ `.mmd` trong `Chapter3/diagrams` sang PDF crop theo chart (`--pdfFit`); mặc định ghi cạnh source, có thể truyền thư mục `/tmp` để kiểm tra không ghi đè.
- `scripts/build-report.sh [build_dir]`: tạo cây aux, chạy từ thư mục build với TeX/Bib search path trỏ về source và job name riêng `yoca-final-report`; mặc định ở `/tmp`. Job name riêng tránh đọc nhầm `main.aux/.out/.bbl` cũ đang nằm cạnh source.
- Trong môi trường Codex, render Mermaid có thể cần quyền chạy ngoài sandbox vì Chromium crashpad/socket bị chặn. Trên terminal máy người dùng có thể chạy script trực tiếp.
- Đã chạy script vào `/tmp`: cả 8 Mermaid render thành công và giữ đúng kích thước crop như các PDF hiện tại.
