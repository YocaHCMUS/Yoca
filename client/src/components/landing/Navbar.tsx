import { Link } from "react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const navLinks = [
  { label: "Products", href: "#products" },
  { label: "Use Cases", href: "#stories" },
  { label: "Docs", href: "/market" },
  { label: "Pricing", href: "#cta" },
] as const;

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
          ? "rgba(10, 10, 15, 0.92)"
          : "rgba(10, 10, 15, 0.40)",
        backdropFilter: scrolled ? "blur(14px) saturate(180%)" : "blur(4px)",
        WebkitBackdropFilter: scrolled
          ? "blur(14px) saturate(180%)"
          : "blur(4px)",
        transition:
          "background-color 0.3s ease, backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease",
      }}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link
          to="/"
          className="shrink-0 font-mono text-xl font-bold tracking-tight text-[#f8fafc]"
        >
          Yoca
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((item) => (
            <li key={item.label}>
              {item.href.startsWith("#") ? (
                <a
                  href={item.href}
                  className="text-sm font-medium text-[#94a3b8] hover:text-[#f8fafc]"
                  style={{
                    transition: "color 0.2s ease",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  to={item.href}
                  className="text-sm font-medium text-[#94a3b8] hover:text-[#f8fafc]"
                  style={{
                    transition: "color 0.2s ease",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/auth"
            className="rounded-full px-5 py-2 text-sm font-medium text-[#94a3b8] hover:text-[#f8fafc]"
            style={{ transition: "color 0.2s ease" }}
          >
            Log in
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-[#f97316] px-5 py-2.5 text-sm font-semibold text-[#0a0a0f] hover:opacity-90"
            style={{ transition: "opacity 0.15s ease" }}
          >
            Sign up
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-[#f8fafc] md:hidden"
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {mobileOpen && (
        <div
          className="border-t border-white/6 px-6 py-5 md:hidden"
          style={{ backgroundColor: "#0a0a0f" }}
        >
          <ul className="flex flex-col gap-4">
            {navLinks.map((item) => (
              <li key={item.label}>
                {item.href.startsWith("#") ? (
                  <a
                    href={item.href}
                    className="block text-base text-[#94a3b8]"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    to={item.href}
                    className="block text-base text-[#94a3b8]"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
            <li className="flex gap-3 pt-3">
              <Link
                to="/auth"
                className="flex-1 rounded-full border border-white/10 py-2.5 text-center text-sm font-medium text-[#f8fafc]"
                onClick={() => setMobileOpen(false)}
              >
                Log in
              </Link>
              <Link
                to="/auth"
                className="flex-1 rounded-full bg-[#f97316] py-2.5 text-center text-sm font-semibold text-[#0a0a0f]"
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
