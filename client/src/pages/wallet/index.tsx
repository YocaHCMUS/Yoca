import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { formatNumber } from "../../util/format.ts";
import { useTranslation } from "react-i18next";
import PageWrapper from "@/components/wrapper/PageWrapper.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import styles from "./index.module.scss";
import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart.tsx";
import TabContainer from "@/components/tabContainer/TabContainer.tsx";
import { Table, SortType, FilterType } from "@/components/tables/Table.tsx";
import { 
  renderHash,
  renderBinaryValue, 
  renderBold, 
  renderCurrency, 
  renderStatus,
  renderDateTime, 
  renderPositiveNegative
} from "@/components/tables/TableCellRenderer.tsx";
import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import { ExchangeComparison } from "@/components/charts/ExchangeComparison/ExchangeComparison.tsx";
import { TransactionDistribution } from "@/components/charts/TransactionDistribution/TransactionDistribution.tsx";

interface WalletApiTransaction {
  hash: string;
  timestamp: string;
  from: string;
  to: string;
  status: boolean | null;
  direction?: "in" | "out" | "self" | "unknown";
  primaryTokenSymbol?: string;
  primaryTokenAmount?: number;
  priceUsd?: number;
  totalUsd?: number;
}

interface WalletPortfolioApiItem {
  tokenAddress: string;
  symbol: string;
  name?: string;
  amount: number;
  priceUsd?: number;
  valueUsd: number;
  change24hPercent?: number;
}

// temporary interfaces
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
  const [portfolio, setPortfolio] = useState<WalletPortfolioApiItem[]>([]);
  const [transactions, setTransactions] = useState<WalletApiTransaction[]>([]);
  const [exchangeData, setExchangeData] = useState<{
    exchanges: { name: string; deposits: number; withdrawals: number; depositsVolume: number; withdrawalsVolume: number }[];
    metadata: { period: string; metric: "count" | "volume" };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(0);
  const [secondaryActiveTab, setSecondaryActiveTab] = useState(0); // TODO: implement a hook to scale these state

  const transactionData = transactions.map((tx) => [
    tx.hash,
    tx.direction === "in" ? "Inflow" : tx.direction === "out" ? "Outflow" : "Transfer",
    tx.primaryTokenSymbol ?? "",
    tx.primaryTokenAmount != null ? tx.primaryTokenAmount.toFixed(4) : "",
    tx.priceUsd != null ? `$${tx.priceUsd.toFixed(4)}` : "-",
    tx.totalUsd != null ? `$${tx.totalUsd.toFixed(2)}` : "-",
    tx.timestamp,
    tx.status === null ? "Unknown" : tx.status ? "Success" : "Failed",
  ]);

  const inflowData = transactionData.filter((row) => row[1] === "Inflow");
  const outflowData = transactionData.filter((row) => row[1] === "Outflow");

  const portfolioData = portfolio.map((prt) => [
    prt.symbol || prt.tokenAddress,
    prt.priceUsd !== undefined ? prt.priceUsd.toFixed(4) : "-",
    `${prt.amount.toFixed(4)} ${prt.symbol || ""}`,
    prt.valueUsd.toFixed(4),
    prt.change24hPercent !== undefined && !Number.isNaN(prt.change24hPercent)
      ? `${prt.change24hPercent >= 0 ? "+" : ""}${prt.change24hPercent.toFixed(2)}%`
      : "-",
  ]);

  const assetDistributionFromPortfolio = useMemo(() => {
    const totalValue = portfolio.reduce((s, p) => s + p.valueUsd, 0);
    const data = portfolio
      .filter((p) => p.valueUsd > 0)
      .map((p) => ({
        name: p.symbol || `${p.tokenAddress.slice(0, 6)}...${p.tokenAddress.slice(-4)}`,
        value: p.valueUsd,
        percentage: totalValue > 0 ? (p.valueUsd / totalValue) * 100 : 0,
      }));
    return { data, totalValue };
  }, [portfolio]);

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

  const portfolioHeaders = [
    'Token', 'Price', 'Holding', 'Value', 'Change (24h)'
  ]

  const isSortable = [false, false, false, true, true, true, true, false];
  const isSortablePortfolio = [false, true, true, true, true];

  // Sort configurations for sortable columns
  const sortConfigs = {
    3: { type: SortType.Number },  // Amount
    4: { type: SortType.Number },  // Price
    5: { type: SortType.Number },  // Total
    6: { type: SortType.Date }     // Time
  };

  const portfolioSortConfig = {
    1: {type: SortType.Number},
    2: {type: SortType.Number},
    3: {type: SortType.Number},
    4: {type: SortType.Number} 
  }

  // Cell renderers for conditional styling
  const cellRenderers = [
    (value: string) => renderHash(value),
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

  const portfolioCellRenderers = [
    (value: string) => renderHash(value),
    (value: string) => renderCurrency(value),
    null,
    (value: string) => renderCurrency(value),
    (value: string) => renderPositiveNegative(value, true, true)
  ]

  // Filter schema for filterable columns
  const filterSchema = {
    1: { type: FilterType.Select }, // Type (Buy/Sell) - Select filter
    2: { type: FilterType.Select }, // Token (SOL, USDC, etc.) - Select filter
    3: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 }, // Amount - Range filter
    4: { type: FilterType.Range, min: 0, max: 1000, step: 0.01 }, // Price - Range filter
    5: { type: FilterType.Range, min: 0, max: 50000, step: 0.01 }, // Total - Range filter
    7: { type: FilterType.Select }  // Status (Success/Failed) - Select filter
  };

  const portfolioFilterSchema = {
    0: { type: FilterType.Select }, // Token - Select filter
    1: { type: FilterType.Range, min: 0, max: 500, step: 0.01 }, // Price - Range filter
    2: { type: FilterType.Range, min: 0, max: 1000, step: 0.01 }, // Holding - Range filter
    3: { type: FilterType.Range, min: 0, max: 100000, step: 0.01 }, // Value - Range filter
    4: { type: FilterType.Range, min: -20, max: 20, step: 0.1 } // Change - Range filter
  };


  useEffect(() => {
    (async () => {
      try {
        if (!address) {
          return;
        }

        const chainParam = "solana";
        const [portfolioResp, txResp, exchangesResp] = await Promise.all([
          fetch(`/api/wallets/${address}/portfolio?chain=${chainParam}`),
          fetch(`/api/wallets/${address}/transactions?chain=${chainParam}&limit=100`),
          fetch(`/api/wallets/${address}/exchanges?chain=${chainParam}&limit=500`),
        ]);

        if (!portfolioResp.ok) {
          throw new Error(`Failed to load portfolio: ${portfolioResp.status}`);
        }
        if (!txResp.ok) {
          throw new Error(`Failed to load transactions: ${txResp.status}`);
        }

        const portfolioJson = (await portfolioResp.json()) as {
          portfolio: WalletPortfolioApiItem[];
        };
        const txJson = (await txResp.json()) as {
          transactions: WalletApiTransaction[];
        };

        setPortfolio(portfolioJson.portfolio ?? []);
        setTransactions(txJson.transactions ?? []);

        if (exchangesResp.ok) {
          const exchangesJson = (await exchangesResp.json()) as {
            exchanges: { name: string; deposits: number; withdrawals: number; depositsVolume: number; withdrawalsVolume: number }[];
            metadata: { period: string; metric: "count" | "volume" };
          };
          setExchangeData(exchangesJson);
        } else {
          setExchangeData(null);
        }
      } catch (error) {
        console.error("Failed to fetch wallet data:", error);
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
                minHeight={400}
                initialFilters={{
                  initialTimePeriod: "30D",
                  wallets: [address]
                }}
                autoRefresh={true}
                />,
              <BalanceChart
                minHeight={400}
                initialFilters={{
                  initialTimePeriod: "30D",
                  wallets: [address]
                }}
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
              fetcher={Promise.resolve(inflowData)}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={inflowData}
              isSortable={isSortable}
              sortConfigs={sortConfigs}
            />,
            <Table
              title="Outflow"
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(outflowData)}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={outflowData}
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
      <div className={styles.chartContainer}>
        <div className={styles.columnWrapper}>
          <AssetDistribution
            portfolioOverride={assetDistributionFromPortfolio}
          />
        </div>
        <div className={styles.columnWrapper}>
          <Table
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
      <div className={styles.chartContainer}>
        <ExchangeComparison exchangesOverride={exchangeData} />
      </div>

      <h1 className={styles.sectionTitle}>Top counterparties</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <TransactionDistribution/>
      </div>
    </PageWrapper>
  );
}
