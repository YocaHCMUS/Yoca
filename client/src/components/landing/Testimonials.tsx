import { useLocalization, type TranslateFunction } from "@/contexts/LocalizationContext";
import { LANDING_ACCENT, SECTION_PADDING_Y, cardSurface, grid12Shell } from "./tokens";

const quotes = [
  {
    key: "multicoin",
    name: "Kyle Samani",
    role: "Multicoin Capital",
  },
  {
    key: "blockworks",
    name: "Dan Smith",
    role: "Blockworks",
  },
  {
    key: "oneInch",
    name: "Anton Bukov",
    role: "1inch",
  },
] as const;

type QuoteKey = (typeof quotes)[number]["key"];

function quoteText(tr: TranslateFunction, key: QuoteKey) {
  switch (key) {
    case "multicoin":
      return tr("landing.testimonials.items.multicoin.text");
    case "blockworks":
      return tr("landing.testimonials.items.blockworks.text");
    case "oneInch":
      return tr("landing.testimonials.items.oneInch.text");
  }
}

export function LandingTestimonials() {
  const { tr } = useLocalization();

  return (
    <section
      style={{ paddingTop: SECTION_PADDING_Y, paddingBottom: SECTION_PADDING_Y }}
    >
      <div style={grid12Shell}>
        {quotes.map((q) => (
          <blockquote
            key={q.name}
            className="landing-quote-card relative flex flex-col"
            style={{
              ...cardSurface,
              backgroundColor: "var(--landing-panel-bg)",
            }}
          >
            <span
              className="text-5xl leading-none"
              style={{
                opacity: 0.45,
                fontFamily: "Georgia, serif",
                color: LANDING_ACCENT,
              }}
              aria-hidden
            >
              &ldquo;
            </span>
            <p
              className="mt-1 flex-1 text-lg text-(--landing-muted)"
              style={{ lineHeight: 1.7 }}
            >
              {quoteText(tr, q.key)}
            </p>
            <footer
              className="mt-8 pt-6"
              style={{ borderTop: "1px solid var(--landing-card-border)" }}
            >
              <cite className="not-italic">
                <span className="block font-semibold text-(--landing-foreground)">
                  {q.name}
                </span>
                <span className="mt-1 block text-sm text-(--landing-muted)">
                  {q.role}
                </span>
              </cite>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
