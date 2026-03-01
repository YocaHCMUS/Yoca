import { IconButton } from "@carbon/react";
import { Copy, Wikis, LogoDiscord, Search } from "@carbon/icons-react";
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
  const copyToClipboard = () => navigator.clipboard.writeText(address);

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

          <div className={styles.externalLinks}>
            <IconButton label="Copy Address" kind="ghost" size="sm" onClick={copyToClipboard}>
              <Copy size={14} />
            </IconButton>

            {websiteUrl && (
              <IconButton label="Website" kind="ghost" size="sm" onClick={openWebsite}>
                <Wikis size={14} />
              </IconButton>
            )}

            {twitterHandle && (
              <IconButton label="X (Twitter)" kind="ghost" size="sm" onClick={searchOnTwitter}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                </svg>
              </IconButton>
            )}

            <IconButton label="Search on X" kind="ghost" size="sm" onClick={searchOnTwitter}>
              <Search size={14} />
            </IconButton>

            {discordInvite && (
              <IconButton label="Join Discord" kind="ghost" size="sm" onClick={openDiscord}>
                <LogoDiscord size={14} />
              </IconButton>
            )}

            <IconButton label="View on CoinGecko" kind="ghost" size="sm" onClick={openCoinGecko}>
              <img
                src="https://static.coingecko.com/s/thumbnail-007177f3eca19695592f0b8b0eabbdae282b54154e1be912285c9034ea6cbaf2.png"
                alt="CoinGecko"
                className={styles.coingeckoIcon}
              />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
};
