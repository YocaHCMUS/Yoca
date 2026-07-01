import { useLocalization, type TranslateFunction } from "@/contexts/LocalizationContext";
import { SECTION_PADDING_Y, grid12Shell } from "./tokens";

const stats = [
  { value: "< 0.5s", labelKey: "uiLatency" },
  { value: "Real-time", labelKey: "dataStreaming" },
  { value: "AI-Tagged", labelKey: "walletLabels" },
  { value: "Interactive", labelKey: "transactionGraphs" },
] as const;

type StatLabelKey = (typeof stats)[number]["labelKey"];

function statLabel(tr: TranslateFunction, key: StatLabelKey) {
  switch (key) {
    case "uiLatency":
      return tr("landing.stats.uiLatency");
    case "dataStreaming":
      return tr("landing.stats.dataStreaming");
    case "walletLabels":
      return tr("landing.stats.walletLabels");
    case "transactionGraphs":
      return tr("landing.stats.transactionGraphs");
  }
}

export function LandingStatsBar() {
  const { tr } = useLocalization();

  return (
    <section
      style={{
        paddingTop: SECTION_PADDING_Y,
        paddingBottom: SECTION_PADDING_Y,
            borderTop: "1px solid var(--landing-section-border)",
            borderBottom: "1px solid var(--landing-section-border)",
        background: "var(--landing-surface)",
      }}
    >
      <div style={grid12Shell} className="landing-stats-grid">
        {stats.map((s) => (
          <div
            key={s.labelKey}
            className="landing-stat-cell flex flex-col items-center gap-2 text-center sm:items-start sm:text-left"
          >
            <span
              className="font-mono text-3xl font-bold text-(--landing-foreground) sm:text-4xl"
              style={{ lineHeight: 1.15 }}
            >
              {s.value}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--landing-muted)">
              {statLabel(tr, s.labelKey)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
