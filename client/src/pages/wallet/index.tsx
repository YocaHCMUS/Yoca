import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart.tsx";
import { FundamentalTab } from "@/components/market/FundamentalTab.tsx";
import { OverviewTab } from "@/components/market/OverviewTab.tsx";
import { ProfitLossTab } from "@/components/market/ProfitLossTab.tsx";
import { TabContainer } from "@/components/tabContainer/tabContainer.tsx";
import { Table } from "@/components/tables/Table.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import PageWrapper from "@/components/wrapper/PageWrapper.tsx";
import { CheckmarkFilled, CloseFilled } from "@carbon/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { formatNumber } from "../../util/format.ts";
import styles from "./index.module.scss";

// temporary interface
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
      Date.now() - Math.random() * 86400000,
    ).toLocaleTimeString(),
    status: i % 10 === 0 ? "Failed" : "Success",
  }));

  // Transform transactions to array format for Table component
  const transactionData = transactions.map((tx) => [
    tx.signature,
    tx.type,
    tx.token,
    tx.amount.toFixed(4),
    `$${tx.price.toFixed(2)}`,
    `$${tx.total.toFixed(2)}`,
    tx.timestamp,
    tx.status,
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

  // Cell renderers for conditional styling (temporary, move to util service)
  const cellRenderers = [
    (value: string) => (
      <code
        style={{ color: "var(--cds-text-secondary)", fontSize: "0.75rem" }}
        title={value}
      >
        {value}
      </code>
    ),
    (value: string) => (
      <span
        style={{
          color:
            value === "Buy"
              ? "var(--cds-support-success)"
              : "var(--cds-support-error)",
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    ),
    (value: string) => <span style={{ fontWeight: 600 }}>{value}</span>,
    null,
    null,
    null,
    null,
    (value: string) => (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          color:
            value === "Success"
              ? "var(--cds-support-success)"
              : "var(--cds-support-error)",
          fontWeight: 600,
        }}
      >
        {value === "Success" ? (
          <CheckmarkFilled size={16} />
        ) : (
          <CloseFilled size={16} />
        )}
        {value}
      </span>
    ),
  ];

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
        const response = await fetch(`/api/v0/balances/${address}`);
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
              // height={400}
              initialTimePeriod="30D"
              autoRefresh={true}
            />,
            <BalanceChart
              // height={400}
              initialTimePeriod="30D"
              autoRefresh={true}
            />,
            <PnLChart
              // height={400}
              aggregation="daily"
              autoRefresh={true}
            />,
          ]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
        <TabContainer
          activeTab={secondaryActiveTab}
          names={["Transfer", "Swap", "Inflow", "Outflow", "Conterparties"]}
          tabs={[
            <Table
              title="Transfer"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={{}}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
            />,
            <Table
              title="Swap"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={{}}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
            />,
            <Table
              title="Inflow"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={{}}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
            />,
            <Table
              title="Outflow"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={{}}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
            />,
            <Table
              title="Conterparties"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={{}}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
            />,
          ]}
          onTabChange={(index) => setSecondaryActiveTab(index)}
        />
      </div>

      <h1 className={styles.sectionTitle}>Asset</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={["Overview", "Transactions", "Holdings"]}
          tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
        <TabContainer
          activeTab={activeTab}
          names={["Overview", "Transactions", "Holdings"]}
          tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
      </div>

      <h1 className={styles.sectionTitle}>Top exchange</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={["Overview", "Transactions", "Holdings"]}
          tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
      </div>

      <h1 className={styles.sectionTitle}>Top counterparties</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={["Overview", "Transactions", "Holdings"]}
          tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
      </div>
    </PageWrapper>
  );
}
