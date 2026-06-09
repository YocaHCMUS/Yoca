import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import appLogo from "../../assets/app-logo.png";
import {
  GRID_MAX_WIDTH,
  btnPrimaryBase,
  btnPrimaryEnter,
  btnPrimaryLeave,
} from "./tokens";
import { SignInModal } from "../auth/SignInModal";
import { SignUpModal } from "../auth/SignUpModal";

type NavLinkKey = "products" | "useCases" | "docs" | "pricing";

const navLinks: Array<{ labelKey: NavLinkKey; href: string }> = [
  { labelKey: "products", href: "#products" },
  { labelKey: "useCases", href: "#stories" },
  { labelKey: "docs", href: "/market" },
  { labelKey: "pricing", href: "/pricing" },
];

const linkStyle = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--landing-muted)",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
  transition: "color 0.2s ease",
};

const quietIconButtonStyle = {
  background: "none",
  border: "none",
  color: "var(--landing-muted)",
  cursor: "pointer",
  padding: "8px",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s",
};

function navLabel(labelKey: NavLinkKey, tr: ReturnType<typeof useLocalization>["tr"]) {
  switch (labelKey) {
    case "products":
      return tr("landing.nav.products");
    case "useCases":
      return tr("landing.nav.useCases");
    case "docs":
      return tr("landing.nav.docs");
    case "pricing":
      return tr("landing.nav.pricing");
  }
}

export function LandingNavbar() {
  const { user, signOut } = useAuth();
  const { tr } = useLocalization();
  const { theme, toggleTheme } = useUserTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountLabel = user
    ? user.displayName || `${user.userId.slice(0, 8)}...`
    : "";

  useEffect(() => {
    const container = document.querySelector(".landing-page");
    if (container) {
      setScrolled(container.scrollTop > 48);
    }
    const onScroll = (event: Event) => {
      const target = event.target as HTMLElement;
      if (
        target &&
        target.classList &&
        target.classList.contains("landing-page")
      ) {
        setScrolled(target.scrollTop > 48);
      }
    };
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSignOut = async () => {
    setAccountOpen(false);
    setMobileOpen(false);
    await signOut();
  };

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
            <BrandLink />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />
              <button
                type="button"
                aria-expanded={mobileOpen}
                aria-label={tr("landing.nav.toggleMenu")}
                onClick={() => setMobileOpen((open) => !open)}
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
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {navLinks.map((item) => (
                  <li key={item.labelKey}>
                    {item.href.startsWith("#") ? (
                      <a
                        href={item.href}
                        style={{ ...linkStyle, fontSize: "1rem", display: "block" }}
                        onClick={() => setMobileOpen(false)}
                      >
                        {navLabel(item.labelKey, tr)}
                      </a>
                    ) : (
                      <Link
                        to={item.href}
                        style={{ ...linkStyle, fontSize: "1rem", display: "block" }}
                        onClick={() => setMobileOpen(false)}
                      >
                        {navLabel(item.labelKey, tr)}
                      </Link>
                    )}
                  </li>
                ))}
                <li
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    paddingTop: "0.75rem",
                  }}
                >
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
                        onClick={() => {
                          setMobileOpen(false);
                          setIsSignInOpen(true);
                        }}
                      >
                        {tr("landing.nav.login")}
                      </button>
                      <button
                        type="button"
                        style={{
                          ...btnPrimaryBase,
                          width: "100%",
                          justifyContent: "center",
                        }}
                        onMouseEnter={(event) =>
                          btnPrimaryEnter(event.currentTarget)
                        }
                        onMouseLeave={(event) =>
                          btnPrimaryLeave(event.currentTarget)
                        }
                        onClick={() => {
                          setMobileOpen(false);
                          setIsSignUpOpen(true);
                        }}
                      >
                        {tr("landing.nav.signUp")}
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          padding: "0.75rem",
                          borderRadius: "0.75rem",
                          border: "1px solid var(--landing-border)",
                          color: "var(--landing-muted)",
                          fontSize: "0.875rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {accountLabel}
                      </div>
                      <Link
                        to="/profile"
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
                        }}
                        onClick={() => setMobileOpen(false)}
                      >
                        {tr("landing.nav.profile")}
                      </Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
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
                          background: "none",
                          cursor: "pointer",
                        }}
                      >
                        {tr("auth.signOut")}
                      </button>
                    </>
                  )}
                </li>
              </ul>
            </div>
          )}
        </>
      ) : (
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
            }}
          >
            <BrandLink />
          </div>

          <nav aria-label={tr("landing.nav.primary")}>
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
                <li key={item.labelKey} style={{ flexShrink: 0 }}>
                  {item.href.startsWith("#") ? (
                    <a
                      href={item.href}
                      style={linkStyle}
                      onMouseEnter={(event) =>
                        (event.currentTarget.style.color =
                          "var(--landing-foreground)")
                      }
                      onMouseLeave={(event) =>
                        (event.currentTarget.style.color = "var(--landing-muted)")
                      }
                    >
                      {navLabel(item.labelKey, tr)}
                    </a>
                  ) : (
                    <Link
                      to={item.href}
                      style={linkStyle}
                      onMouseEnter={(event) =>
                        (event.currentTarget.style.color =
                          "var(--landing-foreground)")
                      }
                      onMouseLeave={(event) =>
                        (event.currentTarget.style.color = "var(--landing-muted)")
                      }
                    >
                      {navLabel(item.labelKey, tr)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />
            {!user ? (
              <>
                <LogInLink
                  label={tr("landing.nav.login")}
                  onOpen={() => setIsSignInOpen(true)}
                />
                <button
                  type="button"
                  style={{ ...btnPrimaryBase, border: "none", cursor: "pointer" }}
                  onMouseEnter={(event) => btnPrimaryEnter(event.currentTarget)}
                  onMouseLeave={(event) => btnPrimaryLeave(event.currentTarget)}
                  onClick={() => setIsSignUpOpen(true)}
                >
                  {tr("landing.nav.signUp")}
                </button>
              </>
            ) : (
              <div
                ref={accountRef}
                style={{ position: "relative", display: "flex", alignItems: "center" }}
              >
                <button
                  type="button"
                  aria-label={tr("landing.nav.account")}
                  aria-expanded={accountOpen}
                  title={tr("landing.nav.account")}
                  onClick={() => setAccountOpen((open) => !open)}
                  style={{
                    background: accountOpen ? "var(--landing-surface)" : "none",
                    border: "1px solid var(--landing-border)",
                    color: "var(--landing-muted)",
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: "9999px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.color =
                      "var(--landing-foreground)";
                    event.currentTarget.style.backgroundColor =
                      "var(--landing-surface)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.color = "var(--landing-muted)";
                    event.currentTarget.style.backgroundColor = accountOpen
                      ? "var(--landing-surface)"
                      : "transparent";
                  }}
                >
                  <User size={18} />
                  <ChevronDown
                    size={14}
                    style={{
                      transform: accountOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>
                {accountOpen && (
                  <div
                    role="menu"
                    aria-label={tr("landing.nav.account")}
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 0.6rem)",
                      width: "14rem",
                      padding: "0.45rem",
                      borderRadius: "1rem",
                      border: "1px solid var(--landing-border)",
                      background: "var(--landing-bg)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
                      zIndex: 80,
                    }}
                  >
                    <div
                      style={{
                        padding: "0.65rem 0.75rem",
                        color: "var(--landing-muted)",
                        fontSize: "0.8rem",
                        borderBottom: "1px solid var(--landing-border)",
                        marginBottom: "0.25rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {accountLabel}
                    </div>
                    <Link
                      to="/profile"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        padding: "0.7rem 0.75rem",
                        color: "var(--landing-foreground)",
                        textDecoration: "none",
                        borderRadius: "0.75rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                      }}
                    >
                      <User size={16} />
                      {tr("landing.nav.profile")}
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        padding: "0.7rem 0.75rem",
                        color: "var(--landing-foreground)",
                        background: "none",
                        border: "none",
                        borderRadius: "0.75rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <LogOut size={16} />
                      {tr("auth.signOut")}
                    </button>
                  </div>
                )}
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

function BrandLink() {
  return (
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
      <img
        src={appLogo}
        alt="Yoca logo"
        width={28}
        height={28}
        style={{ display: "block" }}
      />
      <span>YOCA</span>
    </Link>
  );
}

function LogInLink({ label, onOpen }: { label: string; onOpen: () => void }) {
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
      onMouseEnter={(event) =>
        (event.currentTarget.style.color = "var(--landing-foreground)")
      }
      onMouseLeave={(event) =>
        (event.currentTarget.style.color = "var(--landing-muted)")
      }
      onClick={onOpen}
    >
      {label}
    </button>
  );
}

function ThemeToggleBtn({
  theme,
  toggleTheme,
}: {
  theme: string;
  toggleTheme: () => void;
}) {
  const { tr } = useLocalization();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={
        theme === "dark"
          ? tr("landing.nav.switchToLightMode")
          : tr("landing.nav.switchToDarkMode")
      }
      style={quietIconButtonStyle}
      onMouseEnter={(event) => {
        event.currentTarget.style.color = "var(--landing-foreground)";
        event.currentTarget.style.backgroundColor = "var(--landing-surface)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.color = "var(--landing-muted)";
        event.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
