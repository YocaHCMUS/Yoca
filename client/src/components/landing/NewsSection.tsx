import { motion } from "framer-motion";
import { Link } from "react-router";
import { LANDING_ACCENT, SECTION_PADDING_Y, cardSurface, grid12Shell } from "./tokens";

const posts = [
  {
    title: "Ship wallet reports without maintaining brittle pipelines",
    excerpt:
      "Export snapshots your analysts can trust \u2014 same definitions as the live app, fewer spreadsheet forks.",
    date: "Apr 3, 2026",
    href: "/market",
  },
  {
    title: "Tempo is live: instant settlement metrics in Yoca",
    excerpt:
      "Track payments-first chain activity alongside Solana and EVM metrics from one navigation model.",
    date: "Apr 3, 2026",
    href: "/market",
  },
  {
    title: "Cardano joins the catalog",
    excerpt:
      "Research-grade staking and delegation signals now sit next to the wallets you already watch.",
    date: "Apr 2, 2026",
    href: "/market",
  },
] as const;

export function LandingNewsSection() {
  return (
    <section
      style={{ paddingTop: SECTION_PADDING_Y, paddingBottom: SECTION_PADDING_Y }}
    >
      <div style={grid12Shell}>
        <header style={{ gridColumn: "1 / -1", marginBottom: "3rem" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-(--landing-muted)">
            Latest news
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-(--landing-foreground) sm:text-4xl"
            style={{ lineHeight: 1.2 }}
          >
            Hear the latest
          </h2>
        </header>

        {posts.map((post, i) => (
          <motion.article
            key={post.title}
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
                News &middot; {post.date}
              </time>
              <h3
                className="mt-4 text-lg font-semibold text-(--landing-foreground)"
                style={{ lineHeight: 1.35 }}
              >
                {post.title}
              </h3>
              <p
                className="mt-3 flex-1 text-sm text-(--landing-muted)"
                style={{ lineHeight: 1.65 }}
              >
                {post.excerpt}
              </p>
              <span
                className="mt-5 text-sm font-semibold"
                style={{ color: LANDING_ACCENT }}
              >
                Read post &rarr;
              </span>
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
