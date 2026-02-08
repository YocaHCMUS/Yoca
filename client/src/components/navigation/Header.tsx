/**
 * Header Component
 * Navigation header with user profile, language selector, and theme toggle
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header as CarbonHeader,
  HeaderContainer,
  HeaderName,
  HeaderNavigation,
  HeaderMenuButton,
  HeaderMenuItem,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SkipToContent,
  SideNav,
  SideNavItems,
  SideNavLink,
} from '@carbon/react';
import { UserAvatar, Login, Logout } from '@carbon/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import appLogo from '../../assets/app-logo.png';
import LanguageSelector from './LanguageSelector.tsx';
import ThemeToggle from './ThemeToggle.tsx';
import styles from './Header.module.scss';

/**
 * Header component props
 */
interface HeaderProps {
  onNavigate?: (path: string) => void;
  handleSignIn?: () => void; // open modal, navigate,...
  handleSignUp?: () => void; // open modal, navigate,...
}

/**
 * Header Component
 * Displays navigation items, user profile, language selector, and theme toggle
 */
const Header: React.FC<HeaderProps> = ({ onNavigate, handleSignIn, handleSignUp }) => {
  const { t } = useTranslation();
  const { authState, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  /**
   * Handle navigation item click
   */
  const handleNavigation = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  /**
   * Handle sign out
   */
  const handleSignOut = () => {
    signOut();
    setIsProfileOpen(false);
    if (onNavigate) {
      onNavigate('/auth');
    }
  };

  return (
    <HeaderContainer
      render={() => (
        <>
          <CarbonHeader aria-label="Yoca" className={styles.header}>
            <SkipToContent />
            
            <HeaderName href="#" prefix="" className={styles.headerName} >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src={appLogo} alt="Yoca Logo" className={styles.logo} />
                <h1 className={styles.appName}>Yoca</h1>

              </div>
            </HeaderName>

            {/* Navigation items - Desktop only */}
            <HeaderNavigation aria-label="Main navigation" className={styles.desktopNav}>
              <HeaderMenuItem className={styles.headerMenuItem}
                onClick={() => handleNavigation('/market')}
              >
                {t('nav.market')}
              </HeaderMenuItem>
              <HeaderMenuItem className={styles.headerMenuItem}
                onClick={() => handleNavigation('/alert')}
              >
                {t('nav.alert')}
              </HeaderMenuItem>
              <HeaderMenuItem className={styles.headerMenuItem}
                onClick={() => handleNavigation('/dashboard')}
              >
                {t('nav.dashboard')}
              </HeaderMenuItem>
            </HeaderNavigation>

            {/* Global actions - Desktop only */}
            <HeaderGlobalBar className={styles.desktopGlobalBar}>
              {/* Language selector */}
              <LanguageSelector />

              {/* Theme toggle */}
              <ThemeToggle />

              {/* User profile or auth buttons */}
              {authState.isAuthenticated ? (
                <div className={styles.profileWrapper}>
                  <HeaderGlobalAction
                    aria-label={t('nav.profile')}
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
                          {t('auth.signOut')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.authButtons}>
                  <button
                    className={styles.loginButton}
                    onClick= {handleSignIn}
                  >
                    <Login size={16} />
                    {t('auth.signIn')}
                  </button>
                  <button
                    className={styles.signUpButton}
                    onClick={handleSignUp}
                  >
                    {t('auth.signUp')}
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
                  handleNavigation('/market');
                  setIsMenuOpen(false);
                }}
              >
                {t('nav.market')}
              </SideNavLink>
              <SideNavLink
                onClick={() => {
                  handleNavigation('/alert');
                  setIsMenuOpen(false);
                }}
              >
                {t('nav.alert')}
              </SideNavLink>
              <SideNavLink
                onClick={() => {
                  handleNavigation('/dashboard');
                  setIsMenuOpen(false);
                }}
              >
                {t('nav.dashboard')}
              </SideNavLink>

              {/* Divider */}
              <div className={styles.mobileDivider} />

              {/* Settings Section */}
              <div className={styles.mobileSettings}>
                <div className={styles.mobileSettingItem}>
                  <span className={styles.mobileSettingLabel}>{t('nav.language')}</span>
                  <LanguageSelector />
                </div>
                <div className={styles.mobileSettingItem}>
                  <span className={styles.mobileSettingLabel}>{t('nav.theme')}</span>
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
                    {t('auth.signOut')}
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
                    {t('auth.signIn')}
                  </button>
                  <button
                    className={styles.mobileSignUpButton}
                    onClick={() => {
                      handleSignUp?.();
                      setIsMenuOpen(false);
                    }}
                  >
                    {t('auth.signUp')}
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
