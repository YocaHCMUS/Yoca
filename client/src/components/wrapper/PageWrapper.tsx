import { Modal } from "@carbon/react";
import React, { useState } from "react";
import { useNavigate } from "react-router";
import { SignInForm } from "../auth/SignInForm";
import { SignUpForm } from "../auth/SignUpForm";
import { WalletModal } from "../auth/WalletModal";
import Header from "../navigation/Header";
import styles from "./PageWrapper.module.scss";

interface PageWrapperProps {
  children: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ children }) => {
  const navigate = useNavigate();
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [signUpModalOpen, setSignUpModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalMode, setWalletModalMode] = useState<"signin" | "signup">(
    "signin",
  );

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
  const handleOpenWalletModal = (mode: "signin" | "signup") => {
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
    navigate("/dashboard");
  };

  return (
    <div className={styles.pageWrapper}>
      <Header
        onNavigate={navigate}
        handleSignIn={handleOpenSignIn}
        handleSignUp={handleOpenSignUp}
      />

      <main className={styles.pageContent}>{children}</main>

      {/* Sign In Modal */}
      <Modal
        open={signInModalOpen}
        onRequestClose={handleCloseModals}
        passiveModal
        className={styles.authModal}
        size="lg"
      >
        <SignInForm
          onSuccess={handleAuthSuccess}
          onOpenWalletModal={() => handleOpenWalletModal("signin")}
          onNavigateToSignUp={handleOpenSignUp}
        />
      </Modal>

      {/* Sign Up Modal */}
      <Modal
        open={signUpModalOpen}
        onRequestClose={handleCloseModals}
        passiveModal
        className={styles.authModal}
        size="lg"
      >
        <SignUpForm
          onSuccess={handleAuthSuccess}
          onOpenWalletModal={() => handleOpenWalletModal("signup")}
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
  );
};

export default PageWrapper;
