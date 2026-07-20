#import "theme.typ": *

#let eyebrow(body) = text(size: 8.5pt, weight: "semibold", fill: accent, tracking: 0.1em, upper(body))

#let takeaway(body) = block(
  width: 100%, inset: (x: 12pt, y: 7pt), radius: panel-radius, fill: panel-gradient,
)[#text(size: 9.5pt, weight: "semibold", fill: text-on-color)[#body]]

#let full-grid(content-height: 348pt, ..args) = block(width: 100%, height: content-height)[#grid(..args)]

#let flow-node(icon, label) = grid(
  columns: (15pt, 1fr), gutter: 5pt, align: horizon,
  image(icon, width: 14pt, height: 14pt, fit: "contain"),
  text(size: 8.5pt, weight: "semibold")[#label],
)

#let compact-product-flow() = block(width: 100%)[
  #eyebrow([Hành trình phân tích của người dùng])
  #v(6pt)
  #grid(
    columns: (1fr, auto, 1fr, auto, 1fr, auto, 1.35fr),
    gutter: 5pt,
    align: horizon,
    flow-node("assets/chart-line.svg", [Market]),
    text(size: 10pt, fill: accent)[→],
    flow-node("assets/currency-dollar.svg", [Token]),
    text(size: 10pt, fill: accent)[→],
    flow-node("assets/wallet.svg", [Wallet]),
    text(size: 10pt, fill: accent)[→],
    flow-node("assets/data-analytics.svg", [Wash Trading & AI]),
  )
]

#let price-chip(name, price, free: false) = block(
  width: 100%, inset: (x: 7pt, y: 5pt), radius: small-radius,
  fill: if free { layer-1 } else { panel-gradient },
)[
  #text(size: 7pt, fill: if free { muted } else { highlight })[#name]
  #h(3pt)
  #text(size: 10pt, weight: "bold", fill: if free { ink } else { white })[#price]
]

#let pricing-strip() = block(width: 100%)[
  #eyebrow([Thuê bao tháng])
  #v(5pt)
  #grid(
    columns: (1fr, 1fr, 1fr, 1fr),
    gutter: 5pt,
    price-chip([Standard], [\$0], free: true),
    price-chip([Lite], [\$39]),
    price-chip([Plus], [\$79]),
    price-chip([Pro], [\$149]),
  )
]

#let latency-row(item) = block(width: 100%)[
  #grid(
    columns: (1fr, auto, auto), gutter: 8pt, align: horizon,
    text(size: 9pt, weight: "semibold")[#item.name],
    text(size: 7.3pt, fill: muted)[#item.pass endpoint],
    block(inset: (x: 5pt, y: 2pt), radius: small-radius, fill: highlight)[
      #text(size: 7.5pt, weight: "semibold", fill: accent)[#item.speedup]
    ],
  )
  #v(4pt)
  #grid(
    columns: (28pt, 1fr, 37pt), gutter: 5pt, align: horizon,
    text(size: 7pt, fill: muted)[Cold],
    align(left, rect(width: item.coldMs / 25440 * 100%, height: 7pt, radius: 0pt, fill: background-inverse)),
    align(right, text(size: 7pt, weight: "semibold")[#item.cold]),
    text(size: 7pt, fill: muted)[Warm],
    align(left, rect(width: item.warmMs / 25440 * 100%, height: 7pt, radius: 0pt, fill: accent)),
    align(right, text(size: 7pt, weight: "semibold", fill: accent)[#item.warm]),
  )
]

#let metric(value) = text(size: 7.5pt, weight: "semibold", fill: accent)[#value]
#let dash = text(size: 7.5pt, fill: border-subtle)[—]

#let provider-header(name, unit) = grid(
  rows: (auto, auto), row-gutter: 4pt,
  text(size: 5.2pt, weight: "semibold", fill: muted)[#name],
  text(size: 4.6pt, fill: muted)[#unit],
)

#let quota-chip(item) = block(
  width: 100%, height: 23pt, inset: (x: 5pt, y: 3pt),
  radius: small-radius, fill: layer-1, clip: true,
)[
  #grid(
    rows: (auto, auto), row-gutter: 6pt,
    text(size: 4.8pt, fill: muted)[#item.name],
    text(size: 5.5pt, weight: "semibold")[#item.quota],
  )
]

#let quota-panel(items) = block(width: 100%)[
  #eyebrow([Hạn mức gói hiện tại])
  #v(2pt)
  #grid(
    columns: (1fr, 1fr, 1fr, 1fr, 1fr, 1fr), rows: (23pt,), gutter: 3pt,
    ..items.map(item => quota-chip(item)),
  )
]

#let journey-cost-matrix(quotas) = block(width: 100%)[
  #eyebrow([Mức sử dụng provider theo tác vụ])
  #v(2pt)
  #block(width: 100%, radius: 0pt, clip: true, stroke: 0.6pt + border-subtle)[
    #grid(
      columns: (1.8fr, 0.65fr, 0.65fr, 0.65fr, 0.65fr, 0.65fr, 0.65fr),
      rows: (24pt, 22pt, 22pt, 22pt, 22pt, 22pt, 22pt),
      gutter: 0pt,
      inset: (x: 4pt, y: 4pt),
      stroke: 0.45pt + border-subtle,
      align: horizon,
      fill: (x, y) => if y == 0 { layer-1 },
      text(size: 6.6pt, weight: "semibold", fill: muted)[TÁC VỤ],
      provider-header([CG], [credits]),
      provider-header([BDS], [CU]),
      provider-header([Mobula], [credits]),
      provider-header([Helius], [credits]),
      provider-header([Zerion], [requests]),
      provider-header([Moralis], [CU]),
      text(size: 6.5pt, weight: "semibold")[Market Radar], metric([17]), metric([135]), dash, dash, dash, dash,
      text(size: 6.5pt, weight: "semibold")[Token Overview], metric([15]), dash, metric([1]), dash, dash, dash,
      text(size: 6.5pt, weight: "semibold")[Wallet Core], dash, dash, metric([21]), metric([100]), dash, dash,
      text(size: 6.5pt, weight: "semibold")[Wallet Activity], dash, dash, metric([1–10]), dash, dash, dash,
      text(size: 6.5pt, weight: "semibold")[Token Chart], dash, dash, dash, dash, metric([1/token]), dash,
      text(size: 6.5pt, weight: "semibold")[Token Metadata], dash, dash, dash, dash, dash, metric([10]),
    )
  ]
  #v(4pt)
  #quota-panel(quotas)
]

#let finance-group(item) = block(width: 100%)[
  #block(width: 100%, height: 118pt)[
    #align(bottom, grid(
      columns: (1fr, 1fr, 1fr), gutter: 7pt, align: bottom,
      [
        #align(center, text(size: 6.5pt, weight: "semibold")[#item.revenue])
        #v(3pt)
        #rect(width: 100%, height: 86pt, radius: 0pt, fill: background-inverse)
      ],
      [
        #align(center, text(size: 6.5pt, weight: "semibold")[#item.directCost])
        #v(3pt)
        #rect(width: 100%, height: item.costRatio / 100 * 86pt, radius: 0pt, fill: cost-color)
      ],
      [
        #align(center, text(size: 6.5pt, weight: "semibold", fill: accent)[#item.contribution])
        #v(3pt)
        #rect(width: 100%, height: item.margin / 100 * 86pt, radius: 0pt, fill: accent)
      ],
    ))
  ]
  #v(4pt)
  #grid(
    columns: (1fr, 1fr, 1fr), gutter: 7pt,
    align(center, text(size: 6.5pt, fill: muted)[Thu]),
    align(center, text(size: 6.5pt, fill: muted)[Chi]),
    align(center, text(size: 6.5pt, fill: muted)[Còn]),
  )
  #v(5pt)
  #align(center)[
    #text(size: 10pt, weight: "bold")[#item.mau MAU]
    #h(4pt)
    #text(size: 8pt, weight: "semibold", fill: accent)[#str(item.margin)\%]
  ]
]

#let cost-legend(color, name, share) = block(width: 100%)[
  #grid(
    columns: (7pt, 1fr, auto), gutter: 5pt, align: horizon,
    rect(width: 7pt, height: 7pt, radius: 0pt, fill: color),
    text(size: 7pt, fill: muted)[#name],
    text(size: 7pt, weight: "semibold")[#share],
  )
  #v(3pt)
]

#let cost-donut(items) = block(width: 100%)[
  #eyebrow([Cơ cấu chi phí · 3.000 MAU])
  #v(1pt)
  #grid(
    columns: (80pt, 1fr), gutter: 10pt, align: horizon,
    box(width: 78pt, height: 78pt)[
      #image("assets/cost-mix-3k.svg", width: 78pt, height: 78pt, fit: "contain")
      #place(center + horizon)[
        #align(center)[
          #text(size: 12pt, weight: "bold")[\$1.483]
          #linebreak()
          #text(size: 6.5pt, fill: muted)[trực tiếp]
        ]
      ]
    ],
    [
      #for item in items {
        cost-legend(rgb(item.color), item.name, item.share)
      }
    ],
  )
]

#let breakpoint(mau, provider, tier) = (
  circle(
    width: 25pt, height: 25pt, fill: layer-1, stroke: 0.6pt + border-subtle,
    align(center + horizon, text(size: 7pt, weight: "bold")[#mau]),
  ),
  align(horizon)[
    #text(size: 7.5pt, weight: "semibold")[#provider]
    #linebreak()
    #text(size: 6.5pt, fill: muted)[→ #tier]
  ],
)

#let breakpoint-track() = block(width: 100%)[
  #eyebrow([Các ngưỡng nâng gói đầu tiên])
  #v(2pt)
  #grid(
    columns: (29pt, 1fr, 29pt, 1fr),
    rows: (auto, auto),
    gutter: 6pt,
    ..breakpoint([150], [Mobula], [Start-up]),
    ..breakpoint([300], [CoinGecko], [Basic]),
    ..breakpoint([1.600], [Mobula], [Growth]),
    ..breakpoint([2.775], [Helius], [Developer]),
  )
]

#let infra-chip(mau, render, supabase) = block(
  width: 100%, height: 44pt, inset: (x: 7pt, y: 5pt),
  radius: small-radius, fill: layer-1, clip: true,
)[
  #text(size: 7.5pt, weight: "bold", fill: accent)[#mau MAU]
  #v(-4pt)
  #grid(
    columns: (1.1fr, 0.9fr), gutter: 1pt, align: horizon,
    grid(
      columns: (9pt, 1fr), gutter: 6pt, align: horizon,
      image("assets/cloud-app.svg", width: 12pt, height: 12pt, fit: "contain"),
      grid(
        rows: (auto, auto), row-gutter: 3pt,
        text(size: 5pt, fill: muted)[Render],
        text(size: 4.5pt, weight: "medium")[#render],
      ),
    ),
    grid(
      columns: (9pt, 1fr), gutter: 6pt, align: horizon,
      image("assets/datastore.svg", width: 12pt, height: 12pt, fit: "contain"),
      grid(
        rows: (auto, auto), row-gutter: 3pt,
        text(size: 5pt, fill: muted)[Supabase],
        text(size: 4.5pt, weight: "medium")[#supabase],
      ),
    ),
  )
]

#let infrastructure-scale() = block(width: 100%)[
  #eyebrow([Hạ tầng Render + Supabase theo quy mô])
  #grid(
    columns: (1fr, 1fr, 1fr), gutter: 6pt,
    infra-chip([300], [Starter], [Free]),
    infra-chip([3.000], [Standard], [Pro Micro]),
    infra-chip([30.000], [2× Standard], [Pro Small]),
  )
]
