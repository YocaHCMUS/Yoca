import { BrowserRouter, Route, Routes } from "react-router";
import "./App.css";

import Index from "./pages";
import AuthShowcase from "./pages/auth";
import HistoricalDataPage from "./pages/historical-data";
import MarketPage from "./pages/market";
import TokenPage from "./pages/token";
import TokenOverviewPage from "./pages/token-overview";
import { TransactionGraphDemo } from "./pages/transactions/TransactionGraphDemo";
import WalletPage from "./pages/wallet";
import { TokenDetailsDemo } from "./pages/wallet/TokenDetailsDemo";
import WalletsComparisionPage from "./pages/walletsComparision";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<AuthShowcase />} />
        {/* <Route path="/dashboard" element={<DashboardPage />} /> */}
        <Route path="/market" element={<MarketPage />} />
        <Route path="/tokens" element={<TokenPage />} />
        <Route path="/tokens/:address" element={<TokenOverviewPage />} />
        <Route path="/tokens/:address/:poolAddress" element={<TokenPage />} />
        <Route
          path="/historical-data/:address"
          element={<HistoricalDataPage />}
        />
        <Route
          path="/wallets/:address/token-details-demo"
          element={<TokenDetailsDemo />}
        />
        <Route
          path="/transactions/:txHash/graph-demo"
          element={<TransactionGraphDemo />}
        />
        <Route path="/wallets/:address" element={<WalletPage />} />
        <Route
          path="/comparision/wallets"
          element={<WalletsComparisionPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
