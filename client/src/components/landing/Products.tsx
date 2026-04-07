import { motion } from "framer-motion";
import { ArrowUpRight, Database, GitBranch, Plug, Share2 } from "lucide-react";
import { Link } from "react-router";
import {
  LANDING_ACCENT,
  LANDING_ACCENT_GLOW,
  LANDING_ACCENT_MUTED,
  SECTION_PADDING_Y,
  cardSurface,
  grid12Shell,
} from "./tokens";

const products = [
  {
    tag: "Data Hub",
    title: "Analyze, collaborate and build",
    description:
      "Query wallet and token metrics in one workspace. Share dashboards with your team and iterate without leaving the browser.",
    icon: Database,
    href: "/market",
    highlight: false,
  },
  {
    tag: "APIs & Connectors",
    title: "Access data from any environment",
    description:
      "Pull normalized onchain metrics into your own stack. REST-friendly patterns that fit how you already ship software.",
    icon: Plug,
    href: "/tokens",
    highlight: false,
  },
  {
    tag: "Datashare",
    title: "Bring data to your warehouse",
    description:
      "Export curated datasets to the warehouse you already trust. Keep analysts and engineers on the same numbers.",
    icon: Share2,
    href: "/market",
    highlight: false,
  },
  {
    tag: "New",
    title: "dbt-ready transforms",
    description:
      "Model blockchain events with the same dbt workflows you use elsewhere. Version control meets onchain truth.",
    icon: GitBranch,
    href: "/market",
    highlight: true,
  },
] as const;

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export function LandingProducts() {
  return (
    <section
      id="products"
      style={{
        paddingTop: SECTION_PADDING_Y,
        paddingBottom: SECTION_PADDING_Y,
        scrollMarginTop: "5rem",
      }}
    >
      <div style={grid12Shell} className="landing-product-grid">
        <div style={{ gridColumn: "1 / -1", marginBottom: "3rem" }}>
          <p
            className="text-center text-sm font-semibold uppercase tracking-[0.22em]"
            style={{ color: LANDING_ACCENT }}
          >
            Yoca
          </p>
          <h2
            className="mx-auto mt-4 max-w-3xl text-center text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl"
            style={{ lineHeight: 1.2 }}
          >
            The onchain data platform for enterprise teams. Analyze, build, and
            scale.
          </h2>
        </div>

        {products.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.article
              key={p.title}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={cardVariants}
              className="landing-product-card group relative overflow-hidden"
              style={{
                ...cardSurface,
                border: p.highlight
                  ? `1px solid ${LANDING_ACCENT_MUTED}`
                  : cardSurface.border,
                boxShadow: p.highlight
                  ? `0 0 40px -12px ${LANDING_ACCENT_GLOW}`
                  : undefined,
                transition: "border-color 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => {
                if (!p.highlight) {
                  e.currentTarget.style.borderColor = LANDING_ACCENT_MUTED;
                  e.currentTarget.style.boxShadow =
                    `0 0 48px -16px ${LANDING_ACCENT_GLOW}`;
                }
              }}
              onMouseLeave={(e) => {
                if (!p.highlight) {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: p.highlight ? LANDING_ACCENT : "#94a3b8" }}
                >
                  {p.tag}
                </span>
                <Icon
                  className="h-5 w-5 shrink-0 text-[#8b5cf6]"
                  style={{ opacity: 0.8 }}
                  aria-hidden
                />
              </div>
              <h3
                className="mt-5 text-xl font-bold text-[#f8fafc]"
                style={{ lineHeight: 1.3 }}
              >
                {p.title}
              </h3>
              <p className="mt-3 text-[#94a3b8]" style={{ lineHeight: 1.7 }}>
                {p.description}
              </p>
              <Link
                to={p.href}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: LANDING_ACCENT, textDecoration: "none" }}
              >
                Learn more
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
