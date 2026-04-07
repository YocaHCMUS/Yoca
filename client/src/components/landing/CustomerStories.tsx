import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

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
      className="py-24 sm:py-32"
      style={{
        scrollMarginTop: "6rem",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
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
            className="shrink-0 text-sm font-semibold text-[#f97316]"
            style={{ transition: "opacity 0.15s ease" }}
          >
            See more
          </Link>
        </div>

        <div
          className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {stories.map((s) => (
            <article
              key={s.org}
              className="group flex flex-col rounded-2xl p-7"
              style={{
                backgroundColor: "#111118",
                border: "1px solid rgba(255,255,255,0.06)",
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
                className="flex h-12 w-12 items-center justify-center rounded-xl font-mono text-sm font-bold text-[#f97316]"
                style={{ background: "rgba(255,255,255,0.06)" }}
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
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#f97316]">
                Read story
                <ArrowRight
                  className="h-4 w-4"
                  style={{ transition: "transform 0.2s ease" }}
                />
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
