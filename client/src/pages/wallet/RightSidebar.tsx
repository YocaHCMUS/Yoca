import { useState, useEffect } from "react";
import {
    Star,
    StarFilled,
    Tag,
    Settings,
    Copy,
    ChevronDown,
    ChartLine,
    TrashCan,
    Add,
    AiGenerate,
} from "@carbon/icons-react";
import { TknImg } from "@/components/TknImg";
import TokenSearch from "@/components/TokenSearch/TokenSearch";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useWalletLabels } from "@/hooks/profile/useWalletLabels";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { LangKeys } from "@/config/localization";
import { useNavigate } from "react-router";
import styles from "./RightSidebar.module.scss";
import { useGet } from "@/hooks/useGet";
import client from "@/api/main";

import { fetchWalletOverview } from "@/services/wallet/walletApi";
import { WalletChat } from "@/components/wallet/WalletChat";

interface RightSidebarProps {
  currentAddress: string;
  onToggle?: (isOpen: boolean) => void;
  address?: string;
  lang?: LangKeys;
}

const formatAddress = (addr: string) => {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
};

function TokenWatchlistRow({ token }: { token: string }) {
  const navigate = useNavigate();
  const { toggleToken } = useWatchlist();
  const { fmt } = useLocalization();
  const [hovered, setHovered] = useState(false);
  const tokenMarket = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: token } },
    { enabled: !!token }
  );

  const tokenMeta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: token } },
    { enabled: !!token }
  );

  const marketData = Array.isArray(tokenMarket.data) ? tokenMarket.data.find(d => d.address === token) || tokenMarket.data[0] : tokenMarket.data?.[token];
  const metaData = Array.isArray(tokenMeta.data) ? tokenMeta.data.find(d => d.address === token) || tokenMeta.data[0] : tokenMeta.data?.[token];
  const price = marketData?.priceUsd;
  const change24h = marketData?.priceChangePercentage24h;
  const volume24h = marketData?.volume24h;
  
  const formatChange = (val: number | null | undefined) => {
    if (val == null) return { text: '—', positive: null };
    return { text: `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`, positive: val > 0 ? true : val < 0 ? false : null };
  };
  
  const { text: changeText, positive: changePositive } = formatChange(change24h);
  const formatVol = (val: number | null | undefined) => {
    if (val == null || val === 0) return '$0';
    return fmt.num.compact.currency(val);
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
              src={metaData?.imageUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${token}`} 
              size={16}
              alt={symbol} 
            />
         </div>
         <span className={styles.tokenName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{symbol}</span>
      </div>
      <div className={styles.td} style={{ flex: 1, textAlign: 'right' }}>
        {isLoading ? '...' : (price != null ? fmt.num.currency(price) : '—')}
      </div>
      <div className={styles.td} style={{ flex: 1, textAlign: 'right', color: changePositive === true ? '#24a148' : changePositive === false ? '#da1e28' : 'inherit' }}>
        {isLoading ? '...' : (changeText === '—' ? '—' : changeText)}
      </div>
      <div className={styles.td} style={{ flex: 1, textAlign: 'right' }}>
        {isLoading ? '...' : (volume24h != null && volume24h !== 0 ? formatVol(volume24h) : '—')}
      </div>
      <button
        className={styles.deleteBtn}
        style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'auto' : 'none' }}
        onClick={(e) => { e.stopPropagation(); toggleToken(token); }}
      >
        <TrashCan size={16} />
      </button>
    </div>
  );
}

function WalletWatchlistRow({ wallet }: { wallet: string }) {
  const navigate = useNavigate();
  const { toggleWallet } = useWatchlist();
  const { fmt } = useLocalization();
  const [overview, setOverview] = useState<any>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (wallet) {
      fetchWalletOverview(wallet)
        .then((data) => setOverview(data))
        .catch((err) => console.error("Failed to fetch wallet overview:", err));
    }
  }, [wallet]);

  const stats = overview?.periods?.["24H"];
  const buyVol = stats?.buy?.volumeUsd || 0;
  const sellVol = stats?.sell?.volumeUsd || 0;
  const todayVolume = buyVol + sellVol;

  const formatVol = (val: number | null | undefined) => {
    if (val == null || val === 0) return '$0';
    return fmt.num.compact.currency(val);
  };

  return (
    <div
      className={styles.tr}
      onClick={() => navigate(`/wallets/${wallet}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.td} style={{ flex: 2 }}>
         <span className={styles.addressLink}>{formatAddress(wallet)}</span>
      </div>
      <div className={styles.td} style={{ flex: 1, textAlign: 'right' }}>
        {formatVol(todayVolume)}
      </div>
      <button
        className={styles.deleteBtn}
        style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'auto' : 'none' }}
        onClick={(e) => { e.stopPropagation(); toggleWallet(wallet); }}
      >
        <TrashCan size={16} />
      </button>
    </div>
  );
}

export function RightSidebar({ currentAddress, onToggle, address: chatAddress, lang }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"watchlist" | "labels" | "ai-chat" | null>(null);
  const [isAddingToken, setIsAddingToken] = useState(false);

  useEffect(() => {
    onToggle?.(activeTab !== null);
  }, [activeTab, onToggle]);
  const { tokenWatchlist, walletWatchlist, addToken } = useWatchlist();
  const { labels, setLabel } = useWalletLabels();
  const [draftLabel, setDraftLabel] = useState<string>('');
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // We no longer need to manually listen to wallet-labels-updated since React Query handles reactivity.
  }, []);

  const handleCopy = (e: any, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={styles.container} style={{ width: activeTab ? (activeTab === "ai-chat" ? "360px" : "308px") : "48px" }}>
      {/* Expanded Panel Area */}
      {activeTab && (
        <div className={styles.panel} style={activeTab === "ai-chat" ? { width: "312px", overflow: "hidden", padding: 0 } : undefined}>
          {/* WATCHLIST TAB */}
          {activeTab === "watchlist" && (
            <>
              {/* Token Section Container */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Token Watchlist Section */}
                <div className={styles.sectionHeader}>
                  <div className={styles.headerLeft}>
                    <div className={styles.headerSquare} style={{ backgroundColor: '#20b2aa' }} />
                    <span>Watchlist ({tokenWatchlist.length})</span>
                    <ChevronDown size={16} />
                  </div>
                  <div className={styles.headerIcons}>
                    <Add size={16} className={styles.iconBtn} onClick={() => setIsAddingToken(!isAddingToken)} />
                  </div>
                </div>

                {isAddingToken && (
                  <div style={{ padding: '8px', borderBottom: '1px solid var(--cds-border-subtle)' }}>
                    <TokenSearch 
                      setValue={(val) => {
                        if (val?.address) {
                          addToken(val.address);
                        }
                      }} 
                      closePanel={() => setIsAddingToken(false)} 
                    />
                  </div>
                )}
                
                <div className={styles.tableHeader}>
                  <div className={styles.th} style={{ flex: 2 }}>TOKEN</div>
                  <div className={styles.th} style={{ flex: 1, textAlign: 'right' }}>PRICE</div>
                  <div className={styles.th} style={{ flex: 1, textAlign: 'right' }}>%CHG</div>
                  <div className={styles.th} style={{ flex: 1, textAlign: 'right' }}>VOL</div>
                </div>
                <div className={styles.tableBody} style={{ overflowY: 'auto', flex: 1 }}>
                  {tokenWatchlist.length === 0 ? (
                    <div className={styles.emptyState}>No tokens watched</div>
                  ) : (
                    tokenWatchlist.map((token, i) => (
                      <TokenWatchlistRow key={`token-${i}`} token={token} />
                    ))
                  )}
                </div>
              </div>

              {/* Splitter */}
              <div className={styles.splitter}>
              </div>

              {/* Wallet Section Container */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Wallet Watchlist Section */}
                <div className={styles.sectionHeader}>
                  <div className={styles.headerLeft}>
                    <div className={styles.headerSquare} style={{backgroundColor: '#0f62fe'}} />
                    <span>Watchlist ({walletWatchlist.length})</span>
                    <ChevronDown size={16} />
                  </div>
                  <div className={styles.headerIcons}>
                  </div>
                </div>
                
                <div className={styles.tableHeader}>
                  <div className={styles.th} style={{ flex: 2 }}>WALLET</div>
                  <div className={styles.th} style={{ flex: 1, textAlign: 'right' }}>TODAY VOLUME</div>
                </div>
                <div className={styles.tableBody} style={{ overflowY: 'auto', flex: 1 }}>
                  {walletWatchlist.length === 0 ? (
                    <div className={styles.emptyState}>No wallets watched</div>
                  ) : (
                    walletWatchlist.map((wallet, i) => (
                      <WalletWatchlistRow key={`wallet-${i}`} wallet={wallet} />
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* LABELS TAB */}
          {activeTab === "labels" && (
            <>
              <div className={styles.sectionHeader}>
                <div className={styles.headerLeft}>
                  <span style={{textTransform: 'uppercase', letterSpacing: '1px'}}>LABEL</span>
                </div>
                <div className={styles.headerIcons}>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {Object.keys(labels).length === 0 ? (
                  <div className={styles.emptyState}>No labels created</div>
                ) : (
                  Object.entries(labels).map(([address, label], i) => (
                    <div key={`label-${i}`} className={styles.labelRow}>
                      <span className={styles.labelName}>{label}</span>
                      <div className={styles.labelAddress}>
                        <span className={styles.addressLink} onClick={() => navigate(`/wallets/${address}`)}>
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

          {/* AI CHAT TAB */}
          {activeTab === "ai-chat" && chatAddress && (
            <WalletChat
              address={chatAddress}
              lang={lang}
              variant="sidebar"
            />
          )}
        </div>
      )}

      {/* Toolbar Area (Always visible on the right) */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <button 
            className={`${styles.toolBtn} ${activeTab === "watchlist" ? styles.toolBtnActive : ""}`}
            onClick={() => setActiveTab(activeTab === "watchlist" ? null : "watchlist")}
          >
            {activeTab === "watchlist" ? <StarFilled size={20} /> : <Star size={20} />}
          </button>
          <button 
            className={`${styles.toolBtn} ${activeTab === "labels" ? styles.toolBtnActive : ""}`}
            onClick={() => setActiveTab(activeTab === "labels" ? null : "labels")}
          >
            <Tag size={20} />
          </button>
          <button 
            className={`${styles.toolBtn} ${activeTab === "ai-chat" ? styles.toolBtnActive : ""}`}
            onClick={() => setActiveTab(activeTab === "ai-chat" ? null : "ai-chat")}
            title="AI Chat"
          >
            <AiGenerate size={20} />
          </button>
        </div>
        
        <div className={styles.toolbarBottom}>
          <button className={styles.toolBtn}>
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
