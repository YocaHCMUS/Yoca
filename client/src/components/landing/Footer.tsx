import { Link } from "react-router";

const columns = [
  {
    title: "Products",
    links: [
      { label: "Data Hub", to: "/market" },
      { label: "APIs & Connectors", to: "/tokens" },
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
      className="pb-14 pt-16"
      style={{
        backgroundColor: "#0a0a0f",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          {/* Brand */}
          <div>
            <Link
              to="/"
              className="font-mono text-xl font-bold text-[#f8fafc]"
            >
              Yoca
            </Link>
            <p
              className="mt-4 max-w-xs text-sm text-[#94a3b8]"
              style={{ lineHeight: 1.6 }}
            >
              Onchain analytics for teams who ship with data, not guesswork.
            </p>
            <p className="mt-8 text-sm text-[#64748b]">
              &copy; {new Date().getFullYear()} Yoca
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:gap-16">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#94a3b8]">
                  {col.title}
                </h3>
                <ul className="mt-5 flex flex-col gap-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.to.startsWith("#") ? (
                        <a
                          href={l.to}
                          className="text-sm text-[#cbd5e1]"
                          style={{ transition: "color 0.15s ease" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "#f97316")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "#cbd5e1")
                          }
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link
                          to={l.to}
                          className="text-sm text-[#cbd5e1]"
                          style={{ transition: "color 0.15s ease" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "#f97316")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "#cbd5e1")
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
        </div>

        {/* Bottom bar */}
        <div
          className="mt-14 flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm text-[#64748b]">
            Looking to use Yoca for your company?
          </p>
          <Link
            to="/auth"
            className="text-sm font-semibold text-[#f97316]"
            style={{ transition: "opacity 0.15s ease" }}
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
