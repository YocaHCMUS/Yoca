import client from "@/api/main";
import { CpyBtn } from "@/components/CpyBtn";
import ProfileUnavailableState from "@/components/profile/ProfileUnavailableState";
import TabContainer from "@/components/tabContainer/tabContainer";
import { SortType, Table } from "@/components/tables/Table";
import { renderSparkline } from "@/components/tables/TableCellRenderer";
import { TknImg } from "@/components/TknImg";
import { TrendNum } from "@/components/TrendNum";
import { Txt } from "@/components/Txt";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { cds } from "@/util/carbon-theme";
import { IconButton, Link, Stack } from "@carbon/react";
import { StarFilled, Wallet } from "@carbon/react/icons";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import styles from "./profile.module.scss";

interface LinkedWalletsResponse {
  userId: string;
  rows: Array<{
    walletAddress: string;
    isAuthWallet: boolean;
  }>;
}

export function ProfileWatchlistTab() {
  const { tr, fmt } = useLocalization();
  const navigate = useNavigate();
  const [activeSubtab, setActiveSubtab] = useState(0);
  const {
    tokenWatchlist,
    walletWatchlist,
    isLoading,
    tokenPending,
    walletPending,
    toggleToken,
    toggleWallet,
  } = useWatchlist();

  const tokenAddresses = useMemo(
    () => tokenWatchlist.filter(Boolean).join(","),
    [tokenWatchlist],
  );

  const tokenMeta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: tokenAddresses || "" } },
    { enabled: Boolean(tokenAddresses) },
  );

  const marketData = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: tokenAddresses || "" } },
    { enabled: Boolean(tokenAddresses) },
  );

  const marketByAddress = useMemo(() => {
    const data = marketData.data;
    if (!data) return {} as Record<string, any>;
    if (Array.isArray(data)) {
      return Object.fromEntries(data.map((item: any) => [item.address, item]));
    }
    return data as Record<string, any>;
  }, [marketData.data]);

  const tokenMetaByAddress = useMemo(() => {
    const data = tokenMeta.data;
    if (!data) return {} as Record<string, any>;
    if (Array.isArray(data)) {
      return Object.fromEntries(data.map((item: any) => [item.address, item]));
    }
    return data as Record<string, any>;
  }, [tokenMeta.data]);

  const linkedWallets = useGet(client.api.profile["linked-wallets"], 200);

  const linkedWalletIdentity = useMemo(() => {
    const rows =
      (linkedWallets.data as LinkedWalletsResponse | undefined)?.rows ?? [];

    return Object.fromEntries(
      rows.map((row) => [
        row.walletAddress,
        row.isAuthWallet
          ? tr("profileTabs.portfolio.authWalletLabel")
          : tr("profileTabs.portfolio.linkedWalletLabel"),
      ]),
    );
  }, [linkedWallets.data, tr]);

  const tokenHeaders = [
    { header: "", align: "center" as const, minWidth: "3.5rem" },
    {
      header: tr("marketPage.token"),
      align: "start" as const,
      minWidth: "13rem",
    },
    { header: tr("marketPage.price"), align: "end" as const, minWidth: "8rem" },
    { header: "1h", align: "end" as const, minWidth: "7rem" },
    { header: "24h", align: "end" as const, minWidth: "7rem" },
    { header: "7d", align: "end" as const, minWidth: "7rem" },
    {
      header: tr("marketPage.volume24h"),
      align: "end" as const,
      minWidth: "8rem",
    },
    {
      header: tr("marketPage.marketCap"),
      align: "end" as const,
      minWidth: "9rem",
    },
    {
      header: tr("token.marketStats.fdv"),
      align: "end" as const,
      minWidth: "9rem",
    },
    {
      header: tr("nav.searchLast7Days"),
      align: "end" as const,
      minWidth: "12rem",
    },
  ];

  const walletHeaders = [
    { header: "", align: "center" as const, minWidth: "3.5rem" },
    {
      header: tr("profileTabs.watchlist.walletAddress"),
      align: "start" as const,
      minWidth: "14rem",
    },
    {
      header: tr("profileTabs.watchlist.walletIdentity"),
      align: "start" as const,
      minWidth: "10rem",
    },
  ];

  const tokenTableData = useMemo(() => {
    return tokenWatchlist.map((tokenAddress) => {
      const meta = tokenMetaByAddress[tokenAddress];
      const market = marketByAddress[tokenAddress];
      const symbol =
        meta?.symbol?.toUpperCase() ?? fmt.text.address(tokenAddress);
      const name = meta?.name ?? tokenAddress;

      return [
        {
          tokenAddress,
          pending: Boolean(tokenPending[tokenAddress]),
        },
        {
          tokenAddress,
          symbol,
          name,
          imageUrl: meta?.imageUrl,
        },
        market?.priceUsd ?? null,
        market?.priceChangePercentage1h ?? null,
        market?.priceChangePercentage24h ?? null,
        market?.priceChangePercentage7d ?? null,
        market?.volume24h ?? null,
        market?.marketCap ?? null,
        market?.fullyDilutedValuation ?? null,
        {
          data: market?.sparkline7d ?? [],
          positive: (market?.priceChangePercentage7d ?? 0) >= 0,
        },
      ];
    });
  }, [tokenWatchlist, tokenMetaByAddress, marketByAddress, fmt, tokenPending]);

  const tokenCellRenderers = useMemo(
    () => [
      (value: unknown) => {
        const entry = value as { tokenAddress?: string; pending?: boolean };
        const tokenAddress = entry?.tokenAddress;
        if (!tokenAddress) return null;

        return (
          <IconButton
            label={tr("marketPage.removeFromWatchlist")}
            kind="ghost"
            size="sm"
            disabled={Boolean(entry.pending)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void toggleToken(tokenAddress);
            }}
          >
            <StarFilled size={16} fill={cds.backgroundBrand} />
          </IconButton>
        );
      },
      (value: unknown) => {
        const entry = value as {
          tokenAddress?: string;
          symbol?: string;
          name?: string;
          imageUrl?: string;
        };

        const tokenAddress = entry?.tokenAddress ?? "";
        const symbol = entry?.symbol ?? fmt.text.address(tokenAddress);
        const name = entry?.name ?? tokenAddress;

        return (
          <Stack
            orientation="horizontal"
            gap={2}
            style={{ alignItems: "center" }}
          >
            <TknImg src={entry?.imageUrl} alt={symbol} size={28} />
            <Stack gap={1} style={{ justifyContent: "center" }}>
              <Stack
                orientation="horizontal"
                gap={2}
                style={{ alignItems: "center" }}
              >
                <Link
                  href={`/tokens/${tokenAddress}`}
                  style={{ fontFamily: "monospace" }}
                >
                  {symbol}
                </Link>
                <CpyBtn size="xs" copyWhat={tokenAddress} />
              </Stack>
              <Txt secondary ellipsis>
                {(name ?? "").length > 16 ? `${name.slice(0, 16)}...` : name}
              </Txt>
            </Stack>
          </Stack>
        );
      },
      (value: unknown) =>
        typeof value === "number" && Number.isFinite(value)
          ? fmt.num.compact.currency(value)
          : "-",
      (value: unknown) =>
        typeof value === "number" && Number.isFinite(value) ? (
          <TrendNum value={value} formatter={fmt.num.percent} />
        ) : (
          "-"
        ),
      (value: unknown) =>
        typeof value === "number" && Number.isFinite(value) ? (
          <TrendNum value={value} formatter={fmt.num.percent} />
        ) : (
          "-"
        ),
      (value: unknown) =>
        typeof value === "number" && Number.isFinite(value) ? (
          <TrendNum value={value} formatter={fmt.num.percent} />
        ) : (
          "-"
        ),
      (value: unknown) =>
        typeof value === "number" && Number.isFinite(value)
          ? fmt.num.compact.currency(value)
          : "-",
      (value: unknown) =>
        typeof value === "number" && Number.isFinite(value)
          ? fmt.num.compact.currency(value)
          : "-",
      (value: unknown) =>
        typeof value === "number" && Number.isFinite(value)
          ? fmt.num.compact.currency(value)
          : "-",
      (value: unknown) => renderSparkline(value),
    ],
    [fmt, toggleToken, tr],
  );

  const walletTableData = useMemo(
    () =>
      walletWatchlist
        .map((walletAddress) => ({
          id: walletAddress,
          row: [
            {
              walletAddress,
              pending: Boolean(walletPending[walletAddress]),
            },
            walletAddress,
            linkedWalletIdentity[walletAddress] ?? "-",
          ],
        }))
        .map((entry) => entry.row),
    [walletWatchlist, linkedWalletIdentity, walletPending],
  );

  const walletCellRenderers = useMemo(
    () => [
      (value: unknown) => {
        const entry = value as { walletAddress?: string; pending?: boolean };
        const walletAddress = entry?.walletAddress;
        if (!walletAddress) return null;

        return (
          <IconButton
            label={tr("marketPage.removeFromWatchlist")}
            kind="ghost"
            size="sm"
            disabled={Boolean(entry.pending)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void toggleWallet(walletAddress);
            }}
          >
            <StarFilled size={16} fill={cds.backgroundBrand} />
          </IconButton>
        );
      },
      (value: unknown) => {
        const walletAddress = typeof value === "string" ? value : "";
        return (
          <Stack
            orientation="horizontal"
            gap={2}
            style={{ alignItems: "center" }}
          >
            <Link href={`/wallets/${walletAddress}`}>
              {fmt.text.address(walletAddress)}
            </Link>
            <CpyBtn size="xs" copyWhat={walletAddress} />
          </Stack>
        );
      },
      (value: unknown) => (typeof value === "string" ? value : "-"),
    ],
    [fmt, toggleWallet, tr],
  );

  const tokenLoading = isLoading || tokenMeta.isLoading || marketData.isLoading;
  const walletLoading = isLoading || linkedWallets.isLoading;

  const tokenTable =
    tokenTableData.length === 0 && !tokenLoading ? (
      <ProfileUnavailableState
        title={tr("profileTabs.watchlist.emptyTokenTitle")}
        description={tr("profileTabs.watchlist.emptyTokenDescription")}
      />
    ) : (
      <Table
        title={tr("profileTabs.watchlist.tokenTableTitle")}
        headers={tokenHeaders}
        initialFilters={{}}
        fetcher={Promise.resolve(tokenTableData)}
        filterSchema={{}}
        cellRenderers={tokenCellRenderers}
        dataEntries={tokenTableData}
        isSortable={[
          false,
          false,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          false,
        ]}
        sortConfigs={{
          2: { type: SortType.Number },
          3: { type: SortType.Number },
          4: { type: SortType.Number },
          5: { type: SortType.Number },
          6: { type: SortType.Number },
          7: { type: SortType.Number },
          8: { type: SortType.Number },
        }}
        loading={tokenLoading}
        maxHeight={520}
        onRowClick={(row) => {
          const tokenAddress =
            typeof row?.[0] === "object" && row[0] != null
              ? (row[0] as { tokenAddress?: string }).tokenAddress
              : undefined;
          if (tokenAddress) {
            navigate(`/tokens/${tokenAddress}`);
          }
        }}
      />
    );

  const walletTable =
    walletTableData.length === 0 && !walletLoading ? (
      <ProfileUnavailableState
        title={tr("profileTabs.watchlist.emptyWalletTitle")}
        description={tr("profileTabs.watchlist.emptyWalletDescription")}
      />
    ) : (
      <Table
        title={tr("profileTabs.watchlist.walletTableTitle")}
        headers={walletHeaders}
        initialFilters={{}}
        fetcher={Promise.resolve(walletTableData)}
        filterSchema={{}}
        cellRenderers={walletCellRenderers}
        dataEntries={walletTableData}
        isSortable={[false, false, true]}
        sortConfigs={{
          2: { type: SortType.String },
        }}
        loading={walletLoading}
        maxHeight={520}
        onRowClick={(row) => {
          const walletAddress =
            typeof row?.[0] === "object" && row[0] != null
              ? (row[0] as { walletAddress?: string }).walletAddress
              : undefined;
          if (walletAddress) {
            navigate(`/wallets/${walletAddress}`);
          }
        }}
      />
    );

  return (
    <section className={styles.contentStack}>
      <div className={styles.watchlistTabContainer}>
        <TabContainer
          activeTab={activeSubtab}
          onTabChange={setActiveSubtab}
          names={[
            tr("profileTabs.watchlist.walletSubtab"),
            tr("profileTabs.watchlist.tokenSubtab"),
          ]}
          tabIcons={[
            <Wallet key="wallet" size={16} />,
            <StarFilled key="token" size={16} fill={cds.iconPrimary} />,
          ]}
          tabs={[walletTable, tokenTable]}
        />
      </div>
    </section>
  );
}

export default ProfileWatchlistTab;
