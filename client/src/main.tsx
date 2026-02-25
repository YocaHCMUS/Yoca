import { GoogleOAuthProvider } from "@react-oauth/google";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App.tsx";
import { ID_MODAL_ROOT } from "./config/constants.ts";
import { ChartProvider } from "./contexts/ChartContext";
import { LocalizationProvider } from "./contexts/LocalizationContext.tsx";
import { SolanaProvider } from "./contexts/SolanaWalletContext.tsx";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./i18n/config.ts";
import "./index.scss";
import "./styles/carbon.scss";
import "./styles/theme.scss";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID!;

function ModalRoot() {
  return <div id={ID_MODAL_ROOT}></div>;
}

function Root() {
  return (
    <StrictMode>
      <ThemeProvider>
        <GoogleOAuthProvider clientId={googleClientId}>
          <SolanaProvider>
            <LocalizationProvider>
              <ChartProvider>
                <App />
              </ChartProvider>
            </LocalizationProvider>
          </SolanaProvider>
        </GoogleOAuthProvider>
        <ModalRoot />
      </ThemeProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
