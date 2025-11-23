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
} from '@carbon/react';
import { UserAvatar, Login } from '@carbon/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import LanguageSelector from './LanguageSelector';
import ThemeToggle from './ThemeToggle';
import styles from './Header.module.scss';

/**
 * Header component props
 */
interface HeaderProps {
  onNavigate?: (path: string) => void;
}

/**
 * Header Component
 * Displays navigation items, user profile, language selector, and theme toggle
 */
const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { authState, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

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
    if (onNavigate) {
      onNavigate('/auth');
    }
  };

  return (
    <HeaderContainer
      render={() => (
        <CarbonHeader aria-label="Yoca" className={styles.header}>
          <SkipToContent />
          <HeaderMenuButton
            aria-label="Open menu"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            isActive={isMenuOpen}
          />
          <HeaderName href="#" prefix="">
            Yoca
          </HeaderName>

          {/* Navigation items - only show when authenticated */}
          {authState.isAuthenticated && (
            <HeaderNavigation aria-label="Main navigation">
              <HeaderMenuItem
                onClick={() => handleNavigation('/market')}
              >
                {t('nav.market')}
              </HeaderMenuItem>
              <HeaderMenuItem
                onClick={() => handleNavigation('/alert')}
              >
                {t('nav.alert')}
              </HeaderMenuItem>
              <HeaderMenuItem
                onClick={() => handleNavigation('/dashboard')}
              >
                {t('nav.dashboard')}
              </HeaderMenuItem>
            </HeaderNavigation>
          )}

          {/* Global actions */}
          <HeaderGlobalBar>
            {/* Language selector */}
            <LanguageSelector />

            {/* Theme toggle */}
            <ThemeToggle />

            {/* User profile or auth buttons */}
            {authState.isAuthenticated ? (
              <HeaderGlobalAction
                aria-label={t('nav.profile')}
                tooltipAlignment="end"
                className={styles.profileButton}
              >
                <UserAvatar size={20} />
                <div className={styles.profileDropdown}>
                  <div className={styles.profileInfo}>
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
              </HeaderGlobalAction>
            ) : (
              <div className={styles.authButtons}>
                <button
                  className={styles.loginButton}
                  onClick={() => handleNavigation('/auth/signin')}
                >
                  <Login size={16} />
                  {t('auth.signIn')}
                </button>
                <button
                  className={styles.signUpButton}
                  onClick={() => handleNavigation('/auth/signup')}
                >
                  {t('auth.signUp')}
                </button>
              </div>
            )}
          </HeaderGlobalBar>
        </CarbonHeader>
      )}
    />
  );
};

export default Header;
