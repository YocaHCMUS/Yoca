# Yoca business-model slides

Deck hai trang cho phần Business Model, viết bằng Typst 0.15.1 và Touying 0.7.4. Phần trình bày sử dụng IBM Plex Sans, nền trung tính phân lớp và Carbon Blue làm màu nhấn chính. Slide dùng `breakable: false`, grid hai chiều và vùng nội dung cố định để giữ đúng một trang, phân phối khoảng trắng có chủ ý và phát hiện overflow khi compile.

Các icon SVG trong `assets/` sử dụng hình học từ Carbon Icons, lấy từ package `@carbon/icons-react` đã cài trong workspace.

Cấu trúc source được chia theo vai trò: `theme.typ` chứa design tokens và cấu hình Touying; `components.typ` chứa các thành phần trình bày tái sử dụng; `main.typ` chỉ giữ nội dung và layout của từng slide. Icon xanh dùng trên nền sáng, còn biến thể `-white.svg` dùng trực tiếp trên panel inverse mà không có background hoặc border riêng.

Slide 1 nối hành trình phân tích của người dùng với benchmark cold/warm, mức sử dụng theo đúng đơn vị tính của từng provider và hạn mức của sáu gói hiện tại. Slide 2 trình bày ba kịch bản MAU bằng biểu đồ cột, cơ cấu chi phí bằng donut chart, các breakpoint nâng gói và cấu hình Render/Supabase theo quy mô. Speaker notes của hai trang nằm trực tiếp trong `main.typ`.

`assets/cloud-app.svg` và `assets/datastore.svg` là icon Carbon dùng lần lượt cho Render API và Supabase database. `assets/cost-mix-3k.svg` là phần vòng của donut chart; nhãn, tỷ lệ và màu chú giải lấy từ `data/scenarios.json`.

Máy build cần cài IBM Plex Sans. Có thể kiểm tra bằng `typst fonts | rg "^IBM Plex Sans"`; mã nguồn vẫn khai báo Noto Sans và Liberation Sans làm font dự phòng.

```sh
typst compile docs/plans/business/slides/main.typ \
  docs/plans/business/slides/build/business-model-slides.pdf \
  --root .

typst compile docs/plans/business/slides/main.typ \
  "docs/plans/business/slides/build/business-model-slide-{0p}.png" \
  --root . \
  --format png \
  --ppi 160
```

`data/scenarios.json` chứa benchmark cold/warm, ba kịch bản MAU và cơ cấu chi phí được hiển thị trên slide. Số liệu hiện nối với `benchmark-results/COLD_WARM_RESULT_2026-07-19.md`, `benchmark-results/JOURNEY_COST_INPUTS_2026-07-19.md` và `BUSINESS_SCENARIOS_2026-07-19.md`. Khi benchmark hoặc calculator thay đổi, cần đồng bộ file JSON trước khi build lại.

Các khoảng cách và kích thước component được chỉnh trong `components.typ`. Khoảng cách giữa ba khối ở cột phải slide 2 nằm tại `row-gutter` của grid tương ứng trong `main.typ`; thay đổi các giá trị này nên được kiểm tra lại bằng bản PNG để phát hiện clipping sớm.
