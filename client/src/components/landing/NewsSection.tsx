import { motion } from "framer-motion";
import { Link } from "react-router";
import { useLocalization, type TranslateFunction } from "@/contexts/LocalizationContext";
import { LANDING_ACCENT, SECTION_PADDING_Y, cardSurface, grid12Shell } from "./tokens";

const posts = [
  {
    key: "walletReports",
    date: "Apr 3, 2026",
    href: "/market",
  },
  {
    key: "tempo",
    date: "Apr 3, 2026",
    href: "/market",
  },
  {
    key: "cardano",
    date: "Apr 2, 2026",
    href: "/market",
  },
] as const;

type NewsPostKey = (typeof posts)[number]["key"];

function newsTitle(tr: TranslateFunction, key: NewsPostKey) {
  switch (key) {
    case "walletReports":
      return tr("landing.news.items.walletReports.title");
    case "tempo":
      return tr("landing.news.items.tempo.title");
    case "cardano":
      return tr("landing.news.items.cardano.title");
  }
}

function newsExcerpt(tr: TranslateFunction, key: NewsPostKey) {
  switch (key) {
    case "walletReports":
      return tr("landing.news.items.walletReports.excerpt");
    case "tempo":
      return tr("landing.news.items.tempo.excerpt");
    case "cardano":
      return tr("landing.news.items.cardano.excerpt");
  }
}

export function LandingNewsSection() {
  const { tr } = useLocalization();

  return (
    <section
      style={{ paddingTop: SECTION_PADDING_Y, paddingBottom: SECTION_PADDING_Y }}
    >
      <div style={grid12Shell}>
        <header style={{ gridColumn: "1 / -1", marginBottom: "3rem" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-(--landing-muted)">
            {tr("landing.news.eyebrow")}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-(--landing-foreground) sm:text-4xl"
            style={{ lineHeight: 1.2 }}
          >
            {tr("landing.news.title")}
          </h2>
        </header>

        {posts.map((post, i) => (
          <motion.article
            key={post.key}
            className="landing-news-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.07, duration: 0.45 }}
          >
            <Link
              to={post.href}
              className="group flex h-full flex-col"
              style={{
                ...cardSurface,
                textDecoration: "none",
                transition: "transform 0.3s ease, border-color 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "var(--landing-card-border)";
              }}
            >
              <time
                dateTime={post.date}
                className="font-mono text-xs font-semibold uppercase tracking-wider"
                style={{ color: LANDING_ACCENT }}
              >
                {tr("landing.news.label")} &middot; {post.date}
              </time>
              <h3
                className="mt-4 text-lg font-semibold text-(--landing-foreground)"
                style={{ lineHeight: 1.35 }}
              >
                {newsTitle(tr, post.key)}
              </h3>
              <p
                className="mt-3 flex-1 text-sm text-(--landing-muted)"
                style={{ lineHeight: 1.65 }}
              >
                {newsExcerpt(tr, post.key)}
              </p>
              <span
                className="mt-5 text-sm font-semibold"
                style={{ color: LANDING_ACCENT }}
              >
                {tr("landing.news.readPost")} &rarr;
              </span>
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
