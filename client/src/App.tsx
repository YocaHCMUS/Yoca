import { BrowserRouter, Routes, Route } from "react-router";
import "./App.css";

import Index from "./pages";
import AuthShowcase from "./pages/auth";
import DashboardPage from "./pages/dashboard";
import OverviewPage from "./pages/overview";
import MarketPage from "./pages/market";
import TokenPage from "./pages/token";
import WalletPage from "./pages/wallet";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<AuthShowcase />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/market" element={<MarketPage />} /> {/* Add this route */}
        <Route path="/tokens" element={<TokenPage />} />
        <Route path="/wallet/:address" element={<WalletPage address="" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
