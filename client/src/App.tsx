import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useNavigation,
} from "react-router";

import {
  DataTable,
  Loading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import { Component, type ReactNode } from "react";
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
import Tble from "./components/Tble";
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
      <Loading
        active={isLoading}
        description={tr("common.loading")}
        withOverlay
      />
      <Outlet />
    </>
  );
}

const headers = [
  { key: "col1", header: "Column 1" },
  { key: "col2", header: "Column 2" },
  { key: "col3", header: "Column 3" },
  { key: "col4", header: "Column 4" },
  { key: "col5", header: "Column 5" },
  { key: "col6", header: "Column 6" },
  { key: "col7", header: "Column 7" },
  { key: "col8", header: "Column 8" },
  { key: "col9", header: "Column 9" },
  { key: "col10", header: "Column 10" },
];

const rows = Array.from({ length: 20 }, (_, i) => ({
  id: `row-${i}`,
  col1: `Data ${i}-1`,
  col2: `Data ${i}-2`,
  col3: `Data ${i}-3`,
  col4: `Data ${i}-4`,
  col5: `Data ${i}-5`,
  col6: `Data ${i}-6`,
  col7: `Data ${i}-7`,
  col8: `Data ${i}-8`,
  col9: `Data ${i}-9`,
  col10: `Data ${i}-10`,
}));

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

      {
        path: "tbl-fix",
        element: (
          <>
            <Tble
              headers={headers}
              rows={rows}
              stickyHeader
              height={200}
            ></Tble>
            <div style={{ width: 700, overflow: "auto", height: 200 }}>
              <DataTable rows={rows} headers={headers} stickyHeader>
                {({
                  rows,
                  headers,
                  getTableProps,
                  getHeaderProps,
                  getRowProps,
                  getCellProps,
                }) => (
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader {...getHeaderProps({ header })}>
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow {...getRowProps({ row })}>
                          {row.cells.map((cell) => (
                            <TableCell {...getCellProps({ cell })}>
                              {cell.value}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </DataTable>
            </div>
          </>
        ),
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
