import { SECTION_PADDING_Y, grid12Shell } from "./tokens";

const stats = [
  { value: "< 0.5s", label: "UI Latency" },
  { value: "Real-time", label: "Data Streaming" },
  { value: "AI-Tagged", label: "Wallet Labels" },
  { value: "Interactive", label: "Transaction Graphs" },
] as const;

export function LandingStatsBar() {
  return (
    <section
      style={{
        paddingTop: SECTION_PADDING_Y,
        paddingBottom: SECTION_PADDING_Y,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(17,17,24,0.55)",
      }}
    >
      <div style={grid12Shell} className="landing-stats-grid">
        {stats.map((s) => (
          <div
            key={s.label}
            className="landing-stat-cell flex flex-col items-center gap-2 text-center sm:items-start sm:text-left"
          >
            <span
              className="font-mono text-3xl font-bold text-[#f8fafc] sm:text-4xl"
              style={{ lineHeight: 1.15 }}
            >
              {s.value}
            </span>
            <span
              className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]"
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
