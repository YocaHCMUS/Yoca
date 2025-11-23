/**
 * WalletModal Component
 * Modal for wallet selection and connection with blockchain support
 * Features: Focus trapping, keyboard navigation (Tab, Escape), ARIA labels
 */

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Select, SelectItem, Loading } from '@carbon/react';
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
  const [selectedBlockchain, setSelectedBlockchain] = useState<BlockchainType>('solana');
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
  }, [open, selectedBlockchain]);

  const loadWallets = async () => {
    setDetectingWallets(true);
    setError('');
    try {
      const detectedWallets = await detectWallets(selectedBlockchain);
      setWallets(detectedWallets);
    } catch (err) {
      setError(t('wallet.detectionFailed'));
      console.error('Wallet detection error:', err);
    } finally {
      setDetectingWallets(false);
    }
  };

  const handleWalletSelect = async (walletType: WalletType) => {
    setConnectingWallet(walletType);
    setError('');
    setLoading(true);

    try {
      const response = await connectWallet(walletType, selectedBlockchain);

      if (response.success && response.user && response.token) {
        // Login successful - state is managed by AuthContext
        onClose();
      } else {
        // Connection failed
        setError(response.error || t('wallet.connectionFailed'));
      }
    } catch (err) {
      setError(t('validation.networkError'));
      console.error('Wallet connection error:', err);
    } finally {
      setLoading(false);
      setConnectingWallet(null);
    }
  };

  const handleRetry = () => {
    setError('');
    if (connectingWallet) {
      handleWalletSelect(connectingWallet);
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
    walletType: WalletType
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleWalletSelect(walletType);
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
      modalLabel={t('wallet.web3Auth')}
      passiveModal={false}
      primaryButtonText={error ? t('wallet.retry') : undefined}
      secondaryButtonText={t('common.cancel')}
      onRequestSubmit={error ? handleRetry : undefined}
      preventCloseOnClickOutside={loading}
      className={styles.walletModal}
      size="md"
      aria-label={t('wallet.modal.title', 'Wallet Connection Modal')}
      aria-describedby="wallet-modal-description"
    >
      <div className="space-y-4" id="wallet-modal-description">
        {/* Blockchain Selector */}
        <div className="mb-6">
          <Select
            id="blockchain-selector"
            labelText={t('wallet.selectBlockchain')}
            value={selectedBlockchain}
            onChange={(e) => setSelectedBlockchain(e.target.value as BlockchainType)}
            disabled={loading || detectingWallets}
            className="w-full"
          >
            <SelectItem value="solana" text={t('wallet.solana')} />
            <SelectItem value="ethereum" text={t('wallet.ethereum')} />
            <SelectItem value="bitcoin" text={t('wallet.bitcoin')} />
          </Select>
        </div>

        {/* Loading State - Detecting Wallets */}
        {detectingWallets && (
          <div className="flex flex-col items-center justify-center py-8" role="status" aria-live="polite">
            <Loading description={t('wallet.detectingWallets')} withOverlay={false} />
            <p className="mt-4 text-sm text-gray-600" aria-label={t('wallet.scanningWallets', { blockchain: selectedBlockchain.charAt(0).toUpperCase() + selectedBlockchain.slice(1) })}>
              {t('wallet.scanningWallets', { blockchain: selectedBlockchain.charAt(0).toUpperCase() + selectedBlockchain.slice(1) })}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !detectingWallets && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4" role="alert" aria-live="assertive">
            <div className="flex items-start">
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
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{t('wallet.connectionFailed')}</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Wallet List */}
        {!detectingWallets && !error && (
          <>
            {/* Detected Wallets */}
            {hasDetectedWallets && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t('wallet.detectedWallets')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {detectedWallets.map((wallet, index) => (
                    <button
                      key={wallet.type}
                      ref={index === 0 ? firstWalletButtonRef : null}
                      onClick={() => handleWalletSelect(wallet.type)}
                      onKeyDown={(e) => handleWalletKeyDown(e, wallet.type)}
                      disabled={loading}
                      aria-label={t('wallet.connectWith', { wallet: wallet.name })}
                      aria-busy={loading && connectingWallet === wallet.type}
                      className={`
                        relative flex flex-col items-center justify-center p-4 
                        border-2 rounded-lg transition-all duration-200
                        ${
                          loading && connectingWallet === wallet.type
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                        }
                        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      {/* Detected Badge */}
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {t('wallet.detected')}
                        </span>
                      </div>

                      {/* Wallet Icon */}
                      <div className="mb-2">
                        {wallet.icon ? (
                          <img
                            src={wallet.icon}
                            alt={wallet.name}
                            className="w-12 h-12 object-contain"
                          />
                        ) : (
                          <Wallet size={48} className="text-gray-400" />
                        )}
                      </div>

                      {/* Wallet Name */}
                      <span className="text-sm font-medium text-gray-900">
                        {wallet.name}
                      </span>

                      {/* Loading Indicator */}
                      {loading && connectingWallet === wallet.type && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
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
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {hasDetectedWallets ? t('wallet.otherWallets') : t('wallet.noWalletsDetected')}
                </h3>
                
                {!hasDetectedWallets && (
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-start">
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
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          {t('wallet.noWalletsFound', { blockchain: selectedBlockchain.charAt(0).toUpperCase() + selectedBlockchain.slice(1) })}
                        </h3>
                        <p className="mt-1 text-sm text-yellow-700">
                          {t('wallet.installWalletPrompt')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {undetectedWallets.map((wallet) => (
                    <a
                      key={wallet.type}
                      href={wallet.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                        flex flex-col items-center justify-center p-4 
                        border-2 border-gray-200 rounded-lg 
                        hover:border-gray-400 hover:bg-gray-50
                        transition-all duration-200 cursor-pointer
                        opacity-60 hover:opacity-100
                      "
                    >
                      {/* Wallet Icon */}
                      <div className="mb-2">
                        {wallet.icon ? (
                          <img
                            src={wallet.icon}
                            alt={wallet.name}
                            className="w-12 h-12 object-contain grayscale"
                          />
                        ) : (
                          <Wallet size={48} className="text-gray-400" />
                        )}
                      </div>

                      {/* Wallet Name */}
                      <span className="text-sm font-medium text-gray-700">
                        {wallet.name}
                      </span>

                      {/* Install Link */}
                      <span className="text-xs text-blue-600 mt-1">
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
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              {t('wallet.termsAgreement')}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
