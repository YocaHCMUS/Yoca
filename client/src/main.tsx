import { GoogleOAuthProvider } from "@react-oauth/google";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App.tsx";
import { ChartProvider } from "./contexts/ChartContext";
import { LocalizationProvider } from "./contexts/LocalizationContext.tsx";
import { SolanaProvider } from "./contexts/SolanaWalletContext.tsx";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./i18n/config.ts";
import "./index.scss";
import "./styles/carbon.scss";
import "./styles/theme.scss";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID!;

function Root() {
  return (
    <StrictMode>
      <GoogleOAuthProvider clientId={googleClientId}>
        <ThemeProvider>
          <SolanaProvider>
            <LocalizationProvider>
              <ChartProvider>
                <App />
              </ChartProvider>
            </LocalizationProvider>
          </SolanaProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
