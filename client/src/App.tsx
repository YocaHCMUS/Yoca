import { BrowserRouter, Route, Routes } from "react-router";
import "./App.css";

import Index from "./pages";
import AuthShowcase from "./pages/auth";
import DashboardPage from "./pages/dashboard";
import MarketPage from "./pages/market";
import TokenPage from "./pages/token";
import WalletPage from "./pages/wallet";
import WalletsComparisionPage from "./pages/walletsComparision";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<AuthShowcase />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/tokens" element={<TokenPage />} />
        <Route path="/tokens/:address" element={<TokenPage />} />
        <Route path="/wallets/:address" element={<WalletPage />} />
        <Route path="/comparision/wallets" element={<WalletsComparisionPage/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
