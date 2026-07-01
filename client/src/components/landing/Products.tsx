import { motion } from "framer-motion";
import { ArrowUpRight, Bell, Radar, ScanSearch } from "lucide-react";
import { Link } from "react-router";
import { useLocalization, type TranslateFunction } from "@/contexts/LocalizationContext";
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
    key: "marketExplorer",
    icon: Radar,
    href: "/market",
    highlight: false,
  },
  {
    key: "portfolioIntelligence",
    icon: ScanSearch,
    href: "/tokens",
    highlight: false,
  },
  {
    key: "smartAlerts",
    icon: Bell,
    href: "/market",
    highlight: true,
  },
] as const;

type ProductKey = (typeof products)[number]["key"];

function productTag(tr: TranslateFunction, key: ProductKey) {
  switch (key) {
    case "marketExplorer":
      return tr("landing.products.items.marketExplorer.tag");
    case "portfolioIntelligence":
      return tr("landing.products.items.portfolioIntelligence.tag");
    case "smartAlerts":
      return tr("landing.products.items.smartAlerts.tag");
  }
}

function productTitle(tr: TranslateFunction, key: ProductKey) {
  switch (key) {
    case "marketExplorer":
      return tr("landing.products.items.marketExplorer.title");
    case "portfolioIntelligence":
      return tr("landing.products.items.portfolioIntelligence.title");
    case "smartAlerts":
      return tr("landing.products.items.smartAlerts.title");
  }
}

function productDescription(tr: TranslateFunction, key: ProductKey) {
  switch (key) {
    case "marketExplorer":
      return tr("landing.products.items.marketExplorer.description");
    case "portfolioIntelligence":
      return tr("landing.products.items.portfolioIntelligence.description");
    case "smartAlerts":
      return tr("landing.products.items.smartAlerts.description");
  }
}

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
  const { tr } = useLocalization();

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
        <div
          style={{
            gridColumn: "1 / -1",
            marginBottom: "3rem",
            textAlign: "center",
          }}
        >
          <p
            className="text-center text-sm font-semibold uppercase tracking-[0.22em]"
            style={{ color: LANDING_ACCENT }}
          >
            {tr("landing.products.eyebrow")}
          </p>
          <h2
            className="mx-auto mt-4 max-w-3xl text-center text-3xl font-bold tracking-tight text-(--landing-foreground) sm:text-4xl"
            style={{ lineHeight: 1.2 }}
          >
            {tr("landing.products.title")}
          </h2>
        </div>

        {products.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.article
              key={p.key}
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
                  e.currentTarget.style.borderColor = "var(--landing-card-border)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: p.highlight ? LANDING_ACCENT : "var(--landing-muted)" }}
                >
                  {productTag(tr, p.key)}
                </span>
                <Icon
                  className="h-5 w-5 shrink-0 text-(--landing-accent)"
                  style={{ opacity: 0.8 }}
                  aria-hidden
                />
              </div>
              <h3
                className="mt-5 text-xl font-bold text-(--landing-foreground)"
                style={{ lineHeight: 1.3 }}
              >
                {productTitle(tr, p.key)}
              </h3>
              <p className="mt-3 text-(--landing-muted)" style={{ lineHeight: 1.7 }}>
                {productDescription(tr, p.key)}
              </p>
              <Link
                to={p.href}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: LANDING_ACCENT, textDecoration: "none" }}
              >
                {tr("landing.products.learnMore")}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
