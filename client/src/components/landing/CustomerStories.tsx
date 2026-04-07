import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { LANDING_ACCENT, SECTION_PADDING_Y, cardSurface, grid12Shell } from "./tokens";

const stories = [
  {
    org: "Base",
    title: "How teams run onchain data transformations at scale with Yoca",
    initials: "B",
  },
  {
    org: "Blockworks",
    title: "Powering institutional crypto research with unified metrics",
    initials: "BW",
  },
  {
    org: "OP Labs",
    title: "Ecosystem growth and transparency backed by live dashboards",
    initials: "OP",
  },
  {
    org: "1inch",
    title: "Making execution and liquidity data transparent and accessible",
    initials: "1",
  },
] as const;

export function LandingCustomerStories() {
  return (
    <section
      id="stories"
      style={{
        paddingTop: SECTION_PADDING_Y,
        paddingBottom: SECTION_PADDING_Y,
        scrollMarginTop: "5rem",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={grid12Shell}>
        <div
          className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
          style={{ gridColumn: "1 / -1", marginBottom: "3rem" }}
        >
          <div>
            <h2
              className="text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl"
              style={{ lineHeight: 1.2 }}
            >
              Customer stories
            </h2>
            <p
              className="mt-4 max-w-xl text-[#94a3b8]"
              style={{ lineHeight: 1.65 }}
            >
              Read how teams use Yoca to turn raw chain activity into decisions
              their whole org can trust.
            </p>
          </div>
          <Link
            to="/market"
            className="shrink-0 text-sm font-semibold"
            style={{ color: LANDING_ACCENT, textDecoration: "none" }}
          >
            See more
          </Link>
        </div>

        {stories.map((s) => (
          <article
            key={s.org}
            className="landing-story-card group flex flex-col"
            style={{
              ...cardSurface,
              transition: "border-color 0.25s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")
            }
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl font-mono text-sm font-bold"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: LANDING_ACCENT,
              }}
            >
              {s.initials}
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-[#94a3b8]">
              {s.org}
            </p>
            <h3
              className="mt-2 flex-1 text-base font-semibold text-[#f8fafc]"
              style={{ lineHeight: 1.45 }}
            >
              {s.title}
            </h3>
            <span
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: LANDING_ACCENT }}
            >
              Read story
              <ArrowRight className="h-4 w-4" />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
