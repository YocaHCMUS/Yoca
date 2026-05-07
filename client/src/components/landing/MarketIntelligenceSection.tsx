import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LANDING_ACCENT, SECTION_PADDING_Y, grid12Shell } from "./tokens";

type TimeRange = "24H" | "7D" | "1M" | "1Y";

const RANGES: TimeRange[] = ["24H", "7D", "1M", "1Y"];

interface RangeData {
  prices: number[];
  xLabels: string[];
  changePercent: string;
  positive: boolean;
}

const RANGE_DATA: Record<TimeRange, RangeData> = {
  "24H": {
    prices: [
      139.2, 138.8, 139.1, 139.5, 140.1, 139.8, 140.3, 140.5, 141.2, 140.8,
      141.0, 141.5, 142.0, 141.3, 141.6, 141.8, 142.5, 143.0, 142.2, 141.8,
      142.1, 142.5, 143.2, 142.5,
    ],
    xLabels: ["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM"],
    changePercent: "+2.37%",
    positive: true,
  },
  "7D": {
    prices: [
      128.5, 129.2, 130.2, 129.8, 131.0, 132.5, 131.8, 133.0, 134.2, 133.5,
      135.0, 136.0, 135.2, 136.5, 137.8, 136.5, 138.0, 139.5, 138.2, 140.0,
      141.0, 142.5,
    ],
    xLabels: ["Apr 12", "Apr 14", "Apr 16", "Apr 18"],
    changePercent: "+10.89%",
    positive: true,
  },
  "1M": {
    prices: [
      155.0, 152.5, 150.2, 148.5, 146.0, 145.0, 142.8, 140.5, 138.5, 136.0,
      133.5, 130.2, 128.5, 126.0, 125.0, 123.0, 120.5, 118.0, 120.5, 123.0,
      125.5, 128.0, 130.2, 133.5, 136.0, 138.5, 140.0, 142.5,
    ],
    xLabels: ["Mar 19", "Mar 26", "Apr 2", "Apr 9", "Apr 16"],
    changePercent: "-8.06%",
    positive: false,
  },
  "1Y": {
    prices: [
      22.5, 25.0, 28.0, 32.5, 35.5, 38.0, 42.0, 45.5, 48.5, 52.0, 55.0,
      58.0, 62.5, 58.0, 55.5, 60.0, 65.5, 70.0, 72.0, 78.5, 82.0, 85.0,
      88.0, 92.5, 95.5, 100.0, 105.0, 108.0, 112.5, 115.5, 118.0, 122.0,
      128.5, 132.0, 135.0, 138.5, 142.5,
    ],
    xLabels: ["May '25", "Aug '25", "Nov '25", "Feb '26"],
    changePercent: "+533.33%",
    positive: true,
  },
};

const CURRENT_PRICE = "$142.50";

const MARKET_STATS = [
  { label: "Market Cap", value: "$67.80B" },
  { label: "24h Volume", value: "$2.14B" },
  { label: "Circulating Supply", value: "475.2M SOL" },
];

/* Carbon white-theme palette for dashboard-style consistency */
const carbon = {
  bg: "#ffffff",
  layer01: "#f4f4f4",
  borderSubtle: "#e0e0e0",
  textPrimary: "#161616",
  textSecondary: "#525252",
  textHelper: "#6f6f6f",
  positive: "#16a34a",
  negative: "#dc2626",
} as const;

const CHART_W = 580;
const CHART_H = 240;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;

function buildPaths(prices: number[]) {
  const n = prices.length;
  if (n < 2) return { line: "", area: "" };

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const stepX = CHART_W / (n - 1);

  const coords = prices.map((p, i) => ({
    x: i * stepX,
    y: PAD_TOP + (1 - (p - min) / range) * plotH,
  }));

  let line = `M ${coords[0].x},${coords[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const cpx = (coords[i].x + coords[i + 1].x) / 2;
    line += ` C ${cpx},${coords[i].y} ${cpx},${coords[i + 1].y} ${coords[i + 1].x},${coords[i + 1].y}`;
  }

  const areaBottom = CHART_H - PAD_BOTTOM;
  const area = `${line} L ${coords[n - 1].x},${areaBottom} L ${coords[0].x},${areaBottom} Z`;

  return { line, area };
}

export function MarketIntelligenceSection() {
  const [activeRange, setActiveRange] = useState<TimeRange>("7D");
  const data = RANGE_DATA[activeRange];
  const paths = useMemo(() => buildPaths(data.prices), [data.prices]);

  const lineColor = data.positive ? carbon.positive : carbon.negative;
  const areaStart = data.positive
    ? "rgba(22,163,74,0.25)"
    : "rgba(220,38,38,0.25)";
  const areaEnd = data.positive
    ? "rgba(22,163,74,0.02)"
    : "rgba(220,38,38,0.02)";
  const gradId = `mi-area-${activeRange}`;

  const gridLines = [0.25, 0.5, 0.75].map(
    (f) => PAD_TOP + f * (CHART_H - PAD_TOP - PAD_BOTTOM),
  );

  return (
    <section
      id="market-intelligence"
      style={{
        paddingTop: SECTION_PADDING_Y,
        paddingBottom: SECTION_PADDING_Y,
      }}
    >
      <div style={grid12Shell}>
        <div
          style={{
            gridColumn: "1 / -1",
            marginBottom: "2.5rem",
            textAlign: "center",
          }}
        >
          <p
            className="text-sm font-semibold uppercase tracking-[0.22em]"
            style={{ color: LANDING_ACCENT }}
          >
            Market Intelligence
          </p>
          <h2
            className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl"
            style={{ lineHeight: 1.2 }}
          >
            See the market the way professionals do.
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            gridColumn: "1 / -1",
            borderRadius: 8,
            overflow: "hidden",
            background: carbon.bg,
            border: `1px solid ${carbon.borderSubtle}`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          }}
        >
          {/* ── Header bar ── */}
          <div
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            style={{
              padding: "16px 24px",
              borderBottom: `1px solid ${carbon.borderSubtle}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #9945FF, #14F195)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}
                >
                  S
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: carbon.textPrimary,
                    }}
                  >
                    SOL / USD
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: data.positive ? "#dcfce7" : "#fee2e2",
                      color: data.positive ? carbon.positive : carbon.negative,
                    }}
                  >
                    {data.changePercent}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: carbon.textPrimary,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.2,
                  }}
                >
                  {CURRENT_PRICE}
                </span>
              </div>
            </div>

            {/* Time range tabs */}
            <div
              className="flex items-center"
              style={{
                background: carbon.layer01,
                borderRadius: 6,
                padding: 3,
                gap: 2,
              }}
            >
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRange(r)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: activeRange === r ? 600 : 500,
                    color:
                      activeRange === r
                        ? carbon.textPrimary
                        : carbon.textHelper,
                    background: activeRange === r ? carbon.bg : "transparent",
                    boxShadow:
                      activeRange === r
                        ? "0 1px 3px rgba(0,0,0,0.08)"
                        : "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* ── Body: chart + stats ── */}
          <div className="flex flex-col md:flex-row">
            {/* Chart */}
            <div style={{ flex: 1, padding: "20px 24px 16px" }}>
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="h-auto w-full"
                style={{ display: "block" }}
              >
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={areaStart} />
                    <stop offset="100%" stopColor={areaEnd} />
                  </linearGradient>
                </defs>

                {gridLines.map((y) => (
                  <line
                    key={y}
                    x1={0}
                    y1={y}
                    x2={CHART_W}
                    y2={y}
                    stroke={carbon.borderSubtle}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                ))}

                <path d={paths.area} fill={`url(#${gradId})`} />

                <path
                  d={paths.line}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {data.xLabels.map((label, i) => {
                  const x =
                    (i / (data.xLabels.length - 1)) * CHART_W;
                  return (
                    <text
                      key={label}
                      x={x}
                      y={CHART_H - 6}
                      textAnchor={
                        i === 0
                          ? "start"
                          : i === data.xLabels.length - 1
                            ? "end"
                            : "middle"
                      }
                      fill={carbon.textHelper}
                      fontSize="11"
                      fontFamily="'Inter', sans-serif"
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Stats sidebar */}
            <div
              className="landing-mi-stats"
              style={{ padding: 24, display: "flex", flexDirection: "column" }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: carbon.textHelper,
                  marginBottom: 20,
                }}
              >
                Market Stats
              </p>
              {MARKET_STATS.map((stat, i) => (
                <div
                  key={stat.label}
                  style={{
                    paddingTop: i > 0 ? 16 : 0,
                    paddingBottom: 16,
                    borderBottom:
                      i < MARKET_STATS.length - 1
                        ? `1px solid ${carbon.layer01}`
                        : "none",
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: carbon.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    {stat.label}
                  </p>
                  <p
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: carbon.textPrimary,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
