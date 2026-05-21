import { Link } from "react-router";
import { LANDING_ACCENT, SECTION_PADDING_Y, grid12Shell } from "./tokens";

const columns = [
  {
    title: "Products",
    links: [
      { label: "Data Hub", to: "/market" },
      { label: "Token Explorer", to: "/tokens" },
      { label: "Datashare", to: "/market" },
      { label: "Chains", to: "/tokens" },
      { label: "Pricing", to: "#cta" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", to: "/market" },
      { label: "Case studies", to: "#stories" },
      { label: "Blog", to: "/market" },
      { label: "Support", to: "/auth" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/" },
      { label: "Careers", to: "/" },
      { label: "Press", to: "/" },
      { label: "Contact", to: "/auth" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of service", to: "/" },
      { label: "Privacy policy", to: "/" },
      { label: "System status", to: "/" },
    ],
  },
] as const;

export function LandingFooter() {
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
            Onchain analytics for teams who ship with data, not guesswork.
          </p>
          <p className="mt-8 text-sm text-(--landing-muted)">
            &copy; {new Date().getFullYear()} Yoca
          </p>
        </div>

        <div className="landing-footer-links">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-(--landing-muted)">
                {col.title}
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.label}>
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
                        {l.label}
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
                        {l.label}
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
            Looking to use Yoca for your company?
          </p>
          <Link
            to="/auth"
            className="text-sm font-semibold"
            style={{ color: LANDING_ACCENT, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Contact sales
          </Link>
        </div>
      </div>
    </footer>
  );
}
