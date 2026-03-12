import { BUBBLEMAPS_SOL_URL, COINGECKO_THUMBNAIL_URL, PLACEHOLDER_IMAGE_URL } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Copy, LogoDiscord, Search, Wikis } from "@carbon/icons-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import styles from "./TokenHeader.module.scss";

interface TokenHeaderProps {
  name: string;
  symbol?: string;
  address: string;
  imageUrl?: string;
  coinGeckoId?: string | null;
  discordInvite?: string | null;
  websiteUrl?: string | null;
  twitterHandle?: string | null;
  tokenAge?: string | null;
  marketCapRank?: number | null;
  /** If true, only show logo + symbol + name + rank (no address/icons) */
  compact?: boolean;
}

export const TokenHeader = ({
  name,
  symbol,
  address,
  imageUrl,
  coinGeckoId,
  discordInvite,
  websiteUrl,
  twitterHandle,
  tokenAge,
  marketCapRank,
  compact = false,
}: TokenHeaderProps) => {
  const copyToClipboard = () => navigator.clipboard.writeText(address);
  const { tr } = useLocalization();
  const [bubblemapsOpen, setBubblemapsOpen] = useState(false);
  const bubblemapsUrl = `${BUBBLEMAPS_SOL_URL}/${address}`;

  const openWebsite = () => websiteUrl && window.open(websiteUrl, "_blank");

  const searchOnTwitter = () => {
    const target = twitterHandle
      ? `https://twitter.com/${twitterHandle}`
      : `https://twitter.com/search?q=${encodeURIComponent(symbol || name)}`;
    window.open(target, "_blank");
  };

  const openCoinGecko = () => {
    const url = coinGeckoId
      ? `https://www.coingecko.com/en/coins/${coinGeckoId}`
      : `https://www.coingecko.com/en/coins/solana/contract/${address}`;
    window.open(url, "_blank");
  };

  const openDiscord = () =>
    discordInvite && window.open(`https://discord.com/invite/${discordInvite}`, "_blank");

  return (
    <>
    <div className={`${styles.container} ${compact ? styles.compact : ""}`}>
      <img
        className={styles.image}
        src={imageUrl ?? PLACEHOLDER_IMAGE_URL}
        alt={name}
      />
      <div className={styles.info}>
        <div className={styles.row}>
          <span className={styles.symbol}>{symbol}</span>
          <span className={styles.name}>{name}</span>
          {marketCapRank != null && (
            <span className={styles.rankBadge}>#{marketCapRank}</span>
          )}
        </div>

        {!compact && (
          <div className={styles.row}>
            {tokenAge && <div className={styles.ageBadge}>{tokenAge}</div>}
            <div className={styles.addressGroup}>
              <span className={styles.address}>
                {address.slice(0, 4)}...{address.slice(-4)}
              </span>
            </div>

            <div className={styles.externalLinks}>
              <button className={styles.iconBtn} title={tr("token.header.copy")} onClick={copyToClipboard}>
                <Copy size={14} />
              </button>

              <button className={styles.iconBtn} title="Bubblemaps" onClick={() => setBubblemapsOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 100 100" fill="currentColor">
                  <circle cx="50" cy="30" r="18" />
                  <circle cx="22" cy="65" r="13" />
                  <circle cx="50" cy="72" r="10" />
                  <circle cx="76" cy="62" r="15" />
                  <line x1="50" y1="48" x2="22" y2="65" stroke="currentColor" strokeWidth="4" />
                  <line x1="50" y1="48" x2="50" y2="72" stroke="currentColor" strokeWidth="4" />
                  <line x1="50" y1="48" x2="76" y2="62" stroke="currentColor" strokeWidth="4" />
                </svg>
              </button>

              {websiteUrl && (
                <button className={styles.iconBtn} title={tr("token.website")} onClick={openWebsite}>
                  <Wikis size={14} />
                </button>
              )}

              {twitterHandle && (
                <button className={styles.iconBtn} title={tr("token.header.twitter")} onClick={searchOnTwitter}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                  </svg>
                </button>
              )}

              <button className={styles.iconBtn} title={tr("token.header.searchX")} onClick={searchOnTwitter}>
                <Search size={14} />
              </button>

              {discordInvite && (
                <button className={styles.iconBtn} title={tr("token.header.discord")} onClick={openDiscord}>
                  <LogoDiscord size={14} />
                </button>
              )}

              <button className={styles.iconBtn} title={tr("token.header.coingecko")} onClick={openCoinGecko}>
                <img
                  src={COINGECKO_THUMBNAIL_URL}
                  alt="CoinGecko"
                  className={styles.coingeckoIcon}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {bubblemapsOpen && createPortal(
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={() => setBubblemapsOpen(false)}
      >
        <div
          style={{ position: "relative", width: "min(960px, 94vw)", height: "min(700px, 90vh)", background: "#111", borderRadius: 10, overflow: "hidden", boxShadow: "0 12px 48px rgba(0,0,0,0.6)" }}
          onClick={e => e.stopPropagation()}
        >
          <button
            style={{ position: "absolute", top: 10, right: 12, zIndex: 10, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, color: "#fff" }}
            onClick={() => setBubblemapsOpen(false)}
          >✕</button>
          <iframe
            src={bubblemapsUrl}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="Bubblemaps"
            allow="fullscreen"
          />
        </div>
      </div>,
      document.body,
    )}
  </>
  );
};
