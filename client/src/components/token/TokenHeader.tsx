import { COINGECKO_THUMBNAIL_URL, PLACEHOLDER_IMAGE_URL } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Copy, LogoDiscord, Search, Wikis } from "@carbon/icons-react";
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
          src={imageUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
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


    </>
  );
};
