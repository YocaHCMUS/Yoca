import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { ExchangeComparison } from "@/components/charts/ExchangeComparison/ExchangeComparison.tsx";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart.tsx";
import { TransactionDistribution } from "@/components/charts/TransactionDistribution/TransactionDistribution.tsx";
import TabContainer from "@/components/TabContainer/tabContainer.tsx";
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
  renderBase,
  renderHash
  // renderStatus,
} from "@/components/tables/TableCellRenderer.tsx";
import { SwapDetailModal, type TransferRecord } from "@/components/wallet/SwapDetailModal/SwapDetailModal.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { locale } from "@/config/localization/index.ts";
import { fetchWalletPortfolio, fetchWalletTransfers, fetchWalletSwaps } from "@/services/wallet/walletApi.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { formatNumber } from "../../util/format.ts";
import styles from "./index.module.scss";

// temporary interfaces
interface Transaction {
  id: string;
  // signature: string;
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
  const { tr, fmt, lang } = useLocalization();
  const bcp47 = locale[lang].langCode;
  const { address } = useParams<{ address: string }>();
  const [swaps, setSwaps] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(0);
  const [secondaryActiveTab, setSecondaryActiveTab] = useState(0);

  // Swap detail modal state
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [selectedTransfers, setSelectedTransfers] = useState<TransferRecord[] | null>(null);
  const [selectedSwap, setSelectedSwap] = useState<any>(null);

  // Stores raw API swap objects aligned by index with the swaps state array
  const rawSwapsRef = useRef<any[]>([]);

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

  const balanceTokenOptions = useMemo(
    () =>
      Array.from(
        new Set(
          portfolio
            .map((item: any) => String(item.symbol || item.token || '').trim().toUpperCase())
            .filter((symbol: string) => symbol.length > 0)
        )
      ).slice(0, 12),
    [portfolio]
  );

  // Transform swap data to array format for Table component
  const swapData = useMemo(
    () =>
      swaps.map((swap: any) => {
        const balanceChanges = swap.balanceChanges || [];
        const soldChange = balanceChanges.find((bc: any) => bc.amount < 0);
        const boughtChange = balanceChanges.find((bc: any) => bc.amount > 0);

        // Format token display: amount + truncated mint
        const formatTokenDisplay = (change: any) => {
          if (!change) return '—';
          const amount = Math.abs(change.amount).toFixed(4);
          const mint = change.mint || '';
          const symbol = mint.length > 8 ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : mint;
          return `${amount} ${symbol}`;
        };

        return [
          swap.timestamp,
          swap.fee,
          formatTokenDisplay(soldChange),
          formatTokenDisplay(boughtChange),
          swap.balanceChanges?.length ?? 0,
        ];
      }),
    [swaps],
  );

  // Transform transfer data to array format for Table component
  const transferData = useMemo(
    () =>
      transfers.map((transfer: any) => [
        transfer.from,
        transfer.to,
        transfer.tokenSymbol,
        transfer.amount,
        transfer.timestamp,
      ]),
    [transfers],
  );

  // Filter transfers by direction
  const inflowData = transferData.filter((row) => address && row[1] === address);
  const outflowData = transferData.filter((row) => address && row[0] === address);

  const transactionHeaders = [
    // tr("walletPage.signature"),
    tr("walletPage.buyer"),
    tr("walletPage.seller"),
    tr("walletPage.token"),
    tr("walletPage.amount"),
    tr("walletPage.price"),
    tr("walletPage.total"),
    tr("walletPage.time"),
    // tr("walletPage.status"),
  ];

  const swapHeaders = [
    tr("walletPage.time"),
    "Fee (lamport)",
    "Token Sold",
    "Token Bought",
    "Total Changes",
  ];

  const transferHeaders = [
    tr("walletPage.seller"),
    tr("walletPage.buyer"),
    tr("walletPage.token"),
    tr("walletPage.amount"),
    tr("walletPage.time"),
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
  const isSortableSwaps = [true, true, false, false, false];
  const isSortableTransfers = [false, false, false, true, true];

  // Sort configurations for sortable columns
  const sortConfigs = {
    3: { type: SortType.Number }, // Amount
    4: { type: SortType.Number }, // Price
    5: { type: SortType.Number }, // Total
    6: { type: SortType.Date }, // Time
  };

  const swapSortConfigs = {
    0: { type: SortType.Date }, // Time
    1: { type: SortType.Number }, // Fee
  };

  const transferSortConfigs = {
    3: { type: SortType.Number }, // Amount
    4: { type: SortType.Date }, // Time
  };

  const portfolioSortConfig = {
    1: { type: SortType.Number },
    2: { type: SortType.Number },
    3: { type: SortType.Number },
    4: { type: SortType.Number },
  };

  // Cell renderers for conditional styling
  const cellRenderers = [
    // (value: string) => renderHash(value),
    (value: string) => renderHash(value),
    (value: string) => renderHash(value),
    (value: string) => renderHash(value),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    (value: string) => renderReducedNumber(value, renderCurrency, bcp47),
    (value: string) => renderReducedNumber(value, renderCurrency, bcp47),
    (value: string) => renderDateTime(value, fmt.datetime["relative"]),
  ];

  const swapCellRenderers = [
    (value: string) => renderDateTime(value, fmt.datetime["relative"]),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    (value: string) => renderCode(value),
    (value: string) => renderCode(value),
    (value: string) => renderBase(value),
  ];

  const transferCellRenderers = [
    (value: string) => renderHash(value),
    (value: string) => renderHash(value),
    (value: string) => renderCode(value),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    (value: string) => renderDateTime(value, fmt.datetime["relative"]),
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
    0: { type: FilterType.Select }, // Buyer - Select filter
    1: { type: FilterType.Select }, // Seller - Select filter
    2: { type: FilterType.Select }, // Token (SOL, USDC, etc.) - Select filter
    3: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 }, // Amount - Range filter
    4: { type: FilterType.Range, min: 0, max: 1000, step: 0.01 }, // Price - Range filter
    5: { type: FilterType.Range, min: 0, max: 50000, step: 0.01 }, // Total - Range filter
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

        // Fetch swaps data for swap table
        const swapResponse = await fetchWalletSwaps(address, {
          chain: 'solana',
          limit: 50
        });
        const swapsData = swapResponse?.swaps || [];
        if (Array.isArray(swapsData)) {
          rawSwapsRef.current = swapsData;
          setSwaps(swapsData);
          console.log('[swaps] ✓ loaded:', swapsData.length, 'swaps');
        }

        // Fetch transfers data for inflow/outflow tables
        const transferResponse = await fetchWalletTransfers(address, {
          chain: 'solana',
          limit: 50
        });
        const transfersData = transferResponse?.transfers || [];
        if (Array.isArray(transfersData)) {
          setTransfers(transfersData);
          console.log('[transfers] ✓ loaded:', transfersData.length, 'transfers');
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

  /**
   * Build TransferRecord[] from a raw Helius transaction object.
   * Tries the `tokenTransfers` array first (enhanced API format), then
   * falls back to the primary token fields for a single-leg record.
   */
  function buildTransferRecords(rawTx: any): TransferRecord[] {
    const sig = rawTx.signature || rawTx.hash || "";
    // The server converts the Helius Unix timestamp to an ISO string before sending.
    // Accept either a number (Unix seconds) or an ISO/date string.
    const ts =
      typeof rawTx.timestamp === "number"
        ? rawTx.timestamp
        : rawTx.timestamp
          ? Math.floor(new Date(rawTx.timestamp).getTime() / 1000)
          : 0;
    const records: TransferRecord[] = [];

    if (Array.isArray(rawTx.tokenTransfers) && rawTx.tokenTransfers.length > 0) {
      for (const t of rawTx.tokenTransfers) {
        const isOut = t.fromUserAccount === address;
        records.push({
          signature: sig,
          timestamp: ts,
          direction: isOut ? "out" : "in",
          counterparty: isOut
            ? t.toUserAccount || ""
            : t.fromUserAccount || "",
          mint: t.mint || "",
          symbol: t.tokenSymbol || null,
          amount: Number(t.tokenAmount ?? 0),
          amountRaw: String(t.rawTokenAmount ?? ""),
          decimals: Number(t.decimals ?? 0),
        });
      }
      if (records.length > 0) return records;
    }

    // Fallback: build from primary token fields
    records.push({
      signature: sig,
      timestamp: ts,
      direction: "out",
      counterparty: rawTx.to || "",
      mint: "",
      symbol: rawTx.primaryTokenSymbol || null,
      amount: Number(rawTx.primaryTokenAmount ?? 0),
      amountRaw: "",
      decimals: 0,
    });
    return records;
  }

  function handleSwapRowClick(row: any[], rowIndex: number) {
    const rawSwap = rawSwapsRef.current[rowIndex >= 0 ? rowIndex : -1];
    if (!rawSwap) return;

    // Store the selected swap
    setSelectedSwap(rawSwap);

    // Convert swap data to transfer records for the modal
    const records: TransferRecord[] = rawSwap.balanceChanges?.map((change: any) => ({
      signature: rawSwap.signature,
      timestamp: Math.floor(new Date(rawSwap.timestamp).getTime() / 1000),
      direction: change.amount > 0 ? "in" : "out",
      counterparty: rawSwap.walletAddress,
      mint: change.mint || "",
      symbol: null,
      amount: Math.abs(change.amount),
      amountRaw: String(change.amount),
      decimals: change.decimals || 0,
    })) || [];
    setSelectedTransfers(records);
    setSwapModalOpen(true);
  }

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
                timePeriod: "7D",
                wallets: [address],
              }}
              autoRefresh={true}
            />,
            <BalanceChart
              minHeight={460}
              initialFilters={{
                timePeriod: "7D",
                wallets: [address],
                tokens: ['SOL']
              }}
              enableTokenSelector={true}
              tokenSelectorOptions={balanceTokenOptions.length > 0 ? balanceTokenOptions : ['SOL', 'USDC', 'USDT']}
              allowMultiTokenSelection={true}
              autoRefresh={true}
            />,
            <PnLChart
              minHeight={400}
              aggregation="daily"
              autoRefresh={true}
              initialFilters={{
                timePeriod: "7D",
                wallets: [address]
              }} />,
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
              title={"swap"}
              headers={swapHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(swapData)}
              filterSchema={{
                0: { type: FilterType.Select },
                1: { type: FilterType.Range, min: 0, max: 1, step: 0.000001 },
                2: { type: FilterType.Select },
                3: { type: FilterType.Select },
                4: { type: FilterType.Select },
              }}
              cellRenderers={swapCellRenderers}
              dataEntries={swapData}
              isSortable={isSortableSwaps}
              sortConfigs={swapSortConfigs}
              onRowClick={handleSwapRowClick}
            />,
            <Table
              maxHeight={400}
              title={tr("walletPage.inflow")}
              headers={transferHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(inflowData)}
              filterSchema={{
                0: { type: FilterType.Select },
                1: { type: FilterType.Select },
                2: { type: FilterType.Select },
                3: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 },
                4: { type: FilterType.Select },
              }}
              cellRenderers={transferCellRenderers}
              dataEntries={inflowData}
              isSortable={isSortableTransfers}
              sortConfigs={transferSortConfigs}
            />,
            <Table
              maxHeight={400}
              title={tr("walletPage.outflow")}
              headers={transferHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(outflowData)}
              filterSchema={{
                0: { type: FilterType.Select },
                1: { type: FilterType.Select },
                2: { type: FilterType.Select },
                3: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 },
                4: { type: FilterType.Select },
              }}
              cellRenderers={transferCellRenderers}
              dataEntries={outflowData}
              isSortable={isSortableTransfers}
              sortConfigs={transferSortConfigs}
            />,
            <Table
              maxHeight={400}
              title={tr("walletPage.counterparties")}
              headers={transactionHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve([])}
              filterSchema={filterSchema}
              cellRenderers={cellRenderers}
              dataEntries={[]}
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

      <SwapDetailModal
        isOpen={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        transfers={selectedTransfers}
        fee={selectedSwap?.fee}
        slot={selectedSwap?.slot}
        feePayer={selectedSwap?.feePayer}
      />
    </PageWrapper>
  );
}
