/**
 * PageWrapper Component
 * Wraps pages with header and auth modal interactions
 */

import React, { useState } from 'react';
import Header from '../navigation/Header';
import { SignInForm } from '../auth/SignInForm';
import { SignUpForm } from '../auth/SignUpForm';
import { WalletModal } from '../auth/WalletModal';
import { Modal, Theme } from '@carbon/react';
import { useTheme } from '../../contexts/ThemeContext';
import styles from './PageWrapper.module.scss'


interface PageWrapperProps {
    children: React.ReactNode;
    onNavigate?: (path: string) => void;
}

/**
 * PageWrapper Component
 * Provides header with authentication modals
 */
export const PageWrapper: React.FC<PageWrapperProps> = ({ children, onNavigate }) => {
    const { theme } = useTheme();
    const [signInModalOpen, setSignInModalOpen] = useState(false);
    const [signUpModalOpen, setSignUpModalOpen] = useState(false);
    const [walletModalOpen, setWalletModalOpen] = useState(false);
    const [walletModalMode, setWalletModalMode] = useState<'signin' | 'signup'>('signin');

    /**
     * Handle opening sign in modal
     */
    const handleOpenSignIn = () => {
        setSignUpModalOpen(false);
        setWalletModalOpen(false);
        setSignInModalOpen(true);
    };

    /**
     * Handle opening sign up modal
     */
    const handleOpenSignUp = () => {
        setSignInModalOpen(false);
        setWalletModalOpen(false);
        setSignUpModalOpen(true);
    };

    /**
     * Handle opening wallet modal
     */
    const handleOpenWalletModal = (mode: 'signin' | 'signup') => {
        setWalletModalMode(mode);
        setSignInModalOpen(false);
        setSignUpModalOpen(false);
        setWalletModalOpen(true);
    };

    /**
     * Handle closing all modals
     */
    const handleCloseModals = () => {
        setSignInModalOpen(false);
        setSignUpModalOpen(false);
        setWalletModalOpen(false);
    };

    /**
     * Handle successful authentication
     */
    const handleAuthSuccess = () => {
        handleCloseModals();
        if (onNavigate) {
        onNavigate('/dashboard');
        }
    };

    return (
        <Theme theme={theme === 'dark' ? 'g100' : 'white'}>
            <div className={styles.pageWrapper}>
            <Header
                onNavigate={onNavigate}
                handleSignIn={handleOpenSignIn}
                handleSignUp={handleOpenSignUp}
            />
            
            <main className={styles.pageContent}>
                {children}
            </main>

            {/* Sign In Modal */}
            <Modal
                open={signInModalOpen}
                onRequestClose={handleCloseModals}
                passiveModal
                className={styles.authModal}
                size="sm"
            >
                <SignInForm
                onSuccess={handleAuthSuccess}
                onOpenWalletModal={() => handleOpenWalletModal('signin')}
                onNavigateToSignUp={handleOpenSignUp}
                />
            </Modal>

            {/* Sign Up Modal */}
            <Modal
                open={signUpModalOpen}
                onRequestClose={handleCloseModals}
                passiveModal
                className={styles.authModal}
                size="sm"
            >
                <SignUpForm
                onSuccess={handleAuthSuccess}
                onOpenWalletModal={() => handleOpenWalletModal('signup')}
                onNavigateToSignIn={handleOpenSignIn}
                />
            </Modal>

            {/* Wallet Modal */}
            <WalletModal
                open={walletModalOpen}
                onClose={handleCloseModals}
                mode={walletModalMode}
            />
            </div>
        </Theme>
    );
};

export default PageWrapper;
