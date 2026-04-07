import { LANDING_ACCENT, SECTION_PADDING_Y, cardSurface, grid12Shell } from "./tokens";

const quotes = [
  {
    text: "If it\u2019s not in your dashboards, it\u2019s not real \u2014 Yoca gave us one source of truth for wallet and token flows.",
    name: "Kyle Samani",
    role: "Multicoin Capital",
  },
  {
    text: "The most practical onchain dataset we\u2019ve plugged into research workflows \u2014 fast queries, fewer surprises.",
    name: "Dan Smith",
    role: "Blockworks",
  },
  {
    text: "Without a clear view of chain activity, your product is blind. Yoca fixed that for our team in days.",
    name: "Anton Bukov",
    role: "1inch",
  },
] as const;

export function LandingTestimonials() {
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
              backgroundColor: "rgba(17,17,24,0.85)",
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
              className="mt-1 flex-1 text-lg text-[#e2e8f0]"
              style={{ lineHeight: 1.7 }}
            >
              {q.text}
            </p>
            <footer
              className="mt-8 pt-6"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <cite className="not-italic">
                <span className="block font-semibold text-[#f8fafc]">
                  {q.name}
                </span>
                <span className="mt-1 block text-sm text-[#94a3b8]">
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
