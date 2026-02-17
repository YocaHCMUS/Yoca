import { GoogleOAuthProvider } from "@react-oauth/google";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { ChartProvider } from "./contexts/ChartContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./i18n/config";
import "./index.scss";
import "./styles/carbon.scss";
import "./styles/theme.scss";

// Import Solana wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

const apiDomain: string = import.meta.env.CLIENT_API_DOMAIN;
console.log(`API Domain in client 1: ${apiDomain}`);

// Google OAuth Client ID from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
console.log("Client ID hiện tại:", import.meta.env.VITE_GOOGLE_CLIENT_ID);

/**
 * Root component with all providers configured
 */
function Root() {
  // Configure Solana network (devnet for development)
  const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
  const endpoint = useMemo(() => {
    const endpoints: Record<string, string> = {
      "mainnet-beta": "https://api.mainnet-beta.solana.com",
      mainnet: "https://api.mainnet-beta.solana.com",
      devnet: "https://api.devnet.solana.com",
      testnet: "https://api.testnet.solana.com",
    };
    return endpoints[network] || endpoints.devnet;
  }, [network]);

  // Configure wallet adapters
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect={false}>
            <WalletModalProvider>
              <ThemeProvider>
                <AuthProvider>
                  <ChartProvider>
                    <App />
                  </ChartProvider>
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
