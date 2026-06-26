import { useEffect, useState, type MouseEvent } from "react";
import {
  Bot,
  Copy,
  Plus,
  Star,
  Tag,
  Trash2,
  WalletCards,
} from "lucide-react";
import { TknImg } from "@/components/TknImg";
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
}

type SidebarTab = "watchlist" | "labels" | null;

const formatAddress = (addr: string) => {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
};

function TokenWatchlistRow({ token }: { token: string }) {
  const navigate = useNavigate();
  const { toggleToken } = useWatchlist();
  const { fmt, tr } = useLocalization();
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
    ? tokenMarket.data.find((item) => item.address === token) ?? tokenMarket.data[0]
    : tokenMarket.data?.[token];
  const metaData = Array.isArray(tokenMeta.data)
    ? tokenMeta.data.find((item) => item.address === token) ?? tokenMeta.data[0]
    : tokenMeta.data?.[token];
  const symbol = metaData?.symbol?.toUpperCase() ?? formatAddress(token);
  const change = marketData?.priceChangePercentage24h;
  const positive = typeof change === "number" && change > 0;
  const negative = typeof change === "number" && change < 0;

  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.assetRow}
      onClick={() => navigate(`/tokens/${token}`)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(`/tokens/${token}`); }}
      title={token}
    >
      <span className={styles.assetIcon}>
        <TknImg
          src={metaData?.imageUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${token}`}
          size={24}
          alt={symbol}
        />
      </span>
      <span className={styles.assetIdentity}>
        <strong>{symbol}</strong>
        <small>{formatAddress(token)}</small>
      </span>
      <span className={styles.assetValue}>
        <strong>{marketData?.priceUsd != null ? fmt.num.currency(marketData.priceUsd) : "—"}</strong>
        <small className={positive ? styles.positive : negative ? styles.negative : ""}>
          {typeof change === "number" ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
        </small>
      </span>
      <span
        role="button"
        tabIndex={0}
        className={styles.rowRemove}
        onClick={(event) => {
          event.stopPropagation();
          toggleToken(token);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            toggleToken(token);
          }
        }}
        aria-label={tr("walletPage.ui.removeToken")}
      >
        <Trash2 size={14} />
      </span>
    </div>
  );
}

function WalletWatchlistRow({ wallet }: { wallet: string }) {
  const navigate = useNavigate();
  const { toggleWallet } = useWatchlist();
  const { fmt, tr } = useLocalization();
  const [todayVolume, setTodayVolume] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchWalletOverview(wallet)
      .then((data) => {
        const stats = data?.periods?.["24H"];
        const volume = Number(stats?.buy?.volumeUsd ?? 0) + Number(stats?.sell?.volumeUsd ?? 0);
        if (!cancelled) setTodayVolume(volume);
      })
      .catch(() => {
        if (!cancelled) setTodayVolume(null);
      });
    return () => { cancelled = true; };
  }, [wallet]);

  return (
    <div role="button" tabIndex={0} className={styles.walletRow} onClick={() => navigate(`/wallets/${wallet}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(`/wallets/${wallet}`); }}>
      <span className={styles.walletAvatar}><WalletCards size={16} /></span>
      <span className={styles.assetIdentity}>
        <strong>{formatAddress(wallet)}</strong>
        <small>{wallet.slice(0, 10)}…</small>
      </span>
      <span className={styles.assetValue}>
        <strong>{todayVolume == null ? "—" : fmt.num.compact.currency(todayVolume)}</strong>
        <small>{tr("walletPage.ui.todayVolume")}</small>
      </span>
      <span
        role="button"
        tabIndex={0}
        className={styles.rowRemove}
        onClick={(event) => {
          event.stopPropagation();
          toggleWallet(wallet);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            toggleWallet(wallet);
          }
        }}
        aria-label={tr("walletPage.ui.removeWallet")}
      >
        <Trash2 size={14} />
      </span>
    </div>
  );
}

export function RightSidebar({
  onToggle,
  isChatOpen = false,
  onChatToggle,
  noChatToggle = false,
}: RightSidebarProps) {
  const navigate = useNavigate();
  const { tr } = useLocalization();
  const { tokenWatchlist, walletWatchlist, addToken } = useWatchlist();
  const { labels } = useWalletLabels();
  const [activeTab, setActiveTab] = useState<SidebarTab>(null);
  const [tokenAddress, setTokenAddress] = useState("");

  useEffect(() => {
    onToggle?.(activeTab !== null);
  }, [activeTab, onToggle]);

  const toggleTab = (tab: Exclude<SidebarTab, null>) => {
    setActiveTab((current) => current === tab ? null : tab);
  };

  const addWatchToken = () => {
    const value = tokenAddress.trim();
    if (!value) return;
    addToken(value);
    setTokenAddress("");
  };

  const copyAddress = (event: MouseEvent<HTMLButtonElement>, address: string) => {
    event.stopPropagation();
    void navigator.clipboard?.writeText(address);
  };

  return (
    <aside className={styles.container} aria-label={tr("walletPage.ui.actions")}>
      <div className={styles.panel} data-visible={activeTab !== null}>
        {activeTab === "watchlist" && (
          <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{tr("walletPage.ui.tokenWatchlist")}</span>
                <h3>{tr("walletPage.holdings")}</h3>
              </div>
              <span className={styles.counter}>{tokenWatchlist.length}</span>
            </div>

            <div className={styles.addTokenForm}>
              <input
                value={tokenAddress}
                onChange={(event) => setTokenAddress(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addWatchToken();
                }}
                placeholder={tr("walletPage.ui.addTokenAddress")}
                aria-label={tr("walletPage.ui.addTokenAddress")}
              />
              <button type="button" onClick={addWatchToken} disabled={!tokenAddress.trim()} aria-label={tr("walletPage.ui.add")}>
                <Plus size={15} />
              </button>
            </div>

            <div className={styles.rowList}>
              {tokenWatchlist.length === 0 ? (
                <p className={styles.emptyState}>{tr("walletPage.ui.noTokensWatched")}</p>
              ) : tokenWatchlist.map((token) => <TokenWatchlistRow key={token} token={token} />)}
            </div>

            <div className={styles.divider} />

            <div className={styles.subHeader}>
              <span>{tr("walletPage.ui.walletWatchlist")}</span>
              <span>{walletWatchlist.length}</span>
            </div>
            <div className={styles.rowList}>
              {walletWatchlist.length === 0 ? (
                <p className={styles.emptyState}>{tr("walletPage.ui.noWalletsWatched")}</p>
              ) : walletWatchlist.map((wallet) => <WalletWatchlistRow key={wallet} wallet={wallet} />)}
            </div>
          </div>
        )}

        {activeTab === "labels" && (
          <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>{tr("walletPage.ui.labels")}</span>
                <h3>{tr("walletPage.manageTagsLabel")}</h3>
              </div>
              <span className={styles.counter}>{Object.keys(labels).length}</span>
            </div>
            <div className={styles.rowList}>
              {Object.keys(labels).length === 0 ? (
                <p className={styles.emptyState}>{tr("walletPage.ui.noLabels")}</p>
              ) : Object.entries(labels).map(([address, label]) => (
                <div key={address} role="button" tabIndex={0} className={styles.labelRow} onClick={() => navigate(`/wallets/${address}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(`/wallets/${address}`); }}>
                  <span>
                    <strong>{label}</strong>
                    <small>{formatAddress(address)}</small>
                  </span>
                  <span className={styles.labelActions}>
                    <button type="button" onClick={(event) => copyAddress(event, address)} aria-label={tr("walletPage.ui.copyAddress")}>
                      <Copy size={14} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <nav className={styles.toolbar} aria-label={tr("walletPage.ui.actions")}>
        <button
          type="button"
          className={`${styles.toolBtn} ${activeTab === "watchlist" ? styles.toolBtnActive : ""}`}
          onClick={() => toggleTab("watchlist")}
          title={tr("walletPage.ui.tokenWatchlist")}
          aria-label={tr("walletPage.ui.tokenWatchlist")}
        >
          <Star size={18} fill={activeTab === "watchlist" ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${activeTab === "labels" ? styles.toolBtnActive : ""}`}
          onClick={() => toggleTab("labels")}
          title={tr("walletPage.ui.labels")}
          aria-label={tr("walletPage.ui.labels")}
        >
          <Tag size={18} />
        </button>
        {!noChatToggle && (
          <button
            type="button"
            className={`${styles.toolBtn} ${isChatOpen ? styles.toolBtnActive : ""}`}
            onClick={onChatToggle}
            title={tr("walletPage.aiAnalysis")}
            aria-label={tr("walletPage.aiAnalysis")}
          >
            <Bot size={18} />
          </button>
        )}
      </nav>
    </aside>
  );
}
