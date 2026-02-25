import appLogo from "@/assets/app-logo.png";
import { ModalStateManager } from "@/components/ModelStateManager";
import { useUserTheme } from "@/contexts";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Asleep, Light } from "@carbon/icons-react";
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
  Heading,
  SideNav,
  SideNavItems,
  SkipToContent,
  Stack,
  Switcher,
  SwitcherItem,
} from "@carbon/react";
import { Checkmark, Search, User, Wikis } from "@carbon/react/icons";
import { useState, type ReactNode } from "react";
import { SignInModal } from "../auth/SignInModal";
import { Divider } from "../partials/Divider/Divider";
import styles from "./Header.module.scss";

function ThemeToggleGlobalAction() {
  const { theme, toggleTheme } = useUserTheme();

  return (
    <HeaderGlobalAction
      aria-label={`Switch to ${theme == "dark" ? "light" : "dark"} mode`}
      tooltipAlignment="end"
      onClick={toggleTheme}
    >
      {theme == "dark" ? <Light size={20} /> : <Asleep size={20} />}
    </HeaderGlobalAction>
  );
}

export function PageWrapper({ children }: { children: ReactNode }) {
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(false);
  const { tr, lang, setLang } = useLocalization();
  const [isLangOpen, setIsLangOpen] = useState(false);

  const toggleSideNav = () => {
    setIsSideNavExpanded((prev) => !prev);
  };

  const toggleLang = () => {
    setIsLangOpen((prev) => !prev);
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
        <SkipToContent />

        <HeaderMenuButton
          aria-label={isSideNavExpanded ? "Close menu" : "Open menu"}
          isActive={isSideNavExpanded}
          aria-expanded={isSideNavExpanded}
          onClick={toggleSideNav}
        />

        <HeaderName href="#" prefix="">
          <Stack
            orientation="horizontal"
            style={{ alignItems: "center", fontWeight: "bold" }}
          >
            <img src={appLogo} alt="Logo" style={{ height: 36 }} />
            <Heading style={{ fontSize: 21 }}>YOCA</Heading>
          </Stack>
        </HeaderName>

        <HeaderNavigation>
          <NavHeaderItems />
        </HeaderNavigation>

        <HeaderGlobalBar>
          <HeaderGlobalAction aria-label={tr("nav.search")}>
            <Search size={20} />
          </HeaderGlobalAction>

          <HeaderGlobalAction
            aria-label={tr("nav.language")}
            isActive={isLangOpen}
            onClick={toggleLang}
          >
            <Wikis size={20} />
          </HeaderGlobalAction>

          <ModalStateManager
            renderLauncher={({ open, setOpen }) => (
              <HeaderGlobalAction
                aria-label={tr("nav.account")}
                isActive={open}
                onClick={() => setOpen(true)}
              >
                <User size={20} />
              </HeaderGlobalAction>
            )}
          >
            {({ open, setOpen }) => (
              <SignInModal open={open} onClose={() => setOpen(false)} />
            )}
          </ModalStateManager>
          <ThemeToggleGlobalAction />
        </HeaderGlobalBar>

        <HeaderPanel className={styles.headerPanel} expanded={isLangOpen}>
          <Switcher aria-label="Language Switcher" expanded={isLangOpen}>
            <SwitcherItem
              aria-labelledby="lang-vi"
              onClick={() => {
                setLang("vi");
                setIsLangOpen(false);
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
                setIsLangOpen(false);
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

      <Content style={{ height: "100vh" }} id="main-content">
        {children}
      </Content>
    </>
  );
}
