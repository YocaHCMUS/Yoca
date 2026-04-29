import { BrowserRouter, Route, Routes } from "react-router";
import "./App.css";

import Index from "@/pages";
import AlertsPage from "@/pages/alerts";
import AuthShowcase from "@/pages/auth";
import HistoricalDataPage from "@/pages/historical-data";
import MarketPage from "@/pages/market";
import NotFoundPage from "@/pages/not-found";
import ProfilePage from "@/pages/profile";
import TokenPage from "@/pages/token";
import TokenOverviewPage from "@/pages/token-overview";
import TransactionGraphPage from "@/pages/transactions";
import UnauthorizedPage from "@/pages/unauthorized";
import WalletPage from "@/pages/wallet";
import WalletsComparisionPage from "@/pages/walletsComparision";
import { AuthGuard } from "./components/auth";
import AlertsDemo from "./pages/alerts/demo";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<AuthShowcase />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/test-401" element={<UnauthorizedPage />} />
        {/* <Route path="/dashboard" element={<DashboardPage />} /> */}
        <Route path="/market" element={<MarketPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/tokens" element={<TokenPage />} />
        <Route
          path="/alerts/demo"
          element={
            <AuthGuard>
              <AlertsDemo />
            </AuthGuard>
          }
        />
        <Route path="/tokens/:address" element={<TokenOverviewPage />} />
        <Route path="/tokens/:address/:poolAddress" element={<TokenPage />} />
        <Route
          path="/historical-data/:address"
          element={<HistoricalDataPage />}
        />
        <Route path="/transactions" element={<TransactionGraphPage />} />
        <Route
          path="/transactions/:txHash"
          element={<TransactionGraphPage />}
        />
        <Route path="/wallets/:address" element={<WalletPage />} />
        <Route
          path="/comparision/wallets"
          element={<WalletsComparisionPage />}
        />
        <Route
          path="/secret-admin-dashboard"
          element={<UnauthorizedPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
