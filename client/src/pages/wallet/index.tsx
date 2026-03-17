import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { CounterpartyActivity } from "@/components/charts/CounterpartyActivity/CounterpartyActivity.tsx";
import { ExchangeComparison } from "@/components/charts/ExchangeComparison/ExchangeComparison.tsx";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart.tsx";
import TabContainer from "@/components/tabContainer/tabContainer.tsx";
import { FilterType, SortType, Table } from "@/components/tables/Table.tsx";
import {
  renderBase,
  renderCode,
  renderCurrency,
  renderDateTime,
  renderHash,
  renderPositiveNegative,
  renderReducedNumber,
} from "@/components/tables/TableCellRenderer.tsx";
import {
  SwapDetailModal,
  type TransferRecord,
} from "@/components/wallet/SwapDetailModal/SwapDetailModal.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { locale } from "@/config/localization/index.ts";
import {
  fetchWalletCounterparties,
  fetchWalletPortfolio,
  fetchWalletTransfers,
  fetchWalletSwaps,
  type WalletCounterpartyRow,
  type WalletPortfolioItem,
} from "@/services/wallet/walletApi.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  mapPortfolioItems,
  buildPortfolioMetaMap,
} from "../../util/wallet-portfolio-mapper.ts";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import styles from "./index.module.scss";

export default function WalletPage() {
  const { tr, fmt, lang } = useLocalization();
  const bcp47 = locale[lang].langCode;
  const { address } = useParams<{ address: string }>();
  const [swaps, setSwaps] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<WalletPortfolioItem[]>([]);
  const [counterparties, setCounterparties] = useState<WalletCounterpartyRow[]>([]);

  const [activeTab, setActiveTab] = useState(0);
  const [secondaryActiveTab, setSecondaryActiveTab] = useState(0);

  // Swap detail modal state
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [selectedTransfers, setSelectedTransfers] = useState<
    TransferRecord[] | null
  >(null);
  const [selectedSwap, setSelectedSwap] = useState<any>(null);

  // Stores raw API swap objects aligned by index with the swaps state array
  const rawSwapsRef = useRef<any[]>([]);

  // Transform portfolio data from API response for Table component using typed mapper.
  // Numeric values are kept as numbers (not pre-formatted strings) so that
  // SortType.Number and FilterType.Range work correctly on price/amount/value/change.
  const { rows: portfolioData, meta: portfolioMeta } = useMemo(
    () => mapPortfolioItems(portfolio),
    [portfolio],
  );

  // O(1) lookup: resolved token label → portfolio row metadata (logoUri, etc.)
  const portfolioMetaMap = useMemo(
    () => buildPortfolioMetaMap(portfolioMeta),
    [portfolioMeta],
  );

  const balanceTokenOptions = useMemo(
    () =>
      Array.from(
        new Set(
          portfolio
            .map((item) => item.symbol.trim().toUpperCase())
            .filter((symbol) => symbol.length > 0),
        ),
      ).slice(0, 12),
    [portfolio],
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
          if (!change) return "—";
          const amount = Math.abs(change.amount).toFixed(4);
          const mint = change.mint || "";
          const symbol =
            mint.length > 8 ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : mint;
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
  const inflowData = transferData.filter(
    (row) => address && row[1] === address,
  );
  const outflowData = transferData.filter(
    (row) => address && row[0] === address,
  );

  const counterpartyTableData = useMemo(
    () =>
      counterparties.map((row) => {
        const identityLabel =
          row.identity.name ||
          (row.identity.status === "known"
            ? "Known"
            : row.identity.status === "unavailable"
              ? "Unavailable"
              : "Unknown");

        return [
          row.address,
          identityLabel,
          row.uniqueTokenCount,
          row.tokens.join(", "),
          row.totalVolumeUsd,
          row.transactionCount,
        ];
      }),
    [counterparties],
  );

  const counterpartyHeaders = [
    "Counterparty",
    "Identity",
    "Unique tokens traded",
    "Token list",
    "Total volume",
    "Transaction count",
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

  const isSortableCounterparties = [false, false, true, false, true, true];
  const isSortablePortfolio = [false, true, true, true, true];
  const isSortableSwaps = [true, true, false, false, false];
  const isSortableTransfers = [false, false, false, true, true];

  // Sort configurations for sortable columns
  const counterpartySortConfigs = {
    2: { type: SortType.Number },
    4: { type: SortType.Number },
    5: { type: SortType.Number },
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
  const counterpartyCellRenderers = [
    (value: string) => renderHash(value),
    (value: string) => renderCode(value),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    (value: string) => renderCode(value),
    (value: string) => renderReducedNumber(value, renderCurrency, bcp47),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
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
    // Column 0: token label + optional logo image
    (value: string) => {
      const tokenMeta = portfolioMetaMap.get(value);

      return (
        <TokenIdentityCell
          symbol={value}
          fullName={tokenMeta?.fullName}
          imageUrl={tokenMeta?.logoUri}
          imageSize={20}
          showInitialsFallback
          tooltipAlign="right"
        />
      );
    },
    // Column 1: USD price per token
    (value: string) => renderCurrency(value),
    // Column 2: raw token amount – formatted for display, sortable as number
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    // Column 3: USD value of holding
    (value: string) => renderCurrency(value),
    // Column 4: 24-hour change (fractional, e.g. 0.05 = 5%)
    (value: string) => renderPositiveNegative(value, true, true),
  ];

  const counterpartyFilterSchema = {
    0: { type: FilterType.Select },
    1: { type: FilterType.Select },
    2: { type: FilterType.Range, min: 0, max: 100, step: 1 },
    3: { type: FilterType.Select },
    4: { type: FilterType.Range, min: 0, max: 1_000_000, step: 0.01 },
    5: { type: FilterType.Range, min: 0, max: 10_000, step: 1 },
  };

  const portfolioFilterSchema = {
    0: { type: FilterType.Select }, // Token label - Select filter
    1: { type: FilterType.Range, min: 0, max: 500, step: 0.01 }, // Price (USD)
    2: { type: FilterType.Range, min: 0, max: 1_000_000, step: 0.001 }, // Amount (tokens)
    3: { type: FilterType.Range, min: 0, max: 100_000, step: 0.01 }, // Value (USD)
    4: { type: FilterType.Range, min: -1, max: 1, step: 0.001 }, // Change24h (fraction)
  };

  useEffect(() => {
    const loadData = async () => {
      if (!address || address === 'null') return;

      try {
        // Fetch portfolio data
        const portfolioResponse = await fetchWalletPortfolio(address, "solana");
        if (Array.isArray(portfolioResponse)) {
          setPortfolio(portfolioResponse);
        }

        // Fetch swaps data for swap table
        const swapResponse = await fetchWalletSwaps(address, {
          chain: "solana",
          limit: 50,
        });
        const swapsData = swapResponse?.swaps || [];
        if (Array.isArray(swapsData)) {
          rawSwapsRef.current = swapsData;
          setSwaps(swapsData);
          console.log("[swaps] ✓ loaded:", swapsData.length, "swaps");
        }

        // Fetch transfers data for inflow/outflow tables
        const transferResponse = await fetchWalletTransfers(address, {
          chain: "solana",
          limit: 50,
        });
        const transfersData = transferResponse?.transfers || [];
        if (Array.isArray(transfersData)) {
          setTransfers(transfersData);
          console.log('[transfers] ✓ loaded:', transfersData.length, 'transfers');
        }

        const counterpartyResponse = await fetchWalletCounterparties(address, {
          chain: 'solana',
          period: '7d',
          limit: 50,
          includeTokens: true,
        });
        const counterpartiesData = counterpartyResponse?.counterparties ?? [];
        if (Array.isArray(counterpartiesData)) {
          setCounterparties(counterpartiesData);
          console.log('[counterparties] ✓ loaded:', counterpartiesData.length, 'rows');
        }
      } catch (err) {
        console.error('Failed to load wallet data:', err);
      }
    };

    loadData();
  }, [address]);

  function handleSwapRowClick(row: any[], rowIndex: number) {
    const rawSwap = rawSwapsRef.current[rowIndex >= 0 ? rowIndex : -1];
    if (!rawSwap) return;

    // Store the selected swap
    setSelectedSwap(rawSwap);

    // Convert swap data to transfer records for the modal
    const records: TransferRecord[] =
      rawSwap.balanceChanges?.map((change: any) => ({
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
                tokens: ["SOL"],
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
                wallets: [address],
              }}
            />,
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
              headers={counterpartyHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(counterpartyTableData)}
              filterSchema={counterpartyFilterSchema}
              cellRenderers={counterpartyCellRenderers}
              dataEntries={counterpartyTableData}
              isSortable={isSortableCounterparties}
              sortConfigs={counterpartySortConfigs}
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
              timePeriod: "30D",
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
      <div className={styles.chartContainer}>
        <CounterpartyActivity
          minHeight={320}
          initialFilters={{
            timePeriod: "7D",
            wallets: [address],
          }}
          autoRefresh={true}
        />
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
