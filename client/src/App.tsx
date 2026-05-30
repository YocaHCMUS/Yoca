import {
    createBrowserRouter,
    Outlet,
    RouterProvider,
    useNavigation,
} from "react-router";

import { Loading } from "@carbon/react";
import "./App.css";

import Index from "@/pages";
import AlertsPage from "@/pages/alerts";
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
import AlertsDemo from "./pages/alerts/demo";

import { AuthGuard } from "./components/auth";
import { useLocalization } from "./contexts/LocalizationContext";

function RootLayout() {
  const navigation = useNavigation();
  const { tr } = useLocalization();

  const isLoading =
    navigation.state == "loading" || navigation.state == "submitting";

  return (
    <>
      <Loading
        active={isLoading}
        description={tr("common.loading")}
        withOverlay
      />
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
        element: <WalletsComparisonPage />,
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
