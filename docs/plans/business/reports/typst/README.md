# Yoca business-model report — Typst

Bản báo cáo dành cho giảng viên, được biên soạn từ business-model developer handbook, benchmark journey và calculator hiện tại. Báo cáo đọc dữ liệu biểu đồ từ `../../slides/data/scenarios.json` để slide và report dùng chung một nguồn số liệu trình bày.

## Cấu trúc

- `main.typ`: nội dung và bố cục báo cáo.
- `theme.typ`: khổ A4, font, heading, header/footer và màu Carbon.
- `components.typ`: bảng, callout, metric và biểu đồ tái sử dụng.
- `bibliography.bib`: nguồn giá và quota công khai.
- `build/`: PDF và ảnh preview sau khi compile.

Bảng thuật ngữ nằm trước tài liệu tham khảo và chỉ bao gồm các khái niệm xuất hiện trực tiếp trong báo cáo.

Donut chart sử dụng `CeTZ 0.5.2` và `CeTZ-Plot 0.1.4`; stacked bar tài chính dùng grid/shape native của Typst để giữ hai phần cùng chiều cao. Typst tải package từ Universe trong lần compile đầu tiên.

```sh
typst compile docs/plans/business/reports/typst/main.typ \
  docs/plans/business/reports/typst/build/yoca-business-model-report.pdf \
  --root .

typst compile docs/plans/business/reports/typst/main.typ \
  "docs/plans/business/reports/typst/build/page-{0p}.png" \
  --root . \
  --format png \
  --ppi 130
```

Sau khi calculator hoặc benchmark thay đổi, cập nhật `slides/data/scenarios.json`, kiểm tra lại các bảng số tĩnh trong `main.typ`, rồi compile PDF và toàn bộ ảnh preview để phát hiện overflow.
