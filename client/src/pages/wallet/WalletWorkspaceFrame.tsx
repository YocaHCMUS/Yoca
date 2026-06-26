import { useEffect, useState, type ReactNode } from "react";
import { Bell, CircleAlert, Info, Languages, LogOut, Menu, Moon, Search, Sun, TriangleAlert, UserRound, X } from "lucide-react";
import { useUserTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { headerNotificationsMockData } from "@/services/notifications/headerNotificationsMock";
import type { AlertNotification } from "@/types/profile";
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const isDark = theme === "dark";

  const getNotificationTone = (severity: AlertNotification["severity"]) => {
    if (severity === "critical") return "critical";
    if (severity === "warning") return "warning";
    return "info";
  };

  const getNotificationIcon = (severity: AlertNotification["severity"]) => {
    if (severity === "critical") return <CircleAlert size={15} strokeWidth={1.9} />;
    if (severity === "warning") return <TriangleAlert size={15} strokeWidth={1.9} />;
    return <Info size={15} strokeWidth={1.9} />;
  };

  // App.css clips the generic SPA shell. Wallet is a long dashboard, so restore
  // browser scrolling explicitly for this route and restore the previous inline styles on unmount.
  useEffect(() => {
    const targets = [document.documentElement, document.body, document.getElementById("root")]
      .filter((element): element is HTMLElement => Boolean(element));

    const previousStyles = targets.map((element) => ({
      element,
      height: element.style.getPropertyValue("height"),
      minHeight: element.style.getPropertyValue("min-height"),
      overflow: element.style.getPropertyValue("overflow"),
      overflowX: element.style.getPropertyValue("overflow-x"),
      overflowY: element.style.getPropertyValue("overflow-y"),
    }));

    targets.forEach((element) => {
      element.classList.add("walletRouteScroll");
      element.style.setProperty("height", "auto", "important");
      element.style.setProperty("min-height", element === document.getElementById("root") ? "100vh" : "100%", "important");
      element.style.setProperty("overflow", "visible", "important");
      element.style.setProperty("overflow-x", "hidden", "important");
      element.style.setProperty("overflow-y", "auto", "important");
    });

    return () => {
      previousStyles.forEach(({ element, height, minHeight, overflow, overflowX, overflowY }) => {
        element.classList.remove("walletRouteScroll");
        const restore = (property: string, value: string) => {
          if (value) element.style.setProperty(property, value);
          else element.style.removeProperty(property);
        };
        restore("height", height);
        restore("min-height", minHeight);
        restore("overflow", overflow);
        restore("overflow-x", overflowX);
        restore("overflow-y", overflowY);
      });
    };
  }, []);

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
            <div className={styles.notificationsWrap}>
              <button
                type="button"
                className={`${styles.iconButton} ${notificationsOpen ? styles.iconButtonActive : ""}`}
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setAccountOpen(false);
                }}
                aria-label={tr("nav.notification")}
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                title={tr("nav.notification")}
              >
                <Bell size={17} strokeWidth={1.9} />
                <span className={styles.notificationBadge}>{headerNotificationsMockData.length}</span>
              </button>
              {notificationsOpen && (
                <section className={styles.notificationsMenu} role="dialog" aria-label={tr("nav.notification")}>
                  <div className={styles.notificationsMenuHeader}>
                    <div>
                      <strong>{tr("nav.notification")}</strong>
                      <span>{lang === "vi" ? `${headerNotificationsMockData.length} thông báo mới` : `${headerNotificationsMockData.length} new notifications`}</span>
                    </div>
                    <a href="/alerts" onClick={() => setNotificationsOpen(false)}>
                      {lang === "vi" ? "Xem tất cả" : "View all"}
                    </a>
                  </div>
                  <div className={styles.notificationsList}>
                    {headerNotificationsMockData.map((item) => {
                      const tone = getNotificationTone(item.severity);
                      return (
                        <article key={item.id} className={`${styles.notificationItem} ${styles[`notification_${tone}`]}`}>
                          <span className={styles.notificationSeverity}>{getNotificationIcon(item.severity)}</span>
                          <div>
                            <p>{item.message}</p>
                            <time dateTime={item.timestamp}>
                              {new Date(item.timestamp).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
            <div className={styles.accountWrap}>
              <button
                type="button"
                className={styles.accountButton}
                onClick={() => {
                  setAccountOpen((open) => !open);
                  setNotificationsOpen(false);
                }}
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
