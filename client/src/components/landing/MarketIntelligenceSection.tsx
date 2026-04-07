import { LANDING_ACCENT, LANDING_ACCENT_2, SECTION_PADDING_Y, grid12Shell } from "./tokens";

const pricePath =
  "M24 46 C60 38, 94 58, 122 66 C152 74, 184 102, 214 118 C242 132, 274 150, 304 146 C336 142, 364 110, 394 92 C430 70, 466 92, 494 124 C522 158, 552 120, 580 64 C606 24, 634 22, 676 30";

const volumeBars = [
  { x: 28, h: 28, buy: true },
  { x: 62, h: 42, buy: false },
  { x: 96, h: 36, buy: true },
  { x: 130, h: 48, buy: false },
  { x: 164, h: 32, buy: true },
  { x: 198, h: 52, buy: false },
  { x: 232, h: 30, buy: true },
  { x: 266, h: 40, buy: true },
  { x: 300, h: 58, buy: false },
  { x: 334, h: 34, buy: true },
  { x: 368, h: 46, buy: false },
  { x: 402, h: 38, buy: true },
  { x: 436, h: 62, buy: true },
  { x: 470, h: 44, buy: false },
  { x: 504, h: 56, buy: true },
  { x: 538, h: 72, buy: true },
  { x: 572, h: 68, buy: true },
  { x: 606, h: 76, buy: false },
  { x: 640, h: 82, buy: true },
];

export function MarketIntelligenceSection() {
  return (
    <section
      style={{ paddingTop: SECTION_PADDING_Y, paddingBottom: SECTION_PADDING_Y }}
      id="market-intelligence"
    >
      <div style={grid12Shell}>
        <div style={{ gridColumn: "1 / -1" }}>
          <div
            style={{
              borderRadius: 12,
              padding: 32,
              background:
                "linear-gradient(rgba(10,10,15,0.7), rgba(10,10,15,0.7)) padding-box, linear-gradient(130deg, rgba(153,69,255,0.62), rgba(20,241,149,0.62)) border-box",
              border: "1px solid transparent",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow:
                "0 0 34px -18px rgba(153,69,255,0.85), 0 0 24px -16px rgba(20,241,149,0.75)",
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: LANDING_ACCENT_2 }}
                >
                  Market Intelligence
                </p>
                <h3
                  className="mt-2 text-2xl font-bold text-[#f8fafc] sm:text-3xl"
                  style={{ lineHeight: 1.2 }}
                >
                  Solana Price History (24H)
                </h3>
              </div>
              <p
                className="font-mono text-sm text-[#cbd5e1]"
                style={{ letterSpacing: "0.2px" }}
              >
                Last price: $142.50
              </p>
            </div>

            <div className="mt-8 overflow-x-auto">
              <svg viewBox="0 0 700 280" className="h-auto min-w-[680px] w-full">
                <defs>
                  <linearGradient id="solLine" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor={LANDING_ACCENT} />
                    <stop offset="100%" stopColor={LANDING_ACCENT_2} />
                  </linearGradient>
                  <filter id="lineGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {[40, 80, 120, 160, 200].map((y) => (
                  <line
                    key={y}
                    x1={20}
                    y1={y}
                    x2={680}
                    y2={y}
                    stroke="rgba(148,163,184,0.14)"
                    strokeWidth={1}
                  />
                ))}

                <path
                  d={pricePath}
                  fill="none"
                  stroke="url(#solLine)"
                  strokeWidth={4}
                  filter="url(#lineGlow)"
                />

                {volumeBars.map((bar) => (
                  <rect
                    key={bar.x}
                    x={bar.x}
                    y={248 - bar.h}
                    width={18}
                    height={bar.h}
                    rx={2}
                    fill={bar.buy ? "rgba(20,241,149,0.52)" : "rgba(153,69,255,0.52)"}
                  />
                ))}

                <text x="8" y="44" fill="#d1d5db" fontSize="10" fontFamily='"JetBrains Mono", monospace'>
                  $148.00
                </text>
                <text x="8" y="86" fill="#d1d5db" fontSize="10" fontFamily='"JetBrains Mono", monospace'>
                  $145.00
                </text>
                <text x="8" y="128" fill="#d1d5db" fontSize="10" fontFamily='"JetBrains Mono", monospace'>
                  $142.50
                </text>
                <text x="8" y="170" fill="#d1d5db" fontSize="10" fontFamily='"JetBrains Mono", monospace'>
                  $139.00
                </text>

                <text x="30" y="270" fill="#94a3b8" fontSize="10" fontFamily='"JetBrains Mono", monospace'>
                  08:00 UTC
                </text>
                <text x="250" y="270" fill="#94a3b8" fontSize="10" fontFamily='"JetBrains Mono", monospace'>
                  14:00 UTC
                </text>
                <text x="470" y="270" fill="#94a3b8" fontSize="10" fontFamily='"JetBrains Mono", monospace'>
                  20:00 UTC
                </text>
                <text x="620" y="270" fill="#94a3b8" fontSize="10" fontFamily='"JetBrains Mono", monospace'>
                  08:00 UTC
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

