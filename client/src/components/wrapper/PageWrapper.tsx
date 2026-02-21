import appLogo from "@/assets/app-logo.png";
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
  SwitcherDivider,
  SwitcherItem,
} from "@carbon/react";
import { Search, User, Wikis } from "@carbon/react/icons";
import { useState, type ReactNode } from "react";
import styles from "./Header.module.scss";

type PageWrapperProps = {
  children?: ReactNode;
};

function NavHeaderItems() {
  return (
    <>
      <HeaderMenuItem href="#">Dashboard</HeaderMenuItem>
      <HeaderMenuItem href="#">Alerts</HeaderMenuItem>
      <HeaderMenuItem href="#">Profile</HeaderMenuItem>
    </>
  );
}

export default function PageWrapper({ children }: PageWrapperProps) {
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const toggleSideNav = () => {
    setIsSideNavExpanded((prev) => !prev);
  };

  const toggleLang = () => {
    setIsLangOpen((prev) => !prev);
  };

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
          <HeaderGlobalAction aria-label="Search">
            <Search size={20} />
          </HeaderGlobalAction>

          <HeaderGlobalAction
            aria-label="Language"
            isActive={isLangOpen}
            onClick={toggleLang}
          >
            <Wikis size={20} />
          </HeaderGlobalAction>

          <HeaderGlobalAction aria-label="Account">
            <User size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>

        <HeaderPanel
          className={styles.headerPanel}
          expanded={isLangOpen}
          aria-label="Language Selection"
        >
          <Switcher aria-label="Language Switcher">
            <SwitcherItem aria-labelledby="switcher-item-vietnamese">
              <p>Vietname - Tiếng Việt (Vietnamese)</p>
            </SwitcherItem>
            <SwitcherDivider />
            <SwitcherItem aria-labelledby="switcher-item-english">
              <p>United States - English (English)</p>
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

      <Content id="main-content">{children}</Content>
    </>
  );
}
