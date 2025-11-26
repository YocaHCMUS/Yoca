/**
 * LanguageSelector Component
 * Dropdown for selecting application language
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HeaderGlobalAction } from '@carbon/react';
import { Language } from '@carbon/icons-react';
import styles from './LanguageSelector.module.scss';

/**
 * Available languages with labels
 */
const languages = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

/**
 * LanguageSelector Component
 * Allows users to switch between available languages
 */
const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Handle language change
   */
  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setIsOpen(false);
  };

  return (
    <div className={styles.languageSelectorWrapper}>
      <HeaderGlobalAction
        aria-label="Select language"
        tooltipAlignment="end"
        onClick={() => setIsOpen(!isOpen)}
        className={styles.languageButton}
      >
        <Language size={20} />
      </HeaderGlobalAction>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className={styles.backdrop}
            onClick={() => setIsOpen(false)}
          />

          {/* Language dropdown */}
          <div className={styles.languageDropdown}>
            <div className={styles.dropdownHeader}>
              <Language size={16} />
              <span>Language</span>
            </div>
            <ul className={styles.languageList}>
              {languages.map((lang) => (
                <li key={lang.code}>
                  <button
                    className={`${styles.languageOption} ${
                      i18n.language === lang.code ? styles.active : ''
                    }`}
                    onClick={() => handleLanguageChange(lang.code)}
                  >
                    <span className={styles.flag}>{lang.flag}</span>
                    <span className={styles.label}>{lang.label}</span>
                    {i18n.language === lang.code && (
                      <span className={styles.checkmark}>✓</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;
