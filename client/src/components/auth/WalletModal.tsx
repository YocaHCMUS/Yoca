/**
 * WalletModal Component
 * Modal for wallet selection and connection with blockchain support
 * Features: Focus trapping, keyboard navigation (Tab, Escape), ARIA labels
 */

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Loading, ButtonSkeleton } from '@carbon/react';
import { Wallet } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import type { WalletInfo, BlockchainType, WalletType } from '../../types/auth';
import { detectWallets } from '../../services/auth/walletService';
import { useAuth } from '../../contexts/AuthContext';
import styles from './WalletModal.module.scss';

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  mode?: 'signin' | 'signup';
}

export const WalletModal: React.FC<WalletModalProps> = ({
  open,
  onClose,
  mode = 'signin',
}) => {
  const { t } = useTranslation();
  const { connectWallet } = useAuth();
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectingWallets, setDetectingWallets] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<WalletType | null>(null);
  const [error, setError] = useState<string>('');
  const firstWalletButtonRef = useRef<HTMLButtonElement>(null);

  // Focus first wallet button when wallets are loaded
  useEffect(() => {
    if (open && wallets.length > 0 && !detectingWallets && !loading) {
      // Delay to allow modal animation to complete
      setTimeout(() => {
        firstWalletButtonRef.current?.focus();
      }, 100);
    }
  }, [open, wallets, detectingWallets, loading]);

  // Detect wallets when modal opens or blockchain changes
  useEffect(() => {
    if (open) {
      loadWallets();
    }
  }, [open]);

  const loadWallets = async () => {
    setDetectingWallets(true);
    setError('');
    try {
      const [solanaWallets, ethereumWallets] = await Promise.all([
        detectWallets('solana'),
        detectWallets('ethereum'),
      ]);

      const mergedWallets = [...solanaWallets, ...ethereumWallets].reduce<WalletInfo[]>(
        (accumulator, wallet) => {
          const existingIndex = accumulator.findIndex((item) => item.type === wallet.type);
          if (existingIndex === -1) {
            accumulator.push(wallet);
            return accumulator;
          }

          const existingWallet = accumulator[existingIndex];
          accumulator[existingIndex] = {
            ...existingWallet,
            detected: existingWallet.detected || wallet.detected,
            blockchain: Array.from(new Set([...existingWallet.blockchain, ...wallet.blockchain])) as BlockchainType[],
          };
          return accumulator;
        },
        [],
      );

      setWallets(mergedWallets);
    } catch (err) {
      setError(t('wallet.detectionFailed'));
      console.error('Wallet detection error:', err);
    } finally {
      setDetectingWallets(false);
    }
  };

  const handleWalletSelect = async (wallet: WalletInfo) => {
  setConnectingWallet(wallet.type);
  setLoading(true);

  try {
    const primaryBlockchain = wallet.blockchain.includes('ethereum')
      ? 'ethereum'
      : wallet.blockchain[0];
    const response = await connectWallet(wallet.type, primaryBlockchain);

    if (response.success) {
      onClose(); // Đóng modal và chuyển hướng đã được AuthContext lo
    } else {
      setError(response.error || t('wallet.connectionFailed'));
    }
  } catch (err) {
    setError(t('validation.networkError'));
  } finally {
    setLoading(false);
    setConnectingWallet(null);
  }
};

  const handleRetry = () => {
    setError('');
    if (connectingWallet) {
      const walletToRetry = wallets.find((wallet) => wallet.type === connectingWallet);
      if (walletToRetry) {
        handleWalletSelect(walletToRetry);
        return;
      }
      loadWallets();
    } else {
      loadWallets();
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setConnectingWallet(null);
      onClose();
    }
  };

  // Keyboard navigation handler for wallet buttons
  const handleWalletKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    wallet: WalletInfo
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleWalletSelect(wallet);
    }
  };

  const detectedWallets = wallets.filter((w) => w.detected);
  const undetectedWallets = wallets.filter((w) => !w.detected);
  const hasDetectedWallets = detectedWallets.length > 0;

  return (
    <Modal
      open={open}
      onRequestClose={handleClose}
      modalHeading={mode === 'signin' ? t('wallet.connectToSignIn') : t('wallet.connectToSignUp')}
      // modalLabel={t('wallet.web3Auth')}
      passiveModal={!error}
      primaryButtonText={error ? t('wallet.retry') : undefined}
      secondaryButtonText={t('common.cancel')}
      onRequestSubmit={error ? handleRetry : undefined}
      preventCloseOnClickOutside={loading}
      className={styles.walletModal}
      size="md"
      aria-label={t('wallet.modal.title', 'Wallet Connection Modal')}
      aria-describedby="wallet-modal-description"
    >
      <div className={styles['modal-content']} id="wallet-modal-description">
        {/* Loading State - Detecting Wallets */}
        {detectingWallets && (
          <div className={styles['wallets-section']}>
            <h3 className={styles['section-heading']}>
              {t('wallet.detectedWallets')}
            </h3>
            <div className={styles['wallet-grid']}>
              <ButtonSkeleton size="md" />
              <ButtonSkeleton size="md" />
              <ButtonSkeleton size="md" />
              <ButtonSkeleton size="md" />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !detectingWallets && (
          <div className={styles['error-container']} role="alert" aria-live="assertive">
            <div className={styles['error-content']}>
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className={styles['error-text-wrapper']}>
                <h3 className={styles['error-title']}>{t('wallet.connectionFailed')}</h3>
                <p className={styles['error-message']}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Wallet List */}
        {!detectingWallets && !error && (
          <>
            {/* Detected Wallets */}
            {hasDetectedWallets && (
              <div className={styles['wallets-section']}>
                <h3 className={styles['section-heading']}>
                  {t('wallet.detectedWallets')}
                </h3>
                <div className={styles['wallet-grid']}>
                  {detectedWallets.map((wallet, index) => (
                    <button
                      key={wallet.type}
                      ref={index === 0 ? firstWalletButtonRef : null}
                      onClick={() => handleWalletSelect(wallet)}
                      onKeyDown={(e) => handleWalletKeyDown(e, wallet)}
                      disabled={loading}
                      aria-label={t('wallet.connectWith', { wallet: wallet.name })}
                      aria-busy={loading && connectingWallet === wallet.type}
                      className={`${styles['wallet-button']} ${
                        loading && connectingWallet === wallet.type
                          ? styles['wallet-button-connecting']
                          : styles['wallet-button-default']
                      } ${loading ? styles['wallet-button-disabled'] : ''}`}
                    >
                      {/* Detected Badge */}
                      <div className={styles['badge-container']}>
                        <span className={styles['detected-badge']}>
                          {t('wallet.detected')}
                        </span>
                      </div>

                      {/* Wallet Icon */}
                      <div className={styles['wallet-icon-container']}>
                        {wallet.icon ? (
                          <img
                            src={wallet.icon}
                            alt={wallet.name}
                            className={styles['wallet-icon']}
                          />
                        ) : (
                          <Wallet size={48} className={styles['wallet-icon-fallback']} />
                        )}
                      </div>

                      {/* Wallet Name */}
                      <span className={styles['wallet-name']}>
                        {wallet.name}
                      </span>

                      {/* Loading Indicator */}
                      {loading && connectingWallet === wallet.type && (
                        <div className={styles['loading-overlay']}>
                          <Loading
                            description={t('wallet.connecting')}
                            withOverlay={false}
                            small
                          />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Undetected Wallets */}
            {undetectedWallets.length > 0 && (
              <div>
                <h3 className={styles['section-heading']}>
                  {hasDetectedWallets ? t('wallet.otherWallets') : t('wallet.noWalletsDetected')}
                </h3>
                
                {!hasDetectedWallets && (
                  <div className={styles['warning-container']}>
                    <div className={styles['warning-content']}>
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-yellow-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className={styles['warning-text-wrapper']}>
                        <h3 className={styles['warning-title']}>
                          {t('wallet.noWalletsFound', { blockchain: 'Solana' })}
                        </h3>
                        <p className={styles['warning-message']}>
                          {t('wallet.installWalletPrompt')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles['wallet-grid']}>
                  {undetectedWallets.map((wallet) => (
                    <a
                      key={wallet.type}
                      href={wallet.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles['install-link']}
                    >
                      {/* Wallet Icon */}
                      <div className={styles['wallet-icon-container']}>
                        {wallet.icon ? (
                          <img
                            src={wallet.icon}
                            alt={wallet.name}
                            className={styles['uninstalled-icon']}
                          />
                        ) : (
                          <Wallet size={48} className={styles['wallet-icon-fallback']} />
                        )}
                      </div>

                      {/* Wallet Name */}
                      <span className={styles['uninstalled-wallet-name']}>
                        {wallet.name}
                      </span>

                      {/* Install Link */}
                      <span className={styles['install-text']}>
                        {t('wallet.install')}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Help Text */}
        {!detectingWallets && !error && hasDetectedWallets && (
          <div className={styles['help-text-container']}>
            <p className={styles['help-text']}>
              {t('wallet.termsAgreement')}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
