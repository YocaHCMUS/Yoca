import client from "@/api/main";
import SparklineChart from "@/components/charts/SparklineChart";
import { CpyBtn } from "@/components/CpyBtn";
import ProfileUnavailableState from "@/components/profile/ProfileUnavailableState";
import TabContainer from "@/components/tabContainer/tabContainer";
import Tble from "@/components/Tble";
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
        const rows = (linkedWallets.data as LinkedWalletsResponse | undefined)?.rows ?? [];

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
        { key: "favorite", header: "", width: 56, align: "center" as const },
        { key: "token", header: tr("marketPage.token"), align: "start" as const },
        { key: "price", header: tr("marketPage.price"), align: "end" as const },
        { key: "change1h", header: "1h", align: "end" as const },
        { key: "change24h", header: "24h", align: "end" as const },
        { key: "change7d", header: "7d", align: "end" as const },
        {
            key: "volume24h",
            header: tr("marketPage.volume24h"),
            align: "end" as const,
        },
        {
            key: "marketCap",
            header: tr("marketPage.marketCap"),
            align: "end" as const,
        },
        { key: "fdv", header: tr("token.marketStats.fdv"), align: "end" as const },
        {
            key: "sparkline",
            header: tr("nav.searchLast7Days"),
            align: "end" as const,
            width: "15%",
        },
    ];

    const walletHeaders = [
        {
            key: "favorite",
            header: "",
            width: 56,
            align: "center" as const,
        },
        {
            key: "walletAddress",
            header: tr("profileTabs.watchlist.walletAddress"),
            align: "start" as const,
        },
        {
            key: "identity",
            header: tr("profileTabs.watchlist.walletIdentity"),
            align: "start" as const,
        },
    ];

    const tokenRows = useMemo(() => {
        return tokenWatchlist.map((tokenAddress) => {
            const meta = tokenMetaByAddress[tokenAddress];
            const market = marketByAddress[tokenAddress];
            const symbol = meta?.symbol?.toUpperCase() ?? fmt.text.address(tokenAddress);
            const name = meta?.name ?? tokenAddress;

            return {
                id: tokenAddress,
                favorite: (
                    <IconButton
                        label={tr("marketPage.removeFromWatchlist")}
                        kind="ghost"
                        size="sm"
                        disabled={Boolean(tokenPending[tokenAddress])}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void toggleToken(tokenAddress);
                        }}
                    >
                        <StarFilled size={16} fill={cds.backgroundBrand} />
                    </IconButton>
                ),
                token: (
                    <Stack orientation="horizontal" gap={2} style={{ alignItems: "center" }}>
                        <TknImg src={meta?.imageUrl} alt={symbol} size={28} />
                        <Stack gap={1} style={{ justifyContent: "center" }}>
                            <Stack
                                orientation="horizontal"
                                gap={2}
                                style={{ alignItems: "center" }}
                            >
                                <Link href={`/tokens/${tokenAddress}`} style={{ fontFamily: "monospace" }}>
                                    {symbol}
                                </Link>
                                <CpyBtn size="xs" copyWhat={tokenAddress} />
                            </Stack>
                            <Txt secondary ellipsis>
                                {(name ?? "").length > 16 ? `${name.slice(0, 16)}...` : name}
                            </Txt>
                        </Stack>
                    </Stack>
                ),
                price: market ? fmt.num.currency(market.priceUsd) : "-",
                change1h: market ? (
                    <TrendNum
                        value={market.priceChangePercentage1h}
                        formatter={fmt.num.percent}
                    />
                ) : (
                    "-"
                ),
                change24h: market ? (
                    <TrendNum
                        value={market.priceChangePercentage24h}
                        formatter={fmt.num.percent}
                    />
                ) : (
                    "-"
                ),
                change7d: market ? (
                    <TrendNum
                        value={market.priceChangePercentage7d}
                        formatter={fmt.num.percent}
                    />
                ) : (
                    "-"
                ),
                volume24h: market ? fmt.num.compact.currency(market.volume24h) : "-",
                marketCap: market ? fmt.num.compact.currency(market.marketCap) : "-",
                fdv: market ? fmt.num.compact.currency(market.fullyDilutedValuation) : "-",
                sparkline: market ? (
                    <div style={{ width: "100%", height: 40, paddingLeft: 24 }}>
                        <SparklineChart
                            data={market.sparkline7d ?? []}
                            positive={(market.priceChangePercentage7d ?? 0) >= 0}
                        />
                    </div>
                ) : (
                    "-"
                ),
            };
        });
    }, [tokenWatchlist, tokenMetaByAddress, marketByAddress, fmt, tokenPending, toggleToken, tr]);

    const walletRows = useMemo(
        () =>
            walletWatchlist.map((walletAddress) => ({
                id: walletAddress,
                favorite: (
                    <IconButton
                        label={tr("marketPage.removeFromWatchlist")}
                        kind="ghost"
                        size="sm"
                        disabled={Boolean(walletPending[walletAddress])}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void toggleWallet(walletAddress);
                        }}
                    >
                        <StarFilled size={16} fill={cds.backgroundBrand} />
                    </IconButton>
                ),
                walletAddress: (
                    <Stack orientation="horizontal" gap={2} style={{ alignItems: "center" }}>
                        <Link href={`/wallets/${walletAddress}`}>
                            {fmt.text.address(walletAddress)}
                        </Link>
                        <CpyBtn size="xs" copyWhat={walletAddress} />
                    </Stack>
                ),
                identity: linkedWalletIdentity[walletAddress] ?? "-",
            })),
        [walletWatchlist, linkedWalletIdentity, fmt, walletPending, toggleWallet, tr],
    );

    const tokenLoading = isLoading || tokenMeta.isLoading || marketData.isLoading;
    const walletLoading = isLoading || linkedWallets.isLoading;

    const tokenTable = tokenRows.length === 0 && !tokenLoading ? (
        <ProfileUnavailableState
            title={tr("profileTabs.watchlist.emptyTokenTitle")}
            description={tr("profileTabs.watchlist.emptyTokenDescription")}
        />
    ) : (
        <Tble
            boxed
            stickyHeader
            // height={100 %}
            title={tr("profileTabs.watchlist.tokenTableTitle")}
            loading={tokenLoading}
            headers={tokenHeaders}
            rows={tokenRows}
            onRowClick={(row) => navigate(`/tokens/${row.id}`)}
        />
    );

    const walletTable = walletRows.length === 0 && !walletLoading ? (
        <ProfileUnavailableState
            title={tr("profileTabs.watchlist.emptyWalletTitle")}
            description={tr("profileTabs.watchlist.emptyWalletDescription")}
        />
    ) : (
        <Tble
            boxed
            stickyHeader
            // height={100 %}
            title={tr("profileTabs.watchlist.walletTableTitle")}
            loading={walletLoading}
            headers={walletHeaders}
            rows={walletRows}
            onRowClick={(row) => navigate(`/wallets/${row.id}`)}
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
                    tabIcons={[<Wallet key="wallet" size={16} />, <StarFilled key="token" size={16} fill={cds.iconPrimary} />]}
                    tabs={[walletTable, tokenTable]}
                />
            </div>
        </section>
    );
}

export default ProfileWatchlistTab;
