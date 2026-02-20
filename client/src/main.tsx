import { GoogleOAuthProvider } from "@react-oauth/google";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext";
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
        <SolanaProvider>
          <ThemeProvider>
            <LocalizationProvider>
              <AuthProvider>
                <ChartProvider>
                  <App />
                </ChartProvider>
              </AuthProvider>
            </LocalizationProvider>
          </ThemeProvider>
        </SolanaProvider>
      </GoogleOAuthProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
