import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { formatNumber } from "../../util/format.ts";
import { useTranslation } from "react-i18next";
import PageWrapper from "@/components/wrapper/PageWrapper.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import { FundamentalTab } from "@/components/market/FundamentalTab.tsx";
import { OverviewTab } from "@/components/market/OverviewTab.tsx";
import { ProfitLossTab } from "@/components/market/ProfitLossTab.tsx";
import styles from "./index.module.scss";
import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart.tsx";
import TabContainer from "@/components/tabContainer/TabContainer.tsx";
import { Table, SortType, FilterType } from "@/components/tables/Table.tsx";
import { CheckmarkFilled, CloseFilled } from '@carbon/icons-react';
import { 
  renderCode, 
  renderBinaryValue, 
  renderBold, 
  renderCurrency, 
  renderStatus,
  renderDateTime 
} from "@/components/tables/TableCellRenderer.tsx";

// temporary interface
interface Transaction {
  id: string;
  signature: string;
  type: 'Buy' | 'Sell';
  token: string;
  amount: number;
  price: number;
  total: number;
  timestamp: string;
  status: 'Success' | 'Failed';
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
    type: i % 2 === 0 ? 'Buy' : 'Sell',
    token: ['SOL', 'USDC', 'JTO', 'BONK'][i % 4],
    amount: Math.random() * 1000,
    price: Math.random() * 200,
    total: Math.random() * 10000,
    timestamp: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
    status: i % 10 === 0 ? 'Failed' : 'Success',
  }));

  // Transform transactions to array format for Table component
  const transactionData = transactions.map(tx => [
    tx.signature,
    tx.type,
    tx.token,
    tx.amount.toFixed(4),
    tx.price.toFixed(2),
    tx.total.toFixed(2),
    tx.timestamp,
    tx.status
  ]);

  const transactionHeaders = [
    'Signature',
    'Type',
    'Token',
    'Amount',
    'Price',
    'Total',
    'Time',
    'Status'
  ];

  const isSortable = [false, false, false, true, true, true, true, false];

  // Sort configurations for sortable columns
  const sortConfigs = {
    3: { type: SortType.Number },  // Amount
    4: { type: SortType.Number },  // Price
    5: { type: SortType.Number },  // Total
    6: { type: SortType.Date }     // Time
  };

  // Cell renderers for conditional styling
  const cellRenderers = [
    (value: string) => renderCode(value),
    (value: string) => renderBinaryValue(value, {
      'Buy': 'var(--cds-support-success)',
      'Sell': 'var(--cds-support-error)'
    }),
    (value: string) => renderBold(value),
    null,
    (value: string) => renderCurrency(value),
    (value: string) => renderCurrency(value),
    (value: string) => renderDateTime(value),
    (value: string) => renderStatus(value)
  ];

  // Filter schema for filterable columns
  const filterSchema = {
    1: { type: FilterType.Select }, // Type (Buy/Sell) - Select filter
    2: { type: FilterType.Select }, // Token (SOL, USDC, etc.) - Select filter
    3: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 }, // Amount - Range filter
    4: { type: FilterType.Range, min: 0, max: 1000, step: 0.01 }, // Price - Range filter
    5: { type: FilterType.Range, min: 0, max: 50000, step: 0.01 }, // Total - Range filter
    7: { type: FilterType.Select }  // Status (Success/Failed) - Select filter
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
      <WalletOverview walletAddress={address}/>
      <h1 className={styles.sectionTitle}>Activity</h1>
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={["Balance History", "Token Balance History", "Profit & Lost"]}
          tabs={
            [<BalanceChart
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
                />]} //for testing purpose
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
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
              isSortable={isSortable}
              sortConfigs={sortConfigs}
            />,
            <Table
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
              title="Conterparties"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transactionData)}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={transactionData}
              isSortable={isSortable}
              sortConfigs={sortConfigs}
            />
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
