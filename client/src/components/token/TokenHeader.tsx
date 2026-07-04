import { COINGECKO_THUMBNAIL_URL } from "@/config/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { getUserSubscription, type PlanTier } from "@/services/profile/subscriptionApi";
import { Copy, LogoDiscord, Search, Wikis } from "@carbon/icons-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router";
import styles from "./TokenHeader.module.scss";

interface TokenHeaderProps {
  name?: string | null;
  symbol?: string | null;
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
  /** Sidebar layout for /tokens/:address/:poolAddress to avoid overlapping compact left panel */
  sidebar?: boolean;
}

const hasWashTradingTier = (tier?: PlanTier) => tier === "Plus" || tier === "Pro";

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
  sidebar = false,
}: TokenHeaderProps) => {
  const copyToClipboard = () => navigator.clipboard.writeText(address);
  const { tr } = useLocalization();
  const { user, isUserLoading, openAuthModal } = useAuth();
  const { themeRef } = useUserTheme();
  const navigate = useNavigate();
  const [isCheckingWashAccess, setIsCheckingWashAccess] = useState(false);
  const [isWashGateOpen, setIsWashGateOpen] = useState(false);

  const openWebsite = () => websiteUrl && window.open(websiteUrl, "_blank");

  const searchOnTwitter = () => {
    const target = twitterHandle
      ? `https://twitter.com/${twitterHandle}`
      : `https://twitter.com/search?q=${encodeURIComponent(symbol || name || address)}`;
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

  const washTradingUrl = `/wash-trading/${address}?symbol=${encodeURIComponent(
    symbol || name || "TOKEN",
  )}&timeframe=24h`;

  const handleAiWashClick = async () => {
    if (isUserLoading || isCheckingWashAccess) return;
    if (!user) {
      setIsWashGateOpen(true);
      return;
    }

    setIsCheckingWashAccess(true);
    try {
      const subscription = await getUserSubscription();
      const isCurrent =
        subscription &&
        (subscription.status === "active" || subscription.status === "trialing") &&
        (!subscription.currentPeriodEnd || new Date(subscription.currentPeriodEnd).getTime() > Date.now());

      if (isCurrent && hasWashTradingTier(subscription.planTier)) {
        navigate(washTradingUrl);
        return;
      }

      setIsWashGateOpen(true);
    } catch (err) {
      console.error("Failed to check Wash Trading access", err);
      setIsWashGateOpen(true);
    } finally {
      setIsCheckingWashAccess(false);
    }
  };

  const aiWashButton = (
    <button
      type="button"
      className={`${styles.aiWashButton} ${compact ? styles.aiWashButtonCompact : ""} ${sidebar ? styles.aiWashButtonSidebar : ""}`}
      title={String(tr("token.header.aiWashTradingDetection"))}
      onClick={() => void handleAiWashClick()}
      disabled={isUserLoading || isCheckingWashAccess}
    >
      <span className={styles.aiWashIcon}>AI</span>
      <span className={styles.aiWashLabelFull}>{tr("token.header.aiWashTradingDetection")}</span>
      <span className={styles.aiWashLabelShort}>{tr("token.header.aiWashTradingDetectionShort")}</span>
    </button>
  );

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ""} ${sidebar ? styles.sidebar : ""}`}>
      <Link to={`/tokens/${address}`}>
      <img
        className={styles.image}
        src={imageUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
        alt={name || symbol || address}
        />
      </Link>

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

            {sidebar && aiWashButton}

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

        {sidebar && compact && aiWashButton}
      </div>

      {!sidebar && aiWashButton}

      {isWashGateOpen &&
        (() => {
          const gate = (
            <div
              className={styles.washGateOverlay}
              role="dialog"
              aria-modal="true"
              aria-label={String(tr("token.header.washGateTitle"))}
              onClick={() => setIsWashGateOpen(false)}
            >
              <div className={styles.washGateCard} onClick={(event) => event.stopPropagation()}>
                <div className={styles.washGateIcon}>AI</div>
                <h2 className={styles.washGateTitle}>{tr("token.header.washGateTitle")}</h2>
                <p className={styles.washGateText}>{tr("token.header.washGateDescription")}</p>
                <div className={styles.washGateActions}>
                  {!user && (
                    <button
                      type="button"
                      className={styles.washGateSecondary}
                      onClick={() => {
                        setIsWashGateOpen(false);
                        openAuthModal("login");
                      }}
                    >
                      {tr("token.header.washGateSignIn")}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.washGateSecondary}
                    onClick={() => setIsWashGateOpen(false)}
                  >
                    {tr("token.header.washGateClose")}
                  </button>
                  <Link className={styles.washGatePrimary} to="/pricing">
                    {tr("token.header.washGateUpgrade")}
                  </Link>
                </div>
              </div>
            </div>
          );
          return themeRef.current ? createPortal(gate, themeRef.current) : gate;
        })()}
    </div>
  );
};
