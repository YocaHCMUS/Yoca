import { Link } from "react-router";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import appLogo from "../../assets/app-logo.png";
import { GRID_MAX_WIDTH, btnPrimaryBase, btnPrimaryEnter, btnPrimaryLeave } from "./tokens";
import { SignInModal } from "../auth/SignInModal";
import { SignUpModal } from "../auth/SignUpModal";
import { useAuth } from "@/contexts/AuthContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { LogOut } from "lucide-react";

const navLinks = [
  { label: "Products", href: "#products" },
  { label: "Use Cases", href: "#stories" },
  { label: "Docs", href: "/market" },
  { label: "Pricing", href: "/pricing" },
] as const;

const linkStyle = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--landing-muted)",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
  transition: "color 0.2s ease",
};

export function LandingNavbar() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useUserTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  useEffect(() => {
    const container = document.querySelector(".landing-page");
    if (container) {
      setScrolled(container.scrollTop > 48);
    }
    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.classList && target.classList.contains("landing-page")) {
        setScrolled(target.scrollTop > 48);
      }
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
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
        borderBottom: "1px solid var(--landing-border)",
        backgroundColor: scrolled
          ? "var(--landing-surface-strong)"
          : "var(--landing-surface)",
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
                color: "var(--landing-foreground)",
                textDecoration: "none",
              }}
            >
              <img src={appLogo} alt="Yoca logo" width={28} height={28} style={{ display: "block" }} />
              <span>YOCA</span>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />
              <button
                type="button"
                aria-expanded={mobileOpen}
                aria-label="Toggle menu"
                onClick={() => setMobileOpen((o) => !o)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--landing-foreground)",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div
              style={{
                borderTop: "1px solid var(--landing-border)",
                padding: "1.25rem 1.5rem",
                backgroundColor: "var(--landing-bg)",
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
                  {!user ? (
                    <>
                      <button
                        type="button"
                        style={{
                          display: "block",
                          textAlign: "center",
                          width: "100%",
                          padding: "0.75rem",
                          borderRadius: "9999px",
                          border: "1px solid var(--landing-border)",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "var(--landing-foreground)",
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
                    </>
                  ) : (
                    <Link
                      to="/profile"
                      style={{ ...btnPrimaryBase, width: "100%", justifyContent: "center" }}
                      onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
                      onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
                      onClick={() => setMobileOpen(false)}
                    >
                      Go to Profile
                    </Link>
                  )}
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
                color: "var(--landing-foreground)",
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
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--landing-foreground)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--landing-muted)")}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      to={item.href}
                      style={linkStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--landing-foreground)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--landing-muted)")}
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
            <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />
            {!user ? (
              <>
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
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <Link
                  to="/profile"
                  style={{ ...btnPrimaryBase, border: "none", cursor: "pointer", textDecoration: "none" }}
                  onMouseEnter={(e) => btnPrimaryEnter(e.currentTarget)}
                  onMouseLeave={(e) => btnPrimaryLeave(e.currentTarget)}
                >
                  Go to Profile
                </Link>
                <button
                  onClick={signOut}
                  title="Log out"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--landing-muted)",
                    cursor: "pointer",
                    padding: "8px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--landing-foreground)";
                    e.currentTarget.style.backgroundColor = "var(--landing-surface)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--landing-muted)";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
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
        color: "var(--landing-muted)",
        textDecoration: "none",
        whiteSpace: "nowrap",
        padding: "12px 20px",
        transition: "color 0.2s ease",
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--landing-foreground)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--landing-muted)")}
      onClick={onOpen}
    >
      Log In
    </button>
  );
}

function ThemeToggleBtn({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{
        background: "none",
        border: "none",
        color: "var(--landing-muted)",
        cursor: "pointer",
        padding: "8px",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--landing-foreground)";
        e.currentTarget.style.backgroundColor = "var(--landing-surface)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--landing-muted)";
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
