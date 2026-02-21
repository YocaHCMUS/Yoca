/**
 * Header Component
 * Navigation header with user profile, language selector, and theme toggle
 */

import appLogo from "@/assets/app-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { Login, Logout, UserAvatar } from "@carbon/icons-react";
import {
  Header as CarbonHeader,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
} from "@carbon/react";
import React, { useState } from "react";
import styles from "./Header.module.scss";
import LanguageSelector from "./LanguageSelector.tsx";
import ThemeToggle from "./ThemeToggle.tsx";

interface HeaderProps {
  onNavigate?: (path: string) => void;
  handleSignIn?: () => void;
  handleSignUp?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onNavigate,
  handleSignIn,
  handleSignUp,
}) => {
  const { tr } = useLocalization();
  const { authState, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleNavigation = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const handleSignOut = () => {
    signOut();
    setIsProfileOpen(false);
    if (onNavigate) {
      onNavigate("/auth");
    }
  };

  return (
    <HeaderContainer
      render={() => (
        <>
          <CarbonHeader aria-label="Yoca" className={styles.header}>
            <SkipToContent />

            <HeaderName href="#" prefix="" className={styles.headerName}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <img src={appLogo} alt="Yoca Logo" className={styles.logo} />
                <h1 className={styles.appName}>Yoca</h1>
              </div>
            </HeaderName>

            {/* Navigation items - Desktop only */}
            <HeaderNavigation
              aria-label="Main navigation"
              className={styles.desktopNav}
            >
              <HeaderMenuItem
                className={styles.headerMenuItem}
                onClick={() => handleNavigation("/market")}
              >
                {tr("nav.market")}
              </HeaderMenuItem>
              <HeaderMenuItem
                className={styles.headerMenuItem}
                onClick={() => handleNavigation("/alert")}
              >
                {tr("nav.alert")}
              </HeaderMenuItem>
              <HeaderMenuItem
                className={styles.headerMenuItem}
                onClick={() => handleNavigation("/dashboard")}
              >
                {tr("nav.dashboard")}
              </HeaderMenuItem>
            </HeaderNavigation>

            {/* Global actions - Desktop only */}
            <HeaderGlobalBar className={styles.desktopGlobalBar}>
              <LanguageSelector />
              <ThemeToggle />

              {authState.isAuthenticated ? (
                <div className={styles.profileWrapper}>
                  <HeaderGlobalAction
                    aria-label={tr("nav.profile")}
                    tooltipAlignment="end"
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className={styles.profileButton}
                  >
                    <UserAvatar size={20} />
                  </HeaderGlobalAction>

                  {isProfileOpen && (
                    <>
                      {/* Backdrop to close dropdown */}
                      <div
                        className={styles.backdrop}
                        onClick={() => setIsProfileOpen(false)}
                      />

                      {/* Profile dropdown */}
                      <div className={styles.profileDropdown}>
                        <div className={styles.profileInfo}>
                          <UserAvatar size={16} />
                          <p className={styles.username}>
                            {authState.user?.username || authState.user?.email}
                          </p>
                        </div>
                        <button
                          className={styles.signOutButton}
                          onClick={handleSignOut}
                        >
                          {tr("auth.signOut")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.authButtons}>
                  <button className={styles.loginButton} onClick={handleSignIn}>
                    <Login size={16} />
                    {tr("auth.signIn")}
                  </button>
                  <button
                    className={styles.signUpButton}
                    onClick={handleSignUp}
                  >
                    {tr("auth.signUp")}
                  </button>
                </div>
              )}
            </HeaderGlobalBar>

            <HeaderMenuButton
              aria-label="Open menu"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              isActive={isMenuOpen}
            />
          </CarbonHeader>

          {/* Mobile Side Navigation */}
          <SideNav
            aria-label="Side navigation"
            expanded={isMenuOpen}
            onOverlayClick={() => setIsMenuOpen(false)}
            className={styles.sideNav}
          >
            <SideNavItems>
              {/* User Info Section - Mobile only */}
              {authState.isAuthenticated && (
                <div className={styles.mobileUserInfo}>
                  <UserAvatar size={32} />
                  <div className={styles.mobileUserDetails}>
                    <p className={styles.mobileUsername}>
                      {authState.user?.username || authState.user?.email}
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <SideNavLink
                onClick={() => {
                  handleNavigation("/market");
                  setIsMenuOpen(false);
                }}
              >
                {tr("nav.market")}
              </SideNavLink>
              <SideNavLink
                onClick={() => {
                  handleNavigation("/alert");
                  setIsMenuOpen(false);
                }}
              >
                {tr("nav.alert")}
              </SideNavLink>
              <SideNavLink
                onClick={() => {
                  handleNavigation("/dashboard");
                  setIsMenuOpen(false);
                }}
              >
                {tr("nav.dashboard")}
              </SideNavLink>

              {/* Divider */}
              <div className={styles.mobileDivider} />

              {/* Settings Section */}
              <div className={styles.mobileSettings}>
                <div className={styles.mobileSettingItem}>
                  <span className={styles.mobileSettingLabel}>
                    {tr("nav.language")}
                  </span>
                  <LanguageSelector />
                </div>
                <div className={styles.mobileSettingItem}>
                  <span className={styles.mobileSettingLabel}>
                    {tr("nav.theme")}
                  </span>
                  <ThemeToggle />
                </div>
              </div>

              {/* Divider */}
              <div className={styles.mobileDivider} />

              {/* Auth Actions */}
              {authState.isAuthenticated ? (
                <div className={styles.mobileAuthActions}>
                  <button
                    className={styles.mobileSignOutButton}
                    onClick={() => {
                      handleSignOut();
                      setIsMenuOpen(false);
                    }}
                  >
                    <Logout size={20} />
                    {tr("auth.signOut")}
                  </button>
                </div>
              ) : (
                <div className={styles.mobileAuthActions}>
                  <button
                    className={styles.mobileLoginButton}
                    onClick={() => {
                      handleSignIn?.();
                      setIsMenuOpen(false);
                    }}
                  >
                    <Login size={20} />
                    {tr("auth.signIn")}
                  </button>
                  <button
                    className={styles.mobileSignUpButton}
                    onClick={() => {
                      handleSignUp?.();
                      setIsMenuOpen(false);
                    }}
                  >
                    {tr("auth.signUp")}
                  </button>
                </div>
              )}
            </SideNavItems>
          </SideNav>
        </>
      )}
    />
  );
};

export default Header;
