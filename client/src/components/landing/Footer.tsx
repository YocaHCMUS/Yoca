import { Link } from "react-router";
import { useLocalization, type TranslateFunction } from "@/contexts/LocalizationContext";
import { LANDING_ACCENT, SECTION_PADDING_Y, grid12Shell } from "./tokens";

const columns = [
  {
    titleKey: "products",
    links: [
      { labelKey: "dataHub", to: "/market" },
      { labelKey: "tokenExplorer", to: "/tokens" },
      { labelKey: "datashare", to: "/market" },
      { labelKey: "chains", to: "/tokens" },
      { labelKey: "pricing", to: "#cta" },
    ],
  },
  {
    titleKey: "resources",
    links: [
      { labelKey: "documentation", to: "/market" },
      { labelKey: "caseStudies", to: "#stories" },
      { labelKey: "blog", to: "/market" },
      { labelKey: "support", to: "/auth" },
    ],
  },
  {
    titleKey: "company",
    links: [
      { labelKey: "about", to: "/" },
      { labelKey: "careers", to: "/" },
      { labelKey: "press", to: "/" },
      { labelKey: "contact", to: "/auth" },
    ],
  },
  {
    titleKey: "legal",
    links: [
      { labelKey: "termsOfService", to: "/" },
      { labelKey: "privacyPolicy", to: "/" },
      { labelKey: "systemStatus", to: "/" },
    ],
  },
] as const;

type FooterColumnKey = (typeof columns)[number]["titleKey"];
type FooterLinkKey = (typeof columns)[number]["links"][number]["labelKey"];

function footerColumnTitle(tr: TranslateFunction, key: FooterColumnKey) {
  switch (key) {
    case "products":
      return tr("landing.footer.columns.products.title");
    case "resources":
      return tr("landing.footer.columns.resources.title");
    case "company":
      return tr("landing.footer.columns.company.title");
    case "legal":
      return tr("landing.footer.columns.legal.title");
  }
}

function footerLinkLabel(tr: TranslateFunction, key: FooterLinkKey) {
  switch (key) {
    case "dataHub":
      return tr("landing.footer.links.dataHub");
    case "tokenExplorer":
      return tr("landing.footer.links.tokenExplorer");
    case "datashare":
      return tr("landing.footer.links.datashare");
    case "chains":
      return tr("landing.footer.links.chains");
    case "pricing":
      return tr("landing.footer.links.pricing");
    case "documentation":
      return tr("landing.footer.links.documentation");
    case "caseStudies":
      return tr("landing.footer.links.caseStudies");
    case "blog":
      return tr("landing.footer.links.blog");
    case "support":
      return tr("landing.footer.links.support");
    case "about":
      return tr("landing.footer.links.about");
    case "careers":
      return tr("landing.footer.links.careers");
    case "press":
      return tr("landing.footer.links.press");
    case "contact":
      return tr("landing.footer.links.contact");
    case "termsOfService":
      return tr("landing.footer.links.termsOfService");
    case "privacyPolicy":
      return tr("landing.footer.links.privacyPolicy");
    case "systemStatus":
      return tr("landing.footer.links.systemStatus");
  }
}

export function LandingFooter() {
  const { tr } = useLocalization();

  return (
    <footer
      style={{
        backgroundColor: "var(--landing-bg)",
        borderTop: "1px solid var(--landing-section-border)",
        paddingTop: SECTION_PADDING_Y,
        paddingBottom: SECTION_PADDING_Y,
      }}
    >
      <div style={grid12Shell}>
        <div className="landing-footer-brand">
          <Link
            to="/"
            className="font-mono text-xl font-bold text-(--landing-foreground)"
            style={{ textDecoration: "none" }}
          >
            Yoca
          </Link>
          <p
            className="mt-4 max-w-xs text-sm text-(--landing-muted)"
            style={{ lineHeight: 1.6 }}
          >
            {tr("landing.footer.description")}
          </p>
          <p className="mt-8 text-sm text-(--landing-muted)">
            &copy; {new Date().getFullYear()} Yoca
          </p>
        </div>

        <div className="landing-footer-links">
          {columns.map((col) => (
            <div key={col.titleKey}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-(--landing-muted)">
                {footerColumnTitle(tr, col.titleKey)}
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.labelKey}>
                    {l.to.startsWith("#") ? (
                      <a
                        href={l.to}
                        className="text-sm text-(--landing-foreground)"
                        style={{ textDecoration: "none" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = LANDING_ACCENT)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--landing-foreground)")
                        }
                      >
                        {footerLinkLabel(tr, l.labelKey)}
                      </a>
                    ) : (
                      <Link
                        to={l.to}
                        className="text-sm text-(--landing-foreground)"
                        style={{ textDecoration: "none" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = LANDING_ACCENT)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--landing-foreground)")
                        }
                      >
                        {footerLinkLabel(tr, l.labelKey)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="col-span-full flex flex-col items-start justify-between gap-4 pt-10 sm:flex-row sm:items-center"
          style={{
            gridColumn: "1 / -1",
            borderTop: "1px solid var(--landing-section-border)",
          }}
        >
          <p className="text-sm text-(--landing-muted)">
            {tr("landing.footer.companyPrompt")}
          </p>
          <Link
            to="/auth"
            className="text-sm font-semibold"
            style={{ color: LANDING_ACCENT, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {tr("landing.footer.contactSales")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
