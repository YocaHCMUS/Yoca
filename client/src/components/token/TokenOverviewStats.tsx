import { useLocalization } from "@/contexts/LocalizationContext";
import { ChevronDown, Information } from "@carbon/icons-react";
import { useEffect, useRef, useState } from "react";
import styles from "./TokenOverviewStats.module.scss";

type MarketData = {
  priceUsd: number;
  priceChangePercentage24h: number | null;

  high24h: number | null;
  low24h: number | null;

  marketCapRank: number | null;

  marketCap: number | null;
  fullyDilutedValuation: number | null;
  volume24h: number | null;

  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;

  ath: number | null;
  athChangePercentage: number | null;
  athDate: string | null;

  atl: number | null;
  atlChangePercentage: number | null;
  atlDate: string | null;
};

export type TokenMeta = {
  address: string;
  symbol: string;

  linkHomepage: string | null;
  linkBlockchainSites: string | null;
  platforms: string | null;
  categories: string | null;

  twitterScreenName: string | null;
  telegramChannel: string | null;
  linkDiscord: string | null;

  coingeckoId: string | null;
};

type TokenOverviewStatsProps = {
  meta: TokenMeta;
  data: MarketData;
  customPriceChange?: {
    percentage: number | null;
    label: string;
  } | null;
};

type DropdownItemType = {
  label: React.ReactNode;
  url: string;
};

const InfoDropdown = ({ items }: { items: DropdownItemType[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <a
        className={styles.infoBadge}
        href={items[0].url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {items[0].label}
      </a>
    );
  }

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <div className={styles.infoBadgeDropdownGroup}>
        <a
          href={items[0].url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.infoBadgeMainLink}
        >
          {items[0].label}
        </a>
        <button
          className={styles.infoBadgeDropdownBtnOnly}
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronDown size={14} className={styles.chevronIcon} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {isOpen && (
        <div className={styles.dropdownMenuAnimated}>
          {items.map((item, idx) => (
            <a
              key={idx}
              className={styles.dropdownItemAnimated}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export const TrendNum = ({
  value,
  formatter,
}: {
  value: number | null;
  formatter: (value: number | null) => string;
}) => {
  if (!value) {
    return <span className={styles.neutral}>{formatter(value)}</span>;
  } else if (value > 0) {
    return <span className={styles.positive}>▲ {formatter(value)}</span>;
  } else {
    return <span className={styles.negative}>▼ {formatter(Math.abs(value))}</span>;
  }
};

export const TokenOverviewStats = ({ meta, data, customPriceChange }: TokenOverviewStatsProps) => {
  const { tr, fmt } = useLocalization();

  // Compute 24h range position as a percentage for the indicator dot
  // Expand range to include current price if it falls outside low/high (cache staleness)
  const rangeLow =
    data.low24h != null ? Math.min(data.low24h, data.priceUsd) : null;
  const rangeHigh =
    data.high24h != null ? Math.max(data.high24h, data.priceUsd) : null;

  const rangePercent =
    rangeLow != null && rangeHigh != null && rangeHigh > rangeLow
      ? ((data.priceUsd - rangeLow) / (rangeHigh - rangeLow)) * 100
      : 50;

  // For 24h: use the API market data value immediately (no chart loading needed)
  // For other ranges (7d, 3m...): use the chart-computed value passed via customPriceChange
  const is24h = !customPriceChange || customPriceChange.label.toUpperCase() === "24H";

  const displayPercentage = is24h
    ? data.priceChangePercentage24h
    : customPriceChange?.percentage ?? null;

  const displayLabel = customPriceChange?.label ?? "24h";

  const isPositive = (displayPercentage ?? 0) > 0;
  const isNegative = (displayPercentage ?? 0) < 0;

  return (
    <div className={styles.container}>
      {/* ── Price Header ── */}
      <div className={styles.priceHeader}>
        <div className={styles.priceRow}>
          <span className={styles.priceMain}>
            {fmt.num.currency(data.priceUsd)}
          </span>
          <span
            className={`${styles.priceChange} ${isPositive ? styles.positive : isNegative ? styles.negative : ""
              }`}
          >
            {isPositive ? "▲" : isNegative ? "▼" : ""}
            {" "}
            {displayPercentage != null ? fmt.num.percent(Math.abs(displayPercentage)) : "—"}
            <span className={styles.priceChangePeriod}> ({displayLabel.toLowerCase()})</span>
          </span>
        </div>
      </div>

      {/* ── 24h Range Bar ── */}
      {rangeLow != null && rangeHigh != null && (
        <div className={styles.rangeSection}>
          <div className={styles.rangeMinMax}>
            <span className={styles.rangeValue}>{fmt.num.currency(rangeLow)}</span>
            <span className={styles.rangeLabel}>24h Range</span>
            <span className={styles.rangeValue}>{fmt.num.currency(rangeHigh)}</span>
          </div>
          <div className={styles.rangeBar}>
            <div
              className={styles.rangeIndicator}
              style={{ left: `${Math.max(2, Math.min(98, rangePercent))}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Market Stats ── */}
      <div className={styles.statsSection}>
        {[
          {
            id: "marketCap",
            label: tr("tooltips.marketCap"),
            display: "Market Cap",
            value: fmt.num.currency(data.marketCap),
          },
          {
            id: "fdv",
            label: tr("tooltips.fullyDilutedValuation"),
            display: "Fully Diluted Valuation",
            value: fmt.num.currency(data.fullyDilutedValuation),
          },
          {
            id: "volume24h",
            label: tr("tooltips.tradingVolume24h"),
            display: "24 Hour Trading Vol",
            value: fmt.num.currency(data.volume24h),
          },
          {
            id: "circulating",
            label: tr("tooltips.circulatingSupply"),
            display: "Circulating Supply",
            value: fmt.num.decimal(data.circulatingSupply),
          },
          {
            id: "total",
            label: tr("tooltips.totalSupply"),
            display: "Total Supply",
            value: fmt.num.decimal(data.totalSupply),
          },
          {
            id: "max",
            label: tr("tooltips.maxSupply"),
            display: "Max Supply",
            value:
              data.maxSupply != null
                ? fmt.num.decimal(data.maxSupply)
                : <span className={styles.infinity}>∞</span>,
          },
        ].map((row) => (
          <div key={row.id} className={styles.statRow}>
            <span className={styles.statLabel}>
              {row.display}
              {row.label && (
                <div className={styles.infoTooltip}>
                  <Information size={14} className={styles.infoIcon} />
                  <div className={styles.tooltipContent}>{row.label}</div>
                </div>
              )}
            </span>
            <span className={styles.statValue}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* ── Info Section ── */}
      {(() => {
        const explorers: string[] = (() => {
          try { return JSON.parse(meta.linkBlockchainSites ?? "[]") ?? []; } catch { return []; }
        })();
        const categories: string[] = (() => {
          try { return JSON.parse(meta.categories ?? "[]") ?? []; } catch { return []; }
        })();
        const platforms: Record<string, string> = (() => {
          try { return JSON.parse(meta.platforms ?? "{}") ?? {}; } catch { return {}; }
        })();
        const platformChains = Object.keys(platforms).filter(k => platforms[k]);

        const hasAny = meta.linkHomepage || explorers.length > 0
          || meta.linkDiscord || meta.telegramChannel || meta.twitterScreenName;

        if (!hasAny) return null;

        return (
          <div className={styles.infoSection}>
            <div className={styles.sectionTitle}>Info</div>

            {meta.linkHomepage && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Website</span>
                <div className={styles.infoBadgeGroup}>
                  <a
                    className={styles.infoBadge}
                    href={meta.linkHomepage}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {new URL(meta.linkHomepage).hostname.replace("www.", "")}
                  </a>
                </div>
              </div>
            )}

            {explorers.length > 0 && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Explorers</span>
                <div className={styles.infoBadgeGroup}>
                  <InfoDropdown
                    items={explorers
                      .map((url): DropdownItemType | null => {
                        try {
                          const host = new URL(url).hostname.replace("www.", "");
                          let name = host;
                          if (host.includes("solscan")) name = "Solscan";
                          else if (host.includes("explorer.solana")) name = "SolanaFM";

                          return { label: name, url };
                        } catch {
                          return null;
                        }
                      })
                      .filter((i): i is DropdownItemType => i !== null)}
                  />
                </div>
              </div>
            )}

            {(meta.twitterScreenName || meta.linkDiscord || meta.telegramChannel) && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Community</span>
                <div className={styles.infoBadgeGroup}>
                  <InfoDropdown
                    items={(
                      [
                        meta.twitterScreenName
                          ? {
                            label: (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
                                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                                </svg>
                                Twitter
                              </>
                            ),
                            url: `https://twitter.com/${meta.twitterScreenName}`,
                          }
                          : null,
                        meta.linkDiscord
                          ? {
                            label: (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
                                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                                </svg>
                                Discord
                              </>
                            ),
                            url: `https://discord.com/invite/${meta.linkDiscord}`
                          }
                          : null,
                        meta.telegramChannel
                          ? {
                            label: (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
                                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                </svg>
                                Telegram
                              </>
                            ),
                            url: `https://t.me/${meta.telegramChannel}`
                          }
                          : null,
                      ] as (DropdownItemType | null)[]
                    ).filter((i): i is DropdownItemType => i !== null)}
                  />
                </div>
              </div>
            )}





          </div>
        );
      })()}

      {/* ── Historical Price ── */}
      <div className={styles.historicalSection}>
        <div className={styles.sectionTitle}>
          {tr("token.historicalPriceSectionTitle")}
        </div>

        {/* ATH */}
        <div className={styles.historicalRow}>
          <span className={styles.historicalLabel}>All-Time High</span>
          <div className={styles.historicalValue}>
            <div className={styles.historicalMeta}>
              <span className={styles.historicalPrice}>
                {fmt.num.currency(data.ath)}
              </span>
              <TrendNum
                value={data.athChangePercentage}
                formatter={fmt.num.percent}
              />
            </div>
            {data.athDate && (
              <small className={styles.historicalDate}>
                {fmt.datetime.date(data.athDate)} ({fmt.datetime.relative(data.athDate)})
              </small>
            )}
          </div>
        </div>

        {/* ATL */}
        <div className={styles.historicalRow}>
          <span className={styles.historicalLabel}>All-Time Low</span>
          <div className={styles.historicalValue}>
            <div className={styles.historicalMeta}>
              <span className={styles.historicalPrice}>
                {fmt.num.currency(data.atl)}
              </span>
              <TrendNum
                value={data.atlChangePercentage}
                formatter={fmt.num.percent}
              />
            </div>
            {data.atlDate && (
              <small className={styles.historicalDate}>
                {fmt.datetime.date(data.atlDate)} ({fmt.datetime.relative(data.atlDate)})
              </small>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
