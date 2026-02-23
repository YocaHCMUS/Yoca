import { BrowserRouter, Route, Routes } from "react-router";
import "./App.css";

import "@solana/wallet-adapter-react-ui/styles.css";
import Index from "./pages";
import AuthShowcase from "./pages/auth";
import { WalletAuthenButton } from "./pages/auth_demo";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<AuthShowcase />} />
        <Route path="/auth_demo" element={<WalletAuthenButton />} />
        {/* <Route path="/google_auth_demo" element={<GoogleAuthDemo />} /> */}
        {/* <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/tokens" element={<TokenPage />} /> 
        <Route path="/tokens/:address" element={<TokenPage />} />
        <Route path="/tokens/:address/:poolAddress" element={<TokenPage />} /> */}
        {/* <Route path="/wallets/:address" element={<WalletPage />} /> */}
        {/* <Route
          path="/comparision/wallets"
          element={<WalletsComparisionPage />}
        /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
