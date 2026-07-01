import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useLocalization, type TranslateFunction } from "@/contexts/LocalizationContext";
import { LANDING_ACCENT, SECTION_PADDING_Y, cardSurface, grid12Shell } from "./tokens";

const stories = [
  {
    key: "base",
    org: "Base",
    initials: "B",
  },
  {
    key: "blockworks",
    org: "Blockworks",
    initials: "BW",
  },
  {
    key: "opLabs",
    org: "OP Labs",
    initials: "OP",
  },
  {
    key: "oneInch",
    org: "1inch",
    initials: "1",
  },
] as const;

type StoryKey = (typeof stories)[number]["key"];

function storyTitle(tr: TranslateFunction, key: StoryKey) {
  switch (key) {
    case "base":
      return tr("landing.customerStories.items.base.title");
    case "blockworks":
      return tr("landing.customerStories.items.blockworks.title");
    case "opLabs":
      return tr("landing.customerStories.items.opLabs.title");
    case "oneInch":
      return tr("landing.customerStories.items.oneInch.title");
  }
}

export function LandingCustomerStories() {
  const { tr } = useLocalization();

  return (
    <section
      id="stories"
      style={{
        paddingTop: SECTION_PADDING_Y,
        paddingBottom: SECTION_PADDING_Y,
        scrollMarginTop: "5rem",
        borderTop: "1px solid var(--landing-section-border)",
      }}
    >
      <div style={grid12Shell}>
        <div
          className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
          style={{ gridColumn: "1 / -1", marginBottom: "3rem" }}
        >
          <div>
            <h2
              className="text-3xl font-bold tracking-tight text-(--landing-foreground) sm:text-4xl"
              style={{ lineHeight: 1.2 }}
            >
              {tr("landing.customerStories.title")}
            </h2>
            <p
              className="mt-4 max-w-xl text-(--landing-muted)"
              style={{ lineHeight: 1.65 }}
            >
              {tr("landing.customerStories.subtitle")}
            </p>
          </div>
          <Link
            to="/market"
            className="shrink-0 text-sm font-semibold"
            style={{ color: LANDING_ACCENT, textDecoration: "none" }}
          >
            {tr("landing.customerStories.seeMore")}
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
              (e.currentTarget.style.borderColor = "var(--landing-card-border)")
            }
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl font-mono text-sm font-bold"
              style={{
                background: "var(--landing-surface)",
                color: LANDING_ACCENT,
              }}
            >
              {s.initials}
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-(--landing-muted)">
              {s.org}
            </p>
            <h3
              className="mt-2 flex-1 text-base font-semibold text-(--landing-foreground)"
              style={{ lineHeight: 1.45 }}
            >
              {storyTitle(tr, s.key)}
            </h3>
            <span
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: LANDING_ACCENT }}
            >
              {tr("landing.customerStories.readStory")}
              <ArrowRight className="h-4 w-4" />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
