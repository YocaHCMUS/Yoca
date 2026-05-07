import { Link } from "react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import appLogo from "../../assets/app-logo.png";
import { GRID_MAX_WIDTH, btnPrimaryBase, btnPrimaryEnter, btnPrimaryLeave } from "./tokens";
import { SignInModal } from "../auth/SignInModal";
import { SignUpModal } from "../auth/SignUpModal";

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
  const [isMobile, setIsMobile] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

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
      {isMobile ? (
        /* ── Mobile bar ── */
        <>
          <div
            style={{
              display: "flex",
              height: "4rem",
              alignItems: "center",
              justifyContent: "space-between",
              maxWidth: GRID_MAX_WIDTH,
              margin: "0 auto",
              padding: "0 1.5rem",
            }}
          >
            <Link
              to="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontFamily: "inherit",
                fontSize: "1.25rem",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "#f8fafc",
                textDecoration: "none",
              }}
            >
              <img src={appLogo} alt="Yoca logo" width={28} height={28} style={{ display: "block" }} />
              <span>YOCA</span>
            </Link>
            <button
              type="button"
              aria-expanded={mobileOpen}
              aria-label="Toggle menu"
              onClick={() => setMobileOpen((o) => !o)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#f8fafc",
                padding: "0.5rem",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
              }}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {mobileOpen && (
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                padding: "1.25rem 1.5rem",
                backgroundColor: "#0a0a0f",
              }}
            >
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
                {navLinks.map((item) => (
                  <li key={item.label}>
                    {item.href.startsWith("#") ? (
                      <a
                        href={item.href}
                        style={{ ...linkStyle, fontSize: "1rem", display: "block" }}
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        to={item.href}
                        style={{ ...linkStyle, fontSize: "1rem", display: "block" }}
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
                <li style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "0.75rem" }}>
                  <button
                    type="button"
                    style={{
                      display: "block",
                      textAlign: "center",
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "9999px",
                      border: "1px solid rgba(255,255,255,0.15)",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "#f8fafc",
                      textDecoration: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                    onClick={() => { setMobileOpen(false); setIsSignInOpen(true); }}
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    style={{ ...btnPrimaryBase, width: "100%", justifyContent: "center" }}
                    onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
                    onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
                    onClick={() => { setMobileOpen(false); setIsSignUpOpen(true); }}
                  >
                    Sign Up
                  </button>
                </li>
              </ul>
            </div>
          )}
        </>
      ) : (
        /* ── Desktop / Tablet bar (≥ 768px) — true CSS Grid 3-column ── */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            height: "4rem",
            maxWidth: GRID_MAX_WIDTH,
            margin: "0 auto",
            padding: "0 1.5rem",
            gap: "1rem",
          }}
        >
          {/* LEFT — Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
            <Link
              to="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontFamily: "inherit",
                fontSize: "1.25rem",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "#f8fafc",
                textDecoration: "none",
              }}
            >
              <img src={appLogo} alt="Yoca logo" width={28} height={28} style={{ display: "block" }} />
              <span>YOCA</span>
            </Link>
          </div>

          {/* CENTER — Nav links (always geometrically centered) */}
          <nav aria-label="Primary">
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: "clamp(1.25rem, 2.5vw, 2rem)",
              }}
            >
              {navLinks.map((item) => (
                <li key={item.label} style={{ flexShrink: 0 }}>
                  {item.href.startsWith("#") ? (
                    <a
                      href={item.href}
                      style={linkStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      to={item.href}
                      style={linkStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* RIGHT — Auth actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
            {/* "Log In" text — only shown when there's enough space (≥ 900px approx) */}
            <LogInLink onOpen={() => setIsSignInOpen(true)} />
            <button
              type="button"
              style={{ ...btnPrimaryBase, border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
              onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
              onClick={() => setIsSignUpOpen(true)}
            >
              Sign Up
            </button>
          </div>
        </div>
      )}
      <SignInModal open={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
      <SignUpModal open={isSignUpOpen} onClose={() => setIsSignUpOpen(false)} />
    </header>
  );
}

/** Renders "Log In" only on wide viewports (≥ 900 px) via a hidden span trick */
function LogInLink({ onOpen }: { onOpen: () => void }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const check = () => setShow(window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      style={{
        fontSize: "0.875rem",
        fontWeight: 500,
        color: "#94a3b8",
        textDecoration: "none",
        whiteSpace: "nowrap",
        padding: "12px 20px",
        transition: "color 0.2s ease",
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#f8fafc")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
      onClick={onOpen}
    >
      Log In
    </button>
  );
}
