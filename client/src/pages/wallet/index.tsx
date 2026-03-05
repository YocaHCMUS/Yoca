import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { ExchangeComparison } from "@/components/charts/ExchangeComparison/ExchangeComparison.tsx";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart.tsx";
import { TransactionDistribution } from "@/components/charts/TransactionDistribution/TransactionDistribution.tsx";
import TabContainer from "@/components/tabContainer/tabContainer.tsx";
import { FilterType, SortType, Table } from "@/components/tables/Table.tsx";
import {
  renderBold,
  renderCode,
  renderCurrency,
  renderDateTime,
  renderLong,
  renderLongCode,
  renderPositiveNegative,
  renderReducedNumber,
  renderBase
  // renderStatus,
} from "@/components/tables/TableCellRenderer.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { fetchWalletPortfolio, fetchWalletTransactions } from "@/services/wallet/walletApi.ts";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { formatNumber } from "../../util/format.ts";
import styles from "./index.module.scss";

// temporary interfaces
interface Transaction {
  id: string;
  signature: string;
  buyer: string;
  seller: string;
  token: string;
  amount: number;
  price: number;
  total: number;
  timestamp: string;
  // status: "Success" | "Failed";
}

interface Portfolio {
  token: string;
  price: number;
  holding: number;
  value: number;
  change: number; // change in % in 24h
}

export default function WalletPage() {
  const { tr, fmt } = useLocalization();
  const { address } = useParams<{ address: string }>();
  const [transfers, setTransfers] = useState([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(0);
  const [secondaryActiveTab, setSecondaryActiveTab] = useState(0);

  // Transform portfolio data from API response for Table component
  const portfolioData = portfolio.length > 0 
    ? portfolio.map((item: any) => [
        item.symbol || item.token || 'Unknown',
        formatNumber(item.priceUsd ?? 0),
        `${formatNumber(item.amount ?? item.holding ?? 0)} ${item.symbol || item.token}`,
        formatNumber(item.valueUsd ?? item.value ?? 0),
        ((item.change24hPercent ?? 0) / 100).toFixed(2),
      ])
    : [];

  // Transform transactions to array format for Table component
  const transactionData = transactions.map((tx) => [
    tx.signature,
    tx.buyer,
    tx.seller,
    tx.token,
    tx.amount,
    tx.price,
    tx.total,
    tx.timestamp,
    // tx.status,
  ]);

  // Filter transactions by type
  const transferData = transactionData;
  const inflowData = transactionData.filter((row) => address && row[1] === address);
  const outflowData = transactionData.filter((row) => address && row[2] === address);

  const transactionHeaders = [
    tr("walletPage.signature"),
    tr("walletPage.buyer"),
    tr("walletPage.seller"),
    tr("walletPage.token"),
    tr("walletPage.amount"),
    tr("walletPage.price"),
    tr("walletPage.total"),
    tr("walletPage.time"),
    // tr("walletPage.status"),
  ];

  const portfolioHeaders = [
    tr("walletPage.token"),
    tr("walletPage.price"),
    tr("walletPage.holding"),
    tr("walletPage.value"),
    tr("walletPage.change24h"),
  ];

  const isSortable = [false, false, false, false, true, true, true, true];
  const isSortablePortfolio = [false, true, true, true, true];

  // Sort configurations for sortable columns
  const sortConfigs = {
    4: { type: SortType.Number }, // Amount
    5: { type: SortType.Number }, // Price
    6: { type: SortType.Number }, // Total
    7: { type: SortType.Date }, // Time
  };

  const portfolioSortConfig = {
    1: { type: SortType.Number },
    2: { type: SortType.Number },
    3: { type: SortType.Number },
    4: { type: SortType.Number },
  };

  // Cell renderers for conditional styling
  const cellRenderers = [
    (value: string) => renderLongCode(value),
    (value: string) => renderLongCode(value),
    (value: string) => renderLongCode(value),
    (value: string) => renderLong(value, renderBold),
    (value: string) => renderReducedNumber(value, renderBase),
    (value: string) => renderReducedNumber(value, renderCurrency),
    (value: string) => renderReducedNumber(value, renderCurrency),
    (value: string) => renderDateTime(value, fmt.datetime["relative"]),
    // (value: string) => renderDateTime(value),
    // null

    // (value: string) => renderStatus(value),
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
    1: { type: FilterType.Select }, // Buyer - Select filter
    2: { type: FilterType.Select }, // Seller - Select filter
    3: { type: FilterType.Select }, // Token (SOL, USDC, etc.) - Select filter
    4: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 }, // Amount - Range filter
    5: { type: FilterType.Range, min: 0, max: 1000, step: 0.01 }, // Price - Range filter
    6: { type: FilterType.Range, min: 0, max: 50000, step: 0.01 }, // Total - Range filter
    // 7: { type: FilterType.Select }, // Status (Success/Failed) - Select filter
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
      header: tr("walletPage.token"),
    },
    {
      key: "balance",
      header: tr("walletPage.amount"),
    },
    {
      key: "valueUsd",
      header: tr("walletPage.value"),
    },
  ];

  useEffect(() => {
    const loadData = async () => {
      if (!address || address === 'null') return;
      
      try {
        setPortfolioLoading(true);
        
        // Fetch portfolio data
        const portfolioResponse = await fetchWalletPortfolio(address, 'solana');
        if (portfolioResponse && Array.isArray(portfolioResponse)) {
          setPortfolio(portfolioResponse);
        }
        
        // Fetch transaction data
        const transactionResponse = await fetchWalletTransactions(address, {
          chain: 'solana',
          limit: 50
        });

        console.log('[transactions] raw response:', transactionResponse);
        console.log('[transactions] response type:', typeof transactionResponse);
        console.log('[transactions] is array:', Array.isArray(transactionResponse));
        console.log('[transactions] response length:', transactionResponse?.length);
        console.log('[transactions] first item:', transactionResponse?.[0]);

        // Handle response that might be wrapped in transactions object
        const txData = Array.isArray(transactionResponse) 
          ? transactionResponse 
          : transactionResponse?.transactions || transactionResponse?.data;
        
        if (txData && Array.isArray(txData) && txData.length > 0) {
          // Transform API transaction response to match Transaction interface
          const transformedTxs = txData.map((tx: any, index: number) => {
            const amount = tx.primaryTokenAmount ?? 0;
            const total = tx.totalUsd ?? 0;
            
            return {
              id: `tx-${index}`,
              buyer: tx.to,
              seller: tx.from,
              signature: tx.hash || `sig-${index}`,
              token: tx.primaryTokenSymbol || 'Unknown',
              amount: amount,
              price: amount > 0 ? total / amount : 0,
              total: total,
              timestamp: tx.timestamp
              // status: tx.receiptStatus === 1 ? 'Success' : tx.receiptStatus === 0 ? 'Failed' : 'Success',
            };
          });
          setTransactions(transformedTxs);
          console.log('[transactions] ✓ transformed and set:', transformedTxs);
        } else {
          console.warn('[transactions] ✗ could not process response - txData:', txData);
        }
      } catch (err) {
        console.error('Failed to load wallet data:', err);
      } finally {
        setPortfolioLoading(false);
        setLoading(false);
      }
    };

    loadData();
  }, [address]);

  if (!address) {
    return (
      <PageWrapper>
        <div>{tr("walletPage.addressNotFound")}</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <WalletOverview walletAddress={address} />
      <h1 className={styles.sectionTitle}>{tr("walletPage.activity")}</h1>
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={[
            tr("walletPage.balanceHistory"),
            tr("walletPage.tokenBalanceHistory"),
            tr("walletPage.profitLoss"),
          ]}
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
                tokens: ['SOL']
              }}
              autoRefresh={true}
            />,
            <PnLChart minHeight={400} aggregation="daily" autoRefresh={true} />,
          ]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
        <TabContainer
          activeTab={secondaryActiveTab}
          names={[
            tr("walletPage.transfer"),
            tr("walletPage.inflow"),
            tr("walletPage.outflow"),
            tr("walletPage.counterparties"),
          ]}
          tabs={[
            <Table
              maxHeight={400}
              title={tr("walletPage.transfer")}
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transferData)}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={transferData}
              isSortable={isSortable}
              sortConfigs={sortConfigs}
            />,
            <Table
              maxHeight={400}
              title={tr("walletPage.inflow")}
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
              maxHeight={400}
              title={tr("walletPage.outflow")}
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
              maxHeight={400}
              title={tr("walletPage.counterparties")}
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

      <h1 className={styles.sectionTitle}>{tr("walletPage.asset")}</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <div className={styles.columnWrapper}>
          <AssetDistribution
            initialFilters={{
              wallets: address ? [address] : [],
              timePeriod: "30D"
            }}
            autoRefresh={true}
          />
        </div>
        <div className={styles.columnWrapper}>
          <Table
            maxHeight={800}
            title={tr("walletPage.portfolio")}
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

      <h1 className={styles.sectionTitle}>{tr("walletPage.topExchange")}</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <ExchangeComparison />
      </div>

      <h1 className={styles.sectionTitle}>
        {tr("walletPage.topCounterparties")}
      </h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <TransactionDistribution />
      </div>
    </PageWrapper>
  );
}
