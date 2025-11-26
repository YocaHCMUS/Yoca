import { useState } from "react";
import { Header } from "../../components/navigation";
import { SignInForm, SignUpForm, WalletModal } from "../../components/auth";
import { Button, Grid, Column, Theme } from "@carbon/react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";


import { PageWrapper } from "../../components/wrapper";

export default function AuthShowcase() {
  const { t } = useTranslation();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  return (
    // <div className={styles.authShowcase}>
    //   {/* Navigation Header */}
    //   <Header />

    //   {/* Main Content */}
    //   <main className={styles.mainContent}>
    //     <Grid className={styles.grid}>
    //       {/* Hero Section */}
    //       <Column lg={16} md={8} sm={4} className={styles.hero}>
    //         <h1 className={styles.title}>
    //           {t("auth.showcase.title", "Authentication Components Showcase")}
    //         </h1>
    //         <p className={styles.subtitle}>
    //           {t(
    //             "auth.showcase.subtitle",
    //             "Interactive demonstration of authentication UI components with Carbon Design System"
    //           )}
    //         </p>
    //       </Column>

    //       {/* Tab Navigation */}
    //       <Column lg={16} md={8} sm={4} className={styles.tabContainer}>
    //         <div className={styles.tabs}>
    //           <button
    //             className={`${styles.tab} ${activeTab === "signin" ? styles.active : ""}`}
    //             onClick={() => setActiveTab("signin")}
    //           >
    //             {t("auth.signIn.title", "Sign In")}
    //           </button>
    //           <button
    //             className={`${styles.tab} ${activeTab === "signup" ? styles.active : ""}`}
    //             onClick={() => setActiveTab("signup")}
    //           >
    //             {t("auth.signUp.title", "Sign Up")}
    //           </button>
    //         </div>
    //       </Column>

    //       {/* Authentication Forms */}
    //       <Column lg={8} md={8} sm={4} className={styles.formColumn}>
    //         {activeTab === "signin" && (
    //           <div className={styles.formSection}>

    //             <SignInForm />
    //           </div>
    //         )}

    //         {activeTab === "signup" && (
    //           <div className={styles.formSection}>
    //             <SignUpForm />
    //           </div>
    //         )}
    //       </Column>

    //       {/* Wallet Modal Demo */}
    //       <Column lg={8} md={8} sm={4} className={styles.demoColumn}>
    //         <div className={styles.walletDemo}>
    //           <h2 className={styles.sectionTitle}>
    //             {t("wallet.modal.title", "Wallet Connection")}
    //           </h2>
    //           <p className={styles.sectionDescription}>
    //             {t(
    //               "wallet.modal.description",
    //               "Connect your Solana wallet to authenticate with Web3"
    //             )}
    //           </p>
    //           <Button
    //             kind="tertiary"
    //             size="lg"
    //             onClick={() => setShowWalletModal(true)}
    //           >
    //             {t("wallet.modal.openDemo", "Open Wallet Modal Demo")}
    //           </Button>
    //           <div className={styles.walletFeatures}>
    //             <h3 className={styles.featuresTitle}>
    //               {t("wallet.features.title", "Features")}
    //             </h3>
    //             <ul className={styles.featuresList}>
    //               <li>{t("wallet.features.detection", "Automatic wallet detection")}</li>
    //               <li>{t("wallet.features.multiWallet", "Multi-wallet support (Phantom, Solflare, Backpack, Glow)")}</li>
    //               <li>{t("wallet.features.installation", "Installation guidance for missing wallets")}</li>
    //               <li>{t("wallet.features.errorHandling", "Error handling and retry logic")}</li>
    //             </ul>
    //           </div>
    //         </div>
    //       </Column>

    //       {/* Component Features */}
    //       <Column lg={16} md={8} sm={4} className={styles.featuresSection}>
    //         <h2 className={styles.sectionTitle}>
    //           {t("auth.showcase.features", "Component Features")}
    //         </h2>
    //         <Grid className={styles.featuresGrid}>
    //           <Column lg={5} md={4} sm={4}>
    //             <div className={styles.featureCard}>
    //               <h3>{t("auth.showcase.validation", "Form Validation")}</h3>
    //               <p>
    //                 {t(
    //                   "auth.showcase.validationDesc",
    //                   "Real-time validation with Zod schemas and clear error messages"
    //                 )}
    //               </p>
    //             </div>
    //           </Column>
    //           <Column lg={5} md={4} sm={4}>
    //             <div className={styles.featureCard}>
    //               <h3>{t("auth.showcase.i18n", "Internationalization")}</h3>
    //               <p>
    //                 {t(
    //                   "auth.showcase.i18nDesc",
    //                   "Support for English, Vietnamese, and Japanese languages"
    //                 )}
    //               </p>
    //             </div>
    //           </Column>
    //           <Column lg={6} md={4} sm={4}>
    //             <div className={styles.featureCard}>
    //               <h3>{t("auth.showcase.accessibility", "Accessibility")}</h3>
    //               <p>
    //                 {t(
    //                   "auth.showcase.accessibilityDesc",
    //                   "WCAG 2.1 AA compliant with keyboard navigation and screen reader support"
    //                 )}
    //               </p>
    //             </div>
    //           </Column>
    //         </Grid>
    //       </Column>
    //     </Grid>
    //   </main>

    //   {/* Wallet Modal */}
    //   {showWalletModal && (
    //     <WalletModal
    //       open={showWalletModal}
    //       onClose={() => setShowWalletModal(false)}
    //     />
    //   )}
    // </div>  {/* g10, g90, g100 */}
    <PageWrapper
      onNavigate={(path) => console.log(path)}>
      <h1>Hello World</h1>

      {/* <div
        className={styles.mainContent}
      > 
        <h1>Hello World</h1>
      </div> */}
    </PageWrapper>
  );
}
