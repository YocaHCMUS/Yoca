import { RouterProvider } from "react-router-dom";
import { createBrowserRouter, Outlet, useNavigation } from "react-router";

import { Loading } from "@carbon/react";
import { Component, type ReactNode } from "react";

import "./App.css";

import Index from "@/pages";
import AlertsPage from "@/pages/alerts";
import AlertsDemo from "./pages/alerts/demo";
import HistoricalDataPage from "@/pages/historical-data";
import MarketPage from "@/pages/market";
import NotFoundPage from "@/pages/not-found";
import PricingPage from "@/pages/pricing";
import ProfilePage from "@/pages/profile";
import TokenPage from "@/pages/token";
import TokenOverviewPage from "@/pages/token-overview";
import TransactionGraphPage from "@/pages/transactions";
import UnauthorizedPage from "@/pages/unauthorized";
import WalletPage from "@/pages/wallet";
import WalletsComparisonPage from "@/pages/walletsComparison";

import { AuthGuard } from "./components/auth";
import { useLocalization } from "./contexts/LocalizationContext";

// Prevent route crashes from breaking router transitions
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
    console.error("RouteErrorBoundary: Caught render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", color: "red" }}>
          <h2>Something went wrong loading this page.</h2>

          <pre
            style={{
              fontSize: "0.8rem",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function RootLayout() {
  const navigation = useNavigation();
  const { tr } = useLocalization();

  const isLoading =
    navigation.state == "loading" || navigation.state == "submitting";

  return (
    <>
      <Loading active={isLoading} description={tr("common.loading")} withOverlay />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,

    children: [
      {
        index: true,
        element: <Index />,
      },

      {
        path: "pricing",
        element: <PricingPage />,
      },

      {
        path: "unauthorized",
        element: <UnauthorizedPage />,
      },

      {
        path: "market",
        element: <MarketPage />,
      },

      {
        path: "alerts",
        element: <AlertsPage />,
      },

      {
        path: "alerts/demo",
        element: (
          <AuthGuard>
            <AlertsDemo />
          </AuthGuard>
        ),
      },

      {
        path: "profile",
        element: (
          <AuthGuard>
            <ProfilePage />
          </AuthGuard>
        ),
      },

      {
        path: "tokens",
        element: <TokenPage />,
      },

      {
        path: "tokens/:address",
        element: <TokenOverviewPage />,
      },

      {
        path: "tokens/:address/:poolAddress",
        element: <TokenPage />,
      },

      {
        path: "historical-data/:address",
        element: <HistoricalDataPage />,
      },

      {
        path: "transactions",
        element: <TransactionGraphPage />,
      },

      {
        path: "transactions/:txHash",
        element: <TransactionGraphPage />,
      },

      {
        path: "comparison/wallets",
        element: (
          <RouteErrorBoundary>
            <WalletsComparisonPage />
          </RouteErrorBoundary>
        ),
      },

      {
        path: "wallets/:address",
        element: <WalletPage />,
      },

      {
        path: "secret-admin-dashboard",
        element: <UnauthorizedPage />,
      },

      {
        path: "not-found",
        element: <NotFoundPage />,
      },

      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
