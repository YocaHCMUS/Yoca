import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactSVGElement } from "react";
import {
  Add,
  AiGenerate,
  Checkmark,
  ChevronDown,
  Copy,
  Settings,
  Star,
  StarFilled,
  Tag,
  TrashCan,
} from "@carbon/icons-react";
import { TknImg } from "@/components/TknImg";
import TokenSearch from "@/components/TokenSearch/TokenSearch";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useWalletLabels } from "@/hooks/profile/useWalletLabels";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useNavigate } from "react-router";
import styles from "./RightSidebar.module.scss";
import { useGet } from "@/hooks/useGet";
import client from "@/api/main";

import { fetchWalletOverview } from "@/services/wallet/walletApi";

interface RightSidebarProps {
  onToggle?: (isOpen: boolean) => void;
  isChatOpen?: boolean;
  onChatToggle?: () => void;
  noChatToggle?: boolean;
  comparisonWallets?: readonly string[];
  maxComparisonWallets?: number;
  onAddComparisonWallet?: (wallet: string) => void;
}

const formatAddress = (addr: string) => {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
};

function TokenWatchlistRow({ token }: { token: string }) {
  const navigate = useNavigate();
  const { toggleToken } = useWatchlist();
  const { fmt, tr } = useLocalization();
  const [hovered, setHovered] = useState(false);
  const tokenMarket = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: token } },
    { enabled: !!token },
  );

  const tokenMeta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: token } },
    { enabled: !!token },
  );

  const marketData = Array.isArray(tokenMarket.data)
    ? tokenMarket.data.find((d) => d.address === token) || tokenMarket.data[0]
    : tokenMarket.data?.[token];
  const metaData = Array.isArray(tokenMeta.data)
    ? tokenMeta.data.find((d) => d.address === token) || tokenMeta.data[0]
    : tokenMeta.data?.[token];
  const price = marketData?.priceUsd;
  const change24h = marketData?.priceChangePercentage24h;
  const volume24h = marketData?.volume24h;

  const formatChange = (val: number | null | undefined) => {
    if (val == null) return { text: "-", positive: null };
    return {
      text: `${val >= 0 ? "+" : "-"}${fmt.num.percent(val, true)}`,
      positive: val > 0 ? true : val < 0 ? false : null,
    };
  };

  const { text: changeText, positive: changePositive } = formatChange(change24h);
  const formatVol = (val: number | null | undefined) => {
    return fmt.num.compact.currency(val ?? 0);
  };

  const symbol = metaData?.symbol?.toUpperCase() ?? formatAddress(token);
  const isLoading = tokenMarket.isLoading || tokenMeta.isLoading;

  return (
    <div
      className={styles.tr}
      onClick={() => navigate(`/tokens/${token}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.td} style={{ flex: 2 }}>
        <div style={{ marginRight: 8 }}>
          <TknImg
            src={
              metaData?.imageUrl ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${token}`
            }
            size={16}
            alt={symbol}
          />
        </div>
        <span
          className={styles.tokenName}
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {symbol}
        </span>
      </div>
      <div className={styles.td} style={{ flex: 1, textAlign: "right" }}>
        {isLoading ? "..." : price != null ? fmt.num.currency(price) : "-"}
      </div>
      <div
        className={styles.td}
        style={{
          flex: 1,
          textAlign: "right",
          color:
            changePositive === true
              ? "#24a148"
              : changePositive === false
                ? "#da1e28"
                : "inherit",
        }}
      >
        {isLoading ? "..." : changeText === "-" ? "-" : changeText}
      </div>
      <div className={styles.td} style={{ flex: 1, textAlign: "right" }}>
        {isLoading ? "..." : volume24h != null && volume24h !== 0 ? formatVol(volume24h) : "-"}
      </div>
      <button
        type="button"
        className={styles.deleteBtn}
        style={{
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? "auto" : "none",
        }}
        aria-label={tr("rightSidebar.removeToken")}
        title={tr("rightSidebar.removeToken")}
        onClick={(e) => {
          e.stopPropagation();
          void toggleToken(token);
        }}
      >
        <TrashCan size={16} />
      </button>
    </div>
  );
}

interface WalletWatchlistRowProps {
  wallet: string;
  comparisonWallets: readonly string[];
  maxComparisonWallets?: number;
  onAddComparisonWallet?: (wallet: string) => void;
}

function WalletWatchlistRow({
  wallet,
  comparisonWallets,
  maxComparisonWallets,
  onAddComparisonWallet,
}: WalletWatchlistRowProps) {
  const navigate = useNavigate();
  const { toggleWallet } = useWatchlist();
  const { fmt, tr } = useLocalization();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchWalletOverview>> | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (wallet) {
      fetchWalletOverview(wallet)
        .then((data) => setOverview(data))
        .catch((err: unknown) =>
          console.error("Failed to fetch wallet overview:", err),
        );
    }
  }, [wallet]);

  const stats = overview?.periods?.["24H"];
  const buyVol = stats?.buy?.volumeUsd || 0;
  const sellVol = stats?.sell?.volumeUsd || 0;
  const todayVolume = buyVol + sellVol;
  const isInComparison = comparisonWallets.includes(wallet);
  const isComparisonFull =
    typeof maxComparisonWallets === "number" &&
    comparisonWallets.length >= maxComparisonWallets;
  const canAddToComparison =
    Boolean(onAddComparisonWallet) && !isInComparison && !isComparisonFull;
  const compareWalletActionLabel = isInComparison
    ? tr("walletComparison.alreadyInComparison")
    : isComparisonFull
      ? tr("walletComparison.comparisonListFull")
      : tr("walletComparison.addFollowedWalletToComparison");

  const formatVol = (val: number | null | undefined) => {
    return fmt.num.compact.currency(val ?? 0);
  };

  const handleCopy = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void navigator.clipboard.writeText(wallet);
  };

  const handleAddToComparison = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (canAddToComparison) {
      onAddComparisonWallet?.(wallet);
    }
  };

  return (
    <div
      className={styles.tr}
      onClick={() => navigate(`/wallets/${wallet}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.td} style={{ flex: 2 }}>
        <span className={styles.walletIdentity}>
          <span className={styles.addressLink}>{formatAddress(wallet)}</span>
          {onAddComparisonWallet && (
            <button
              type="button"
              className={styles.compareWalletBtn}
              disabled={!canAddToComparison}
              title={compareWalletActionLabel}
              aria-label={compareWalletActionLabel}
              onClick={handleAddToComparison}
            >
              {isInComparison ? <Checkmark size={14} /> : <Add size={14} />}
            </button>
          )}
          <button
            type="button"
            className={styles.copyInlineBtn}
            title={tr("walletComparison.copyAddress")}
            aria-label={tr("walletComparison.copyAddress")}
            onClick={handleCopy}
          >
            <Copy size={14} />
          </button>
        </span>
      </div>
      <div className={styles.td} style={{ flex: 1, textAlign: "right" }}>
        {formatVol(todayVolume)}
      </div>
      <button
        type="button"
        className={styles.deleteBtn}
        style={{
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? "auto" : "none",
        }}
        aria-label={tr("walletComparison.removeWallet")}
        title={tr("walletComparison.removeWallet")}
        onClick={(e) => {
          e.stopPropagation();
          void toggleWallet(wallet);
        }}
      >
        <TrashCan size={16} />
      </button>
    </div>
  );
}

export function RightSidebar({
  onToggle,
  isChatOpen = false,
  onChatToggle,
  noChatToggle = false,
  comparisonWallets = [],
  maxComparisonWallets,
  onAddComparisonWallet,
}: RightSidebarProps) {
  const { tr } = useLocalization();
  const [activeTab, setActiveTab] = useState<"watchlist" | "labels" | null>(null);
  const [isAddingToken, setIsAddingToken] = useState(false);

  useEffect(() => {
    onToggle?.(activeTab !== null);
  }, [activeTab, onToggle]);

  const { tokenWatchlist, walletWatchlist, addToken } = useWatchlist();
  const { labels } = useWalletLabels();
  const navigate = useNavigate();

  const handleCopy = (e: { stopPropagation: () => void }, text: string) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(text);
  };

  return (
    <div className={styles.container}>
      <div className={styles.panel} data-visible={activeTab !== null}>
        {activeTab === "watchlist" && (
          <>
            <div className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.headerLeft}>
                  <div className={`${styles.headerSquare} ${styles.headerSquareMint}`} />
                  <span>{tr("rightSidebar.watchlist")} ({tokenWatchlist.length})</span>
                  <ChevronDown size={16} />
                </div>
                <div className={styles.headerIcons}>
                  <Add
                    size={16}
                    className={styles.iconBtn}
                    aria-label={tr("rightSidebar.addToken")}
                    title={tr("rightSidebar.addToken")}
                    onClick={() => setIsAddingToken(!isAddingToken)}
                  />
                </div>
              </div>

              {isAddingToken && (
                <div className={styles.addTokenPanel}>
                  <TokenSearch
                    setValue={(val) => {
                      if (val?.address) {
                        void addToken(val.address);
                      }
                    }}
                    closePanel={() => setIsAddingToken(false)}
                  />
                </div>
              )}

              <div className={styles.tableHeader}>
                <div className={styles.th} style={{ flex: 2 }}>{tr("rightSidebar.token")}</div>
                <div className={styles.th} style={{ flex: 1, textAlign: "right" }}>{tr("rightSidebar.price")}</div>
                <div className={styles.th} style={{ flex: 1, textAlign: "right" }}>{tr("rightSidebar.changePercent")}</div>
                <div className={styles.th} style={{ flex: 1, textAlign: "right" }}>{tr("rightSidebar.volume")}</div>
              </div>
              <div className={styles.tableBody}>
                {tokenWatchlist.length === 0 ? (
                  <div className={styles.emptyState}>{tr("rightSidebar.noTokensWatched")}</div>
                ) : (
                  tokenWatchlist.map((token, i) => (
                    <TokenWatchlistRow key={`token-${i}`} token={token} />
                  ))
                )}
              </div>
            </div>

            <div className={styles.splitter} />

            <div className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.headerLeft}>
                  <div className={`${styles.headerSquare} ${styles.headerSquareBlue}`} />
                  <span>{tr("rightSidebar.watchlist")} ({walletWatchlist.length})</span>
                  <ChevronDown size={16} />
                </div>
                <div className={styles.headerIcons} />
              </div>

              <div className={styles.tableHeader}>
                <div className={styles.th} style={{ flex: 2 }}>{tr("rightSidebar.wallet")}</div>
                <div className={styles.th} style={{ flex: 1, textAlign: "right" }}>{tr("rightSidebar.todayVolume")}</div>
              </div>
              <div className={styles.tableBody}>
                {walletWatchlist.length === 0 ? (
                  <div className={styles.emptyState}>{tr("rightSidebar.noWalletsWatched")}</div>
                ) : (
                  walletWatchlist.map((wallet, i) => (
                    <WalletWatchlistRow
                      key={`wallet-${i}`}
                      wallet={wallet}
                      comparisonWallets={comparisonWallets}
                      maxComparisonWallets={maxComparisonWallets}
                      onAddComparisonWallet={onAddComparisonWallet}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === "labels" && (
          <>
            <div className={styles.sectionHeader}>
              <div className={styles.headerLeft}>
                <span style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
                  {tr("rightSidebar.label")}
                </span>
              </div>
              <div className={styles.headerIcons} />
            </div>

            <div className={styles.labelBody}>
              {Object.keys(labels).length === 0 ? (
                <div className={styles.emptyState}>{tr("rightSidebar.noLabelsCreated")}</div>
              ) : (
                Object.entries(labels).map(([address, label], i) => (
                  <div key={`label-${i}`} className={styles.labelRow}>
                    <span className={styles.labelName}>{label}</span>
                    <div className={styles.labelAddress}>
                      <span
                        className={styles.addressLink}
                        onClick={() => navigate(`/wallets/${address}`)}
                      >
                        {formatAddress(address)}
                      </span>
                      <Copy
                        size={16}
                        className={styles.copyIcon}
                        onClick={(e) => handleCopy(e, address)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <button
            type="button"
            className={`${styles.toolBtn} ${activeTab === "watchlist" ? styles.toolBtnActive : ""}`}
            aria-label={tr("rightSidebar.watchlist")}
            title={tr("rightSidebar.watchlist")}
            onClick={() => setActiveTab(activeTab === "watchlist" ? null : "watchlist")}
          >
            {activeTab === "watchlist" ? <StarFilled size={20} /> : <Star size={20} />}
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${activeTab === "labels" ? styles.toolBtnActive : ""}`}
            aria-label={tr("rightSidebar.label")}
            title={tr("rightSidebar.label")}
            onClick={() => setActiveTab(activeTab === "labels" ? null : "labels")}
          >
            <Tag size={20} />
          </button>
          {!noChatToggle && (
            <button
              type="button"
              className={`${styles.toolBtn} ${isChatOpen ? styles.toolBtnActive : ""}`}
              onClick={onChatToggle}
              title={tr("rightSidebar.aiChat")}
              aria-label={tr("rightSidebar.aiChat")}
            >
              <AiGenerate size={20} />
            </button>
          )}
        </div>

        <div className={styles.toolbarBottom}>
          <button type="button" className={styles.toolBtn} hidden>
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
