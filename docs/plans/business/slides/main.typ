#import "@preview/touying:0.7.4": slide, speaker-note
#import "theme.typ": *
#import "components.typ": *

#let data = json("data/scenarios.json")

#show: deck-theme

#set text(font: ("IBM Plex Sans", "Noto Sans", "Liberation Sans"), size: 14.5pt, fill: ink)
#set par(leading: 0.68em)

#slide(title: slide-title([Từ sản phẩm đến chi phí kỹ thuật]))[
  #full-grid(
    rows: (54pt, 1fr, auto),
    row-gutter: 11pt,
    [
      #grid(
        columns: (1.05fr, 0.95fr), gutter: 26pt, align: horizon,
        compact-product-flow(),
        pricing-strip(),
      )
    ],
    [
      #grid(
        columns: (1.02fr, 0.98fr), gutter: 18pt,
        [
          #eyebrow([Cold và warm · benchmark cục bộ 19/7])
          #v(7pt)
          #grid(
            rows: (auto, auto, auto), row-gutter: 5pt,
            ..data.benchmarks.map(item => latency-row(item)),
          )
          #v(7pt)
          #grid(
            columns: (auto, auto, auto, auto), gutter: 5pt, align: horizon,
            rect(width: 10pt, height: 7pt, radius: 0pt, fill: background-inverse),
            text(size: 7pt, fill: muted)[Cold refresh],
            rect(width: 10pt, height: 7pt, radius: 0pt, fill: accent),
            text(size: 7pt, fill: muted)[Warm database],
          )
        ],
        journey-cost-matrix(data.providerQuotas),
      )
    ],
    takeaway([Database-first giúp lượt xem lặp lại dùng dữ liệu đã lưu và giảm đáng kể quota provider.]),
  )

  #speaker-note[
    Yoca không lấy page view nhân thẳng với giá API. Nhóm đo theo hành trình: cold refresh phát sinh tổ hợp credit hoặc CU, còn warm repeat đọc dữ liệu đã chuẩn hóa trong database. Trong ba hành trình lõi, warm repeat không tạo thêm provider call và giảm latency từ khoảng 7 đến 38 lần. Đây là đầu vào kỹ thuật cho mô hình tài chính, không phải một con số ước lượng độc lập.
  ]
]

#slide(title: slide-title([Kịch bản tài chính và khả năng mở rộng]))[
  #full-grid(
    rows: (1fr, auto),
    [
      #grid(
        columns: (1.17fr, 0.83fr), gutter: 18pt,
        [
          #eyebrow([Cơ cấu dòng tiền từng mốc · doanh thu = 100%])
          #v(8pt)
          #grid(
            columns: (1fr, 1fr, 1fr), gutter: 16pt, align: bottom,
            ..data.scenarios.map(item => finance-group(item)),
          )
          #v(7pt)
          #grid(
            columns: (auto, auto, auto, auto, auto, auto), gutter: 5pt, align: horizon,
            rect(width: 8pt, height: 8pt, radius: 0pt, fill: background-inverse),
            text(size: 7pt, fill: muted)[Doanh thu],
            rect(width: 8pt, height: 8pt, radius: 0pt, fill: cost-color),
            text(size: 7pt, fill: muted)[Chi phí trực tiếp],
            rect(width: 8pt, height: 8pt, radius: 0pt, fill: accent),
            text(size: 7pt, fill: muted)[Số dư đóng góp],
          )
          #v(10pt)
          #block(width: 100%, inset: (x: 11pt, y: 8pt), radius: panel-radius, fill: layer-1)[
            #grid(
              columns: (auto, 1fr), gutter: 10pt, align: horizon,
              text(size: 21pt, weight: "bold", fill: accent)[2%],
              [
                #text(size: 8.5pt, weight: "semibold")[người dùng trả phí]
                #linebreak()
                #text(size: 7pt, fill: muted)[8 phiên hoạt động / MAU / tháng]
              ],
            )
          ]
        ],
        [
          #grid(
            rows: (auto, auto, auto), row-gutter: 12pt,
            cost-donut(data.costMix3k),
            breakpoint-track(),
            infrastructure-scale(),
          )
        ],
      )
    ],
    takeaway([Rà soát ở 70% quota · chuẩn bị nâng ở 85% · giữ tối thiểu 20% headroom.]),
  )

  #speaker-note[
    Với giả định hai phần trăm người dùng trả phí và tám phiên hoạt động mỗi tháng, số dư đóng góp lần lượt khoảng 200, 2.282 và 27.266 đô la tại ba mốc quy mô. Ở mốc 3.000 MAU, AI và tìm kiếm chiếm khoảng một nửa chi phí trực tiếp, còn blockchain data provider chiếm khoảng một phần ba. Các breakpoint là tín hiệu lập ngân sách; quyết định nâng gói còn dựa trên RPS, lỗi 429, latency và phần quota dự phòng.
  ]
]
