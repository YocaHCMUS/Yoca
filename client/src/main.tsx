import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./App.css";
import "./index.scss";
import "./styles/carbon.scss";
import "./styles/theme.scss";
import "./i18n/config";

// Import Solana wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

const apiDomain: string = import.meta.env.CLIENT_API_DOMAIN;
console.log(`API Domain in client 1: ${apiDomain}`);

// Google OAuth Client ID from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

/**
 * Root component with all providers configured
 */
function Root() {
  // Configure Solana network (devnet for development)
  const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
  const endpoint = useMemo(() => clusterApiUrl(network as any), [network]);
  
  // Configure wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect={false}>
            <WalletModalProvider>
              <ThemeProvider>
                <AuthProvider>
                  <App />
                </AuthProvider>
              </ThemeProvider>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </GoogleOAuthProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
