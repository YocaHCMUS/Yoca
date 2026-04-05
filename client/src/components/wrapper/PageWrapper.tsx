import appLogo from "@/assets/app-logo.png";
import { useUserTheme } from "@/contexts";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { cds } from "@/util/carbon-theme";
import { Asleep, FireFill, Light } from "@carbon/icons-react";
import {
  Content,
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
  HeaderPanel,
  HeaderSideNavItems,
  SideNav,
  SideNavItems,
  Stack,
  Switcher,
  SwitcherDivider,
  SwitcherItem,
} from "@carbon/react";
import { Checkmark, Logout, Search, User, Wikis } from "@carbon/react/icons";
import { useEffect, useState, type ReactNode } from "react";
import { SignInModal } from "../auth/SignInModal";
import MarketTicker from "../MarketTicker";
import { Divider } from "../partials/Divider/Divider";
import { SearchBar } from "../search/SearchBar";
import styles from "./PageWrapper.module.scss";

function ThemeToggleGlobalAction() {
  const { theme, toggleTheme } = useUserTheme();
  const { tr } = useLocalization();

  return (
    <HeaderGlobalAction
      aria-label={
        theme == "dark"
          ? tr("nav.switchToDarkTheme")
          : tr("nav.switchToLightTheme")
      }
      tooltipAlignment="end"
      onClick={toggleTheme}
    >
      {theme == "dark" ? <Light size={20} /> : <Asleep size={20} />}
    </HeaderGlobalAction>
  );
}

type PageWrapperProps = {
  children: ReactNode;
  extraHeaderPanel?: {
    isOpen: boolean;
    content: ReactNode;
    size?: "md" | "lg";
    onClose: () => void;
  };
  onHeaderPanelOpenChange?: (isOpen: boolean) => void;
};

export function PageWrapper({ children, extraHeaderPanel }: PageWrapperProps) {
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(false);
  const { tr, lang, setLang } = useLocalization();
  const { user, signOut } = useAuth();
  const [openPanel, setOpenPanel] = useState<"lang" | "account" | null>(null);
  const [isExtraPanelOpen, setIsExtraHeaderPanelOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Ctrl+K / Cmd+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key == "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Open extra panel when extraHeaderPanel.isOpen becomes true
  useEffect(() => {
    if (extraHeaderPanel?.isOpen) {
      setOpenPanel(null);
      setTimeout(() => setIsExtraHeaderPanelOpen(true), 0);
    }
  }, [extraHeaderPanel?.isOpen]);

  const toggleSideNav = () => {
    setIsSideNavExpanded((prev) => !prev);
  };

  const togglePanel = (panel: "lang" | "account") => {
    // Close header panel extension if it's open
    if (isExtraPanelOpen) {
      setIsExtraHeaderPanelOpen(false);
      extraHeaderPanel?.onClose();
    }
    setOpenPanel((prev) => (prev == panel ? null : panel));
  };

  function NavHeaderItems() {
    return (
      <>
        <HeaderMenuItem href="#">{tr("nav.dashboard")}</HeaderMenuItem>
        <HeaderMenuItem href="#">{tr("nav.alerts")}</HeaderMenuItem>
        <HeaderMenuItem href="#">{tr("nav.profile")}</HeaderMenuItem>
      </>
    );
  }

  return (
    <>
      <Header>
        <HeaderMenuButton
          aria-label={isSideNavExpanded ? "Close menu" : "Open menu"}
          isActive={isSideNavExpanded}
          aria-expanded={isSideNavExpanded}
          onClick={toggleSideNav}
        />

        <HeaderName href="#" prefix="">
          <Stack
            gap={3}
            orientation="horizontal"
            style={{ alignItems: "center", fontWeight: "bold" }}
          >
            <img src={appLogo} alt="Logo" style={{ height: 36 }} />
            <strong style={{ fontSize: 21 }}>YOCA</strong>
          </Stack>
        </HeaderName>

        <HeaderNavigation>
          <NavHeaderItems />
        </HeaderNavigation>

        <HeaderGlobalBar>
          <HeaderGlobalAction
            aria-label={tr("nav.search")}
            onClick={() => setIsSearchOpen(true)}
          >
            <Search size={20} />
          </HeaderGlobalAction>

          <HeaderGlobalAction
            aria-label={tr("nav.language")}
            isActive={openPanel == "lang"}
            onClick={() => togglePanel("lang")}
          >
            <Wikis size={20} />
          </HeaderGlobalAction>

          <HeaderGlobalAction
            aria-label={tr("nav.account")}
            isActive={openPanel == "account"}
            onClick={() => {
              if (user) {
                togglePanel("account");
              } else {
                setOpenPanel(null);
                setIsSignInOpen(true);
              }
            }}
          >
            <User size={20} />
          </HeaderGlobalAction>

          <ThemeToggleGlobalAction />
        </HeaderGlobalBar>

        <HeaderPanel
          className={styles.headerPanel}
          expanded={openPanel == "lang"}
          onHeaderPanelFocus={() => setOpenPanel(null)}
        >
          <Switcher
            aria-label="Language Switcher"
            expanded={openPanel == "lang"}
          >
            <SwitcherItem
              aria-labelledby="lang-vi"
              onClick={() => {
                setLang("vi");
                setOpenPanel(null);
              }}
            >
              <Stack
                orientation="horizontal"
                gap={4}
                style={{ alignItems: "center" }}
              >
                <p>{tr("lang.vi")}</p>
                {lang == "vi" && <Checkmark size={16} />}
              </Stack>
            </SwitcherItem>
            <Divider />
            <SwitcherItem
              aria-labelledby="lang-en"
              onClick={() => {
                setLang("en");
                setOpenPanel(null);
              }}
            >
              <Stack
                orientation="horizontal"
                gap={4}
                style={{ alignItems: "center" }}
              >
                <p>{tr("lang.en")}</p>
                {lang == "en" && <Checkmark size={16} />}
              </Stack>
            </SwitcherItem>
          </Switcher>
        </HeaderPanel>

        <HeaderPanel
          className={styles.headerPanel}
          expanded={openPanel == "account"}
          onHeaderPanelFocus={() => setOpenPanel(null)}
        >
          <Switcher aria-label="Account" expanded={openPanel == "account"}>
            <SwitcherItem aria-labelledby="account-id" isSelected={false}>
              <Stack
                orientation="horizontal"
                gap={4}
                style={{ alignItems: "center" }}
              >
                <User size={16} />
                <p style={{ fontFamily: "monospace" }}>
                  {user
                    ? user.displayName || `${user.userId.slice(0, 8)}…`
                    : ""}
                </p>
              </Stack>
            </SwitcherItem>
            <SwitcherDivider />
            <SwitcherItem
              aria-labelledby="account-signout"
              onClick={async () => {
                setOpenPanel(null);
                await signOut();
              }}
            >
              <Stack
                orientation="horizontal"
                gap={4}
                style={{ alignItems: "center" }}
              >
                <Logout size={16} />
                <p>{tr("auth.signOut")}</p>
              </Stack>
            </SwitcherItem>
          </Switcher>
        </HeaderPanel>

        {extraHeaderPanel && (
          <HeaderPanel
            className={
              extraHeaderPanel.size == "lg"
                ? styles.headerPanelLarge
                : styles.headerPanel
            }
            expanded={isExtraPanelOpen}
          >
            <Switcher aria-label="Extra" expanded={isExtraPanelOpen}>
              <div className={styles.extraHeaderPanelContent}>
                {extraHeaderPanel.content}
              </div>
            </Switcher>
          </HeaderPanel>
        )}

        <SideNav
          aria-label="Side navigation"
          expanded={isSideNavExpanded}
          isPersistent={false}
          onSideNavBlur={() => setIsSideNavExpanded(false)}
        >
          <SideNavItems>
            <HeaderSideNavItems hasDivider>
              <NavHeaderItems />
            </HeaderSideNavItems>
          </SideNavItems>
        </SideNav>
      </Header>

      <MarketTicker
        className={styles.marketTicker}
        label={tr("marketPage.trending")}
        icon={<FireFill size={16} fill={cds.supportError} />}
      />

      <SignInModal open={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
      {isSearchOpen && <SearchBar onClose={() => setIsSearchOpen(false)} />}

      <Content
        id="main-content"
        className={isExtraPanelOpen ? styles.contentDimmed : ""}
        onClick={
          isExtraPanelOpen
            ? () => {
                setIsExtraHeaderPanelOpen(false);
                extraHeaderPanel?.onClose();
              }
            : undefined
        }
      >
        {children}
      </Content>
    </>
  );
}
