import { useState, type ReactNode } from "react";
import { Bell, Languages, LogOut, Menu, Moon, Search, Sun, UserRound, X } from "lucide-react";
import { useUserTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import appLogo from "@/assets/app-logo.png";
import styles from "./WalletWorkspaceFrame.module.scss";

type WorkspacePanel = {
  isOpen: boolean;
  content: ReactNode;
  onClose: () => void;
};

interface WalletWorkspaceFrameProps {
  children: ReactNode;
  extraPanel?: WorkspacePanel;
}

export function WalletWorkspaceFrame({ children, extraPanel }: WalletWorkspaceFrameProps) {
  const { theme, toggleTheme } = useUserTheme();
  const { lang, setLang, tr } = useLocalization();
  const { user, signOut, openAuthModal } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const isDark = theme === "dark";

  return (
    <div className={styles.frame} data-theme={theme}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="/market" className={styles.brand} aria-label="YOCA">
            <span className={styles.brandMark}><img src={appLogo} alt="" /></span>
            <span className={styles.brandName}>YOCA</span>
            <span className={styles.brandDivider} />
            <span className={styles.workspaceLabel}>{lang === "vi" ? "Phân tích ví" : "Wallet analytics"}</span>
          </a>

          <nav className={styles.navigation} aria-label={lang === "vi" ? "Điều hướng chính" : "Main navigation"}>
            <a href="/market">{tr("nav.market")}</a>
            <a href="/alerts">{tr("nav.alerts")}</a>
          </nav>

          <div className={styles.headerActions}>
            <a className={styles.iconButton} href="/search" aria-label={tr("nav.search")} title={tr("nav.search")}>
              <Search size={17} strokeWidth={1.9} />
            </a>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setLang(lang === "vi" ? "en" : "vi")}
              aria-label={tr("nav.language")}
              title={tr("nav.language")}
            >
              <Languages size={17} strokeWidth={1.9} />
              <span className={styles.languageCode}>{lang.toUpperCase()}</span>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={toggleTheme}
              aria-label={isDark ? tr("nav.switchToLightTheme") : tr("nav.switchToDarkTheme")}
              title={isDark ? tr("nav.switchToLightTheme") : tr("nav.switchToDarkTheme")}
            >
              {isDark ? <Sun size={17} strokeWidth={1.9} /> : <Moon size={17} strokeWidth={1.9} />}
            </button>
            <button type="button" className={styles.iconButton} aria-label={tr("nav.notification")} title={tr("nav.notification")}>
              <Bell size={17} strokeWidth={1.9} />
            </button>
            <div className={styles.accountWrap}>
              <button
                type="button"
                className={styles.accountButton}
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-label={lang === "vi" ? "Tài khoản" : "Account"}
              >
                <span className={styles.avatar}>{(user?.displayName || user?.userId || "Y").slice(0, 1).toUpperCase()}</span>
                <span className={styles.accountName}>{user?.displayName || (lang === "vi" ? "Khách" : "Guest")}</span>
              </button>
              {accountOpen && (
                <div className={styles.accountMenu}>
                  <span className={styles.accountMenuLabel}>{user?.userId || (lang === "vi" ? "Chế độ khách" : "Guest mode")}</span>
                  {user ? (
                    <button type="button" onClick={() => void signOut()}>
                      <LogOut size={15} strokeWidth={1.9} />
                      {tr("nav.logout")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => openAuthModal("login")}><UserRound size={15} strokeWidth={1.9} />{tr("nav.login")}</button>
                  )}
                </div>
              )}
            </div>
            <button type="button" className={`${styles.iconButton} ${styles.mobileMenu}`} aria-label={lang === "vi" ? "Mở menu" : "Open menu"}>
              <Menu size={18} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </header>

      <main className={styles.content}>{children}</main>

      {extraPanel?.isOpen && (
        <div className={styles.drawerBackdrop} onClick={extraPanel.onClose}>
          <aside className={styles.drawer} onClick={(event) => event.stopPropagation()} aria-label={lang === "vi" ? "Chi tiết token" : "Token details"}>
            <div className={styles.drawerHeader}>
              <span>{lang === "vi" ? "Thông tin token" : "Token details"}</span>
              <button type="button" onClick={extraPanel.onClose} aria-label={lang === "vi" ? "Đóng" : "Close"}>
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>
            <div className={styles.drawerContent}>{extraPanel.content}</div>
          </aside>
        </div>
      )}
    </div>
  );
}
