import { GoogleOAuthProvider } from "@react-oauth/google";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App.tsx";
import { ID_MODAL_ROOT } from "./config/constants.ts";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { ChartProvider } from "./contexts/ChartContext";
import { LocalizationProvider } from "./contexts/LocalizationContext.tsx";
import { SolanaProvider } from "./contexts/SolanaWalletContext.tsx";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WatchlistProvider } from "./contexts/WatchlistContext";
import { ToastProvider } from "@/components/common/Toast";
import "./index.scss";
import "./styles/carbon.scss";
import "./styles/theme.scss";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID!;

function ModalRoot() {
  return <div id={ID_MODAL_ROOT}></div>;
}

function Root() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GoogleOAuthProvider clientId={googleClientId}>
          <SolanaProvider>
            <LocalizationProvider>
              <WatchlistProvider>
                <ChartProvider>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </ChartProvider>
              </WatchlistProvider>
            </LocalizationProvider>
          </SolanaProvider>
        </GoogleOAuthProvider>
        <ModalRoot />
      </AuthProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
