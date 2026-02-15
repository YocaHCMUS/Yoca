import { Copy, Wikis, LogoDiscord, Search } from "@carbon/icons-react";
import styles from "./TokenHeader.module.scss";

interface TokenHeaderProps {
  name: string;
  symbol?: string;
  address: string;
  imageUrl?: string;
  coinGeckoId?: string | null;
  discordInvite?: string | null; // Discord invite code, e.g., "jup"
  websiteUrl?: string | null;
  twitterHandle?: string | null;
  tokenAge?: string | null;
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
}: TokenHeaderProps) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
  };

  const searchOnTwitter = () => {
    if (twitterHandle) {
      window.open(`https://twitter.com/${twitterHandle}`, "_blank");
    } else {
      const query = symbol || name;
      window.open(
        `https://twitter.com/search?q=${encodeURIComponent(query)}`,
        "_blank",
      );
    }
  };

  const openWebsite = () => {
    if (websiteUrl) {
      window.open(websiteUrl, "_blank");
    }
  };

  const openCoinGecko = () => {
    if (coinGeckoId) {
      // Use coinGecko ID for proper URL
      window.open(
        `https://www.coingecko.com/en/coins/${coinGeckoId}`,
        "_blank",
      );
    } else {
      // Fallback to contract address (may or may not work)
      window.open(
        `https://www.coingecko.com/en/coins/solana/contract/${address}`,
        "_blank",
      );
    }
  };

  const openDiscord = () => {
    if (discordInvite) {
      window.open(`https://discord.com/invite/${discordInvite}`, "_blank");
    }
  };

  return (
    <div className={styles.container}>
      <img
        className={styles.image}
        src={imageUrl ?? "https://placehold.co/48x48"}
        alt={name}
      />
      <div className={styles.info}>
        <div className={styles.row}>
          <span className={styles.symbol}>{symbol}</span>
          <span className={styles.name}>{name}</span>
        </div>
        <div className={styles.row}>
          {tokenAge && <div className={styles.ageBadge}>{tokenAge}</div>}
          <div className={styles.addressGroup} onClick={copyToClipboard}>
            <span className={styles.address}>
              {address.slice(0, 4)}...{address.slice(-4)}
            </span>
          </div>

          {/* External Links */}
          <div className={styles.externalLinks}>
            <button
              className={styles.iconButton}
              onClick={copyToClipboard}
              title="Copy Address"
            >
              <Copy size={12} />
            </button>
            {websiteUrl && (
              <button
                className={styles.iconButton}
                onClick={openWebsite}
                title="Website"
                style={{ color: "#3b82f6" }}
              >
                <Wikis size={12} />
              </button>
            )}
            {twitterHandle && (
              <button
                className={styles.iconButton}
                onClick={searchOnTwitter}
                title="X (Twitter)"
                style={{ color: "#3b82f6" }}
              >
                {/* Custom X Logo SVG */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                </svg>
              </button>
            )}
            <button
              className={styles.iconButton}
              onClick={searchOnTwitter}
              title="Search on X"
              style={{ color: "#3b82f6" }}
            >
              <Search size={14} />
            </button>
            {discordInvite && (
              <button
                className={styles.iconButton}
                onClick={openDiscord}
                title="Join Discord"
              >
                <LogoDiscord size={14} />
              </button>
            )}
            <button
              className={styles.iconButton}
              onClick={openCoinGecko}
              title="View on CoinGecko"
            >
              <img
                src="https://static.coingecko.com/s/thumbnail-007177f3eca19695592f0b8b0eabbdae282b54154e1be912285c9034ea6cbaf2.png"
                alt="CoinGecko"
                className={styles.coingeckoIcon}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
