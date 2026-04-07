import { Link } from "react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { GRID_MAX_WIDTH, btnPrimaryBase, btnPrimaryEnter, btnPrimaryLeave } from "./tokens";

const navLinks = [
  { label: "Products", href: "#products" },
  { label: "Use Cases", href: "#stories" },
  { label: "Docs", href: "/market" },
  { label: "Pricing", href: "#cta" },
] as const;

const linkStyle = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#94a3b8",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
  transition: "color 0.2s ease",
};

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backgroundColor: scrolled
          ? "rgba(10, 10, 15, 0.94)"
          : "rgba(10, 10, 15, 0.45)",
        backdropFilter: scrolled ? "blur(14px) saturate(180%)" : "blur(4px)",
        WebkitBackdropFilter: scrolled
          ? "blur(14px) saturate(180%)"
          : "blur(4px)",
        transition:
          "background-color 0.3s ease, backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease",
      }}
    >
      {/* Desktop: strict 12-column grid — prevents nav / CTA overlap */}
      <div
        className="mx-auto hidden min-h-16 w-full lg:grid lg:items-center"
        style={{
          maxWidth: GRID_MAX_WIDTH,
          paddingLeft: "1.5rem",
          paddingRight: "1.5rem",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          columnGap: "1rem",
          alignItems: "center",
        }}
      >
        <div
          className="flex items-center"
          style={{ gridColumn: "1 / span 2", minWidth: 0 }}
        >
          <Link
            to="/"
            className="shrink-0 font-mono text-xl font-bold tracking-tight text-[#f8fafc]"
            style={{ textDecoration: "none" }}
          >
            Yoca
          </Link>
        </div>

        <nav
          aria-label="Primary"
          className="flex min-w-0 items-center justify-center"
          style={{ gridColumn: "3 / span 7" }}
        >
          <ul className="flex items-center gap-x-8 gap-y-2">
            {navLinks.map((item) => (
              <li key={item.label} className="shrink-0">
                {item.href.startsWith("#") ? (
                  <a
                    href={item.href}
                    style={linkStyle}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "#f8fafc")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "#94a3b8")
                    }
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    to={item.href}
                    style={linkStyle}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "#f8fafc")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "#94a3b8")
                    }
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div
          className="flex items-center justify-end gap-3"
          style={{ gridColumn: "10 / span 3" }}
        >
          <Link
            to="/auth"
            style={{
              ...linkStyle,
              padding: "12px 20px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            Log in
          </Link>
          <Link
            to="/auth"
            style={btnPrimaryBase}
            onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
            onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
          >
            Sign up
          </Link>
        </div>
      </div>

      {/* Mobile / tablet */}
      <div
        className="flex h-16 items-center justify-between px-6 lg:hidden"
        style={{ maxWidth: GRID_MAX_WIDTH, marginLeft: "auto", marginRight: "auto" }}
      >
        <Link
          to="/"
          className="font-mono text-xl font-bold text-[#f8fafc]"
          style={{ textDecoration: "none" }}
        >
          Yoca
        </Link>
        <button
          type="button"
          className="rounded-lg p-2 text-[#f8fafc]"
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="border-t border-white/[0.06] px-6 py-5 lg:hidden"
          style={{ backgroundColor: "#0a0a0f" }}
        >
          <ul className="flex flex-col gap-4">
            {navLinks.map((item) => (
              <li key={item.label}>
                {item.href.startsWith("#") ? (
                  <a
                    href={item.href}
                    className="block text-base text-[#94a3b8]"
                    style={{ textDecoration: "none" }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    to={item.href}
                    className="block text-base text-[#94a3b8]"
                    style={{ textDecoration: "none" }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
            <li className="flex flex-col gap-3 pt-3 sm:flex-row">
              <Link
                to="/auth"
                className="flex-1 rounded-full border border-white/15 py-3 text-center text-sm font-medium text-[#f8fafc]"
                style={{ textDecoration: "none" }}
                onClick={() => setMobileOpen(false)}
              >
                Log in
              </Link>
              <Link
                to="/auth"
                className="flex-1 rounded-full py-3 text-center text-sm font-semibold text-[#0a0a0f]"
                style={{
                  ...btnPrimaryBase,
                  width: "100%",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
                onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
                onClick={() => setMobileOpen(false)}
              >
                Sign up
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
