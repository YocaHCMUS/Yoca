import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { ExchangeComparison } from "@/components/charts/ExchangeComparison/ExchangeComparison.tsx";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart.tsx";
import { TransactionDistribution } from "@/components/charts/TransactionDistribution/TransactionDistribution.tsx";
import TabContainer from "@/components/TabContainer/tabContainer.tsx";
import { FilterType, SortType, Table } from "@/components/tables/Table.tsx";
import {
  renderBinaryValue,
  renderBold,
  renderCode,
  renderCurrency,
  renderDateTime,
  renderPositiveNegative,
  renderStatus,
} from "@/components/tables/TableCellRenderer.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { formatNumber } from "../../util/format.ts";
import styles from "./index.module.scss";

// temporary interfaces
interface Transaction {
  id: string;
  signature: string;
  type: "Buy" | "Sell";
  token: string;
  amount: number;
  price: number;
  total: number;
  timestamp: string;
  status: "Success" | "Failed";
}

interface Portfolio {
  token: string;
  price: number;
  holding: number;
  value: number;
  change: number; // change in % in 24h
}

export default function WalletPage() {
  const { t } = useTranslation();
  const { address } = useParams<{ address: string }>();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(0);
  const [secondaryActiveTab, setSecondaryActiveTab] = useState(0); // TODO: implement a hook to scale these state

  // Mock data - replace with actual API call
  const transactions: Transaction[] = Array.from({ length: 50 }, (_, i) => ({
    id: `tx-${i}`,
    signature: `${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
    type: i % 2 === 0 ? "Buy" : "Sell",
    token: ["SOL", "USDC", "JTO", "BONK"][i % 4],
    amount: Math.random() * 1000,
    price: Math.random() * 200,
    total: Math.random() * 10000,
    timestamp: new Date(
      Date.now() - Math.random() * 86400000 * 30,
    ).toISOString(),
    status: i % 10 === 0 ? "Failed" : "Success",
  }));

  const portfolios: Portfolio[] = Array.from({ length: 50 }, (_, i) => {
    const prices = [
      Math.random() * 200,
      Math.random() * 200,
      Math.random() * 200,
      Math.random() * 200,
    ];
    const holding = Math.random() * 999 + 0.001;
    const index = i % 4;
    return {
      token: ["SOL", "USDC", "JTO", "BONK"][index],
      price: prices[index],
      holding: holding,
      value: prices[index] * holding,
      change: (Math.random() - 0.5) * 20, // Random change between -10% and +10%
    };
  });

  // Transform transactions to array format for Table component
  const transactionData = transactions.map((tx) => [
    tx.signature,
    tx.type,
    tx.token,
    tx.amount.toFixed(4),
    tx.price.toFixed(2),
    tx.total.toFixed(2),
    tx.timestamp,
    tx.status,
  ]);

  const portfolioData = portfolios.map((prt) => [
    prt.token,
    prt.price.toFixed(2),
    `${prt.holding.toFixed(4)} ${prt.token}`,
    prt.value.toFixed(4),
    prt.change.toFixed(2),
  ]);

  const transactionHeaders = [
    "Signature",
    "Type",
    "Token",
    "Amount",
    "Price",
    "Total",
    "Time",
    "Status",
  ];

  const portfolioHeaders = [
    "Token",
    "Price",
    "Holding",
    "Value",
    "Change (24h)",
  ];

  const isSortable = [false, false, false, true, true, true, true, false];
  const isSortablePortfolio = [false, true, true, true, true];

  // Sort configurations for sortable columns
  const sortConfigs = {
    3: { type: SortType.Number }, // Amount
    4: { type: SortType.Number }, // Price
    5: { type: SortType.Number }, // Total
    6: { type: SortType.Date }, // Time
  };

  const portfolioSortConfig = {
    1: { type: SortType.Number },
    2: { type: SortType.Number },
    3: { type: SortType.Number },
    4: { type: SortType.Number },
  };

  // Cell renderers for conditional styling
  const cellRenderers = [
    (value: string) => renderCode(value),
    (value: string) =>
      renderBinaryValue(value, {
        Buy: "var(--cds-support-success)",
        Sell: "var(--cds-support-error)",
      }),
    (value: string) => renderBold(value),
    null,
    (value: string) => renderCurrency(value),
    (value: string) => renderCurrency(value),
    (value: string) => renderDateTime(value),
    (value: string) => renderStatus(value),
  ];

  const portfolioCellRenderers = [
    (value: string) => renderCode(value),
    (value: string) => renderCurrency(value),
    null,
    (value: string) => renderCurrency(value),
    (value: string) => renderPositiveNegative(value, true, true),
  ];

  // Filter schema for filterable columns
  const filterSchema = {
    1: { type: FilterType.Select }, // Type (Buy/Sell) - Select filter
    2: { type: FilterType.Select }, // Token (SOL, USDC, etc.) - Select filter
    3: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 }, // Amount - Range filter
    4: { type: FilterType.Range, min: 0, max: 1000, step: 0.01 }, // Price - Range filter
    5: { type: FilterType.Range, min: 0, max: 50000, step: 0.01 }, // Total - Range filter
    7: { type: FilterType.Select }, // Status (Success/Failed) - Select filter
  };

  const portfolioFilterSchema = {
    0: { type: FilterType.Select }, // Token - Select filter
    1: { type: FilterType.Range, min: 0, max: 500, step: 0.01 }, // Price - Range filter
    2: { type: FilterType.Range, min: 0, max: 1000, step: 0.01 }, // Holding - Range filter
    3: { type: FilterType.Range, min: 0, max: 100000, step: 0.01 }, // Value - Range filter
    4: { type: FilterType.Range, min: -20, max: 20, step: 0.1 }, // Change - Range filter
  };

  const headers = [
    {
      key: "token",
      header: "Token",
    },
    {
      key: "balance",
      header: "Balance",
    },
    {
      key: "valueUsd",
      header: "Value",
    },
  ];

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(
          `http://localhost:4000/api/balances/${address}`,
        );
        const data = await response.json();
        const balances = data.map(
          (
            balance: { symbol: string; balance: string; valueUsd: string },
            index: number,
          ) => ({
            id: index,
            token: balance.symbol,
            balance: formatNumber(Number(balance.balance)),
            valueUsd: formatNumber(Number(balance.valueUsd)),
          }),
        );

        setTransfers(balances);
      } catch (error) {
        console.error("Failed to fetch transfers:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  if (!address) {
    return (
      <PageWrapper>
        <div>Address not found</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <WalletOverview walletAddress={address} />
      <h1 className={styles.sectionTitle}>Activity</h1>
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={["Balance History", "Token Balance History", "Profit & Lost"]}
          tabs={[
            <BalanceChart
              minHeight={460}
              initialFilters={{
                timePeriod: "30D",
                wallets: [address],
              }}
              autoRefresh={true}
            />,
            <BalanceChart
              minHeight={460}
              initialFilters={{
                timePeriod: "30D",
                wallets: [address],
              }}
              autoRefresh={true}
            />,
            <PnLChart minHeight={400} aggregation="daily" autoRefresh={true} />,
          ]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
        <TabContainer
          activeTab={secondaryActiveTab}
          names={["Transfer", "Swap", "Inflow", "Outflow", "Conterparties"]}
          tabs={[
            <Table
              maxHeight={400}
              title="Transfer"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
              isSortable={isSortable}
              sortConfigs={sortConfigs}
            />,
            <Table
              maxHeight={400}
              title="Swap"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
              isSortable={isSortable}
              sortConfigs={sortConfigs}
            />,
            <Table
              maxHeight={400}
              title="Inflow"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
              isSortable={isSortable}
              sortConfigs={sortConfigs}
            />,
            <Table
              maxHeight={400}
              title="Outflow"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
              isSortable={isSortable}
              sortConfigs={sortConfigs}
            />,
            <Table
              maxHeight={400}
              title="Conterparties"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
              isSortable={isSortable}
              sortConfigs={sortConfigs}
            />,
          ]}
          onTabChange={(index) => setSecondaryActiveTab(index)}
        />
      </div>

      <h1 className={styles.sectionTitle}>Asset</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <div className={styles.columnWrapper}>
          <AssetDistribution />
        </div>
        <div className={styles.columnWrapper}>
          <Table
            maxHeight={800}
            title="Portfolio"
            headers={portfolioHeaders}
            initialFilters={{}}
            fetcher={Promise.resolve(portfolioData)}
            filterSchema={portfolioFilterSchema}
            cellRenderers={portfolioCellRenderers}
            dataEntries={portfolioData}
            isSortable={isSortablePortfolio}
            sortConfigs={portfolioSortConfig}
          />
        </div>
      </div>

      <h1 className={styles.sectionTitle}>Top exchange</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <ExchangeComparison />
      </div>

      <h1 className={styles.sectionTitle}>Top counterparties</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <TransactionDistribution />
      </div>
    </PageWrapper>
  );
}
