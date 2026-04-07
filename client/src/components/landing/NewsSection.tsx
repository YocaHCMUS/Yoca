import { motion } from "framer-motion";
import { Link } from "react-router";

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
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#94a3b8]">
          Latest news
        </p>
        <h2
          className="mt-3 text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl"
          style={{ lineHeight: 1.2 }}
        >
          Hear the latest
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {posts.map((post, i) => (
            <motion.article
              key={post.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.07, duration: 0.45 }}
            >
              <Link
                to={post.href}
                className="group flex h-full flex-col rounded-2xl p-7"
                style={{
                  backgroundColor: "#111118",
                  border: "1px solid rgba(255,255,255,0.06)",
                  transition:
                    "transform 0.3s ease, border-color 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }}
              >
                <time
                  dateTime={post.date}
                  className="text-xs font-semibold uppercase tracking-wider text-[#f97316]"
                >
                  News &middot; {post.date}
                </time>
                <h3
                  className="mt-4 text-lg font-semibold text-[#f8fafc]"
                  style={{ lineHeight: 1.35 }}
                >
                  {post.title}
                </h3>
                <p
                  className="mt-3 flex-1 text-sm text-[#94a3b8]"
                  style={{ lineHeight: 1.65 }}
                >
                  {post.excerpt}
                </p>
                <span className="mt-5 text-sm font-semibold text-[#8b5cf6]">
                  Read post &rarr;
                </span>
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
