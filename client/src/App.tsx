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
import WalletIssuesBalanceV1Page from "@/pages/wallet-issues-v1";
import WalletIssuesBalanceV2Page from "@/pages/wallet-issues-v2";
import WalletsComparisonPage from "@/pages/walletsComparison";
import PricingPage from "@/pages/pricing";
import { Component, type ReactNode } from "react";
import { AuthGuard } from "./components/auth";
import AlertsDemo from "./pages/alerts/demo";

/** Catches render errors inside route elements so a silent crash does not
 *  abort the React Router transition (leaving the old page mounted). */
class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[RouteErrorBoundary] Caught render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", color: "red" }}>
          <h2>Something went wrong loading this page.</h2>
          <pre style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<AuthShowcase />} />
        <Route path="/pricing" element={<PricingPage />} />
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
        {/* /comparison/wallets must be declared before /wallets/:address to avoid ambiguity */}
        <Route
          path="/comparison/wallets"
          element={
            <RouteErrorBoundary>
              <WalletsComparisonPage />
            </RouteErrorBoundary>
          }
        />
        <Route path="/wallets/:address" element={<WalletPage />} />
        <Route
          path="/wallet-issues/v1"
          element={<WalletIssuesBalanceV1Page />}
        />
        <Route
          path="/wallet-issues/v2"
          element={<WalletIssuesBalanceV2Page />}
        />
        <Route path="/secret-admin-dashboard" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
