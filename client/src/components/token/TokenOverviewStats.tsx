import { client } from "@/api/main";
import classNames from "classnames";
import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { InfoTooltip } from "./InfoTooltip";
import styles from "./TokenOverviewStats.module.scss";

type MarketData =
    | InferResponseType<
        (typeof client.api.tokens.markets)[":addresses"]["$get"],
        200
    >[string]
    | null;

type TokenMeta = InferResponseType<
    (typeof client.api.tokens.meta)[":addresses"]["$get"],
    200
>[number];

type HoldersInfo =
    | InferResponseType<
        (typeof client.api.tokens.holders.stats)[":addresses"]["$get"],
        200
    >[number]
    | null;

interface TokenOverviewStatsProps {
    meta: TokenMeta;
    data: MarketData;
    holdersInfo?: HoldersInfo;
}

export const TokenOverviewStats = ({
    meta,
    data,
}: TokenOverviewStatsProps) => {
    const [tokenAmount, setTokenAmount] = useState<string>("1");
    const [selectedCurrency, setSelectedCurrency] = useState<string>("usd");
    const [exchangeRates, setExchangeRates] = useState<Record<string, { name: string; unit: string; value: number; type: string }> | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const safeParseJson = <T,>(str: string | null | undefined, fallback: T): T => {
        if (!str) return fallback;
        try { return JSON.parse(str); } catch { return fallback; }
    };

    const formatPlatformName = (name: string) =>
        name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    const getExplorerName = (url: string) => {
        try {
            const hostname = new URL(url).hostname.replace("www.", "");
            return hostname.split(".")[0].charAt(0).toUpperCase() + hostname.split(".")[0].slice(1);
        } catch { return url; }
    };

    useEffect(() => {
        fetch("/api/misc/exchange-rates")
            .then((r) => r.json())
            .then((data) => {
                if (data?.rates) setExchangeRates(data.rates);
            })
            .catch(() => {/* ignore – converter still works with USD */ });
    }, []);

    const formatCurrency = (value: number | null | undefined) => {
        if (value == null) return "-";
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
    };

    const formatNumber = (value: number | null | undefined) => {
        if (value == null) return "-";
        return `$${Math.round(value).toLocaleString()}`;
    };

    const formatNumberCompact = (value: number | null | undefined) => {
        if (value == null) return "-";
        return Math.round(value).toLocaleString();
    };

    const formatPercent = (value: number | null | undefined) => {
        if (value == null) return "-";
        return `${value >= 0 ? "▲" : "▼"} ${Math.abs(value).toFixed(1)}%`;
    };

    const formatPercentSimple = (value: number | null | undefined) => {
        if (value == null) return "-";
        return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    };

    const formatDate = (date: string | Date | null | undefined) => {
        if (date == null) return "";
        const d = new Date(date);
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatDateRelative = (date: string | Date | null | undefined) => {
        if (date == null) return "";
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 30) return `(${diffDays} days ago)`;
        if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `(about ${months} month${months > 1 ? "s" : ""})`;
        }
        const years = Math.floor(diffDays / 365);
        return `(about ${years} year${years > 1 ? "s" : ""})`;
    };

    const priceUsd = data?.priceUsd ? Number(data.priceUsd) : null;
    const priceChange24h = data?.priceChangePercentage24h
        ? Number(data.priceChangePercentage24h)
        : null;
    const priceBtc = data?.priceBtc ? Number(data.priceBtc) : null;
    const priceChangeBtc24h = data?.priceChangeBtc24h
        ? Number(data.priceChangeBtc24h)
        : null;
    const high24h = data?.high24h ? Number(data.high24h) : null;
    const low24h = data?.low24h ? Number(data.low24h) : null;
    const marketCapRank = data?.marketCapRank ?? null;

    // Calculate range position (0-100%)
    const rangePosition =
        priceUsd != null && high24h != null && low24h != null && high24h !== low24h
            ? ((priceUsd - low24h) / (high24h - low24h)) * 100
            : 50;

    // Supply ratio
    const circulatingSupply = data?.circulatingSupply
        ? Number(data.circulatingSupply)
        : null;
    const totalSupply = data?.totalSupply ? Number(data.totalSupply) : null;

    // Converter calculation using BTC as pivot
    const tokenAmountNum = parseFloat(tokenAmount) || 0;
    let convertedValue: number | null = null;
    let currencyUnit = selectedCurrency.toUpperCase();
    if (priceUsd != null && exchangeRates) {
        const usdRate = exchangeRates["usd"]?.value;   // BTC → USD rate
        const targetRate = exchangeRates[selectedCurrency]?.value;  // BTC → target rate
        if (usdRate && targetRate) {
            // priceUsd * (targetRate / usdRate) = price in target currency
            convertedValue = tokenAmountNum * priceUsd * (targetRate / usdRate);
        }
        currencyUnit = exchangeRates[selectedCurrency]?.unit ?? selectedCurrency.toUpperCase();
    } else if (priceUsd != null) {
        // fallback: USD only before rates load
        convertedValue = selectedCurrency === "usd" ? tokenAmountNum * priceUsd : null;
    }

    // Popular currencies to show in dropdown
    const popularCurrencies = ["usd", "eur", "jpy", "gbp", "aud", "cad", "sgd", "hkd", "krw", "vnd", "btc", "eth"];

    return (
        <div className={styles.container}>
            {/* Price Header */}
            <div className={styles.priceHeader}>
                <div className={styles.priceRow}>
                    <span className={styles.priceMain}>{formatCurrency(priceUsd)}</span>
                    {priceChange24h != null && (
                        <span
                            className={classNames(styles.priceChange, {
                                [styles.positive]: priceChange24h >= 0,
                                [styles.negative]: priceChange24h < 0,
                            })}
                        >
                            {formatPercent(priceChange24h)} (24h)
                        </span>
                    )}
                    {marketCapRank != null && (
                        <span className={styles.rankBadge}>#{marketCapRank}</span>
                    )}
                </div>
                {priceBtc != null && (
                    <div className={styles.priceBtc}>
                        <span>{priceBtc.toFixed(8)} BTC</span>
                        {priceChangeBtc24h != null && (
                            <span
                                className={classNames(styles.priceBtcChange, {
                                    [styles.positive]: priceChangeBtc24h >= 0,
                                    [styles.negative]: priceChangeBtc24h < 0,
                                })}
                            >
                                {formatPercent(priceChangeBtc24h)}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* 24h Range */}
            {high24h != null && low24h != null && (
                <div className={styles.rangeSection}>
                    <div className={styles.rangeHeader}>
                        <span className={styles.rangeValue}>{formatCurrency(low24h)}</span>
                        <span className={styles.rangeLabel}>24h Range</span>
                        <span className={styles.rangeValue}>{formatCurrency(high24h)}</span>
                    </div>
                    <div className={styles.rangeBar}>
                        <div
                            className={styles.rangeIndicator}
                            style={{ left: `${Math.min(Math.max(rangePosition, 0), 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Market Stats */}
            <div className={styles.statsSection}>
                <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                        Market Cap
                        <InfoTooltip text="Current Price x Circulating Supply. Refers to the total market value of a cryptocurrency's circulating supply. It is similar to the stock market's measurement of multiplying price per share by shares readily available in the market (not held & locked by insiders, governments)." />
                    </span>
                    <span className={styles.statValue}>
                        {formatNumber(data?.marketCap ? Number(data.marketCap) : null)}
                    </span>
                </div>

                <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                        Fully Diluted Valuation
                        <InfoTooltip text="The market cap if the max supply was in circulation. Fully Diluted Valuation (FDV) = Current Price x Max Supply. If max supply is null, FDV = Current Price x Total Supply." />
                    </span>
                    <span className={styles.statValue}>
                        {formatNumber(
                            data?.fullyDilutedValuation
                                ? Number(data.fullyDilutedValuation)
                                : null,
                        )}
                    </span>
                </div>

                <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                        24 Hour Trading Vol
                        <InfoTooltip text="A measure of a cryptocurrency trading volume across all tracked platforms in the last 24 hours. This is tracked on a rolling 24-hour basis with no open/closing times." />
                    </span>
                    <span className={styles.statValue}>
                        {formatNumber(data?.volume24h ? Number(data.volume24h) : null)}
                    </span>
                </div>

                <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                        Circulating Supply
                        <InfoTooltip text="The amount of coins that are circulating in the market and are tradeable by the public. It is comparable to looking at shares readily available in the market (not held & locked by insiders, governments)." />
                    </span>
                    <span className={styles.statValue}>
                        {formatNumberCompact(circulatingSupply)}
                    </span>
                </div>

                <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                        Total Supply
                        <InfoTooltip text="The amount of coins that have already been created, minus any coins that have been burned (removed from circulation). It is comparable to outstanding shares in the stock market. Total Supply = Onchain supply - burned tokens." />
                    </span>
                    <span className={styles.statValue}>
                        {formatNumberCompact(totalSupply)}
                    </span>
                </div>

                <div className={styles.statRow}>
                    <span className={styles.statLabel}>
                        Max Supply
                        <InfoTooltip text="The maximum number of coins coded to exist in the lifetime of the cryptocurrency. It is comparable to the maximum number of issuable shares in the stock market. Max Supply = Theoretical maximum as coded." />
                    </span>
                    <span className={styles.statValue}>
                        {data?.maxSupply ? (
                            formatNumberCompact(Number(data.maxSupply))
                        ) : (
                            <span className={styles.infinity}>∞</span>
                        )}
                    </span>
                </div>

            </div>

            {/* Historical Price */}
            <div className={styles.historicalSection}>
                <div className={styles.sectionTitle}>
                    {meta.symbol} Historical Price
                </div>

                {high24h != null && low24h != null && (
                    <div className={styles.historicalRow}>
                        <span className={styles.historicalLabel}>24h Range</span>
                        <div className={styles.historicalValue}>
                            <span className={styles.historicalPrice}>
                                {formatCurrency(low24h)} – {formatCurrency(high24h)}
                            </span>
                        </div>
                    </div>
                )}

                {data?.ath != null && (
                    <div className={styles.historicalRow}>
                        <span className={styles.historicalLabel}>All-Time High</span>
                        <div className={styles.historicalValue}>
                            <div className={styles.historicalMeta}>
                                <span className={styles.historicalPrice}>
                                    {formatCurrency(Number(data.ath))}
                                </span>
                                {data.athChangePercentage != null && (
                                    <span
                                        className={classNames(styles.historicalChange, {
                                            [styles.positive]:
                                                Number(data.athChangePercentage) >= 0,
                                            [styles.negative]:
                                                Number(data.athChangePercentage) < 0,
                                        })}
                                    >
                                        {formatPercentSimple(Number(data.athChangePercentage))}
                                    </span>
                                )}
                            </div>
                            {data.athDate && (
                                <span className={styles.historicalDate}>
                                    {formatDate(data.athDate)}{" "}
                                    {formatDateRelative(data.athDate)}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {data?.atl != null && (
                    <div className={styles.historicalRow}>
                        <span className={styles.historicalLabel}>All-Time Low</span>
                        <div className={styles.historicalValue}>
                            <div className={styles.historicalMeta}>
                                <span className={styles.historicalPrice}>
                                    {formatCurrency(Number(data.atl))}
                                </span>
                                {data.atlChangePercentage != null && (
                                    <span
                                        className={classNames(styles.historicalChange, {
                                            [styles.positive]:
                                                Number(data.atlChangePercentage) >= 0,
                                            [styles.negative]:
                                                Number(data.atlChangePercentage) < 0,
                                        })}
                                    >
                                        {formatPercentSimple(Number(data.atlChangePercentage))}
                                    </span>
                                )}
                            </div>
                            {data.atlDate && (
                                <span className={styles.historicalDate}>
                                    {formatDate(data.atlDate)}{" "}
                                    {formatDateRelative(data.atlDate)}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Converter */}
            {priceUsd != null && (
                <div className={styles.converterSection}>
                    <div className={styles.sectionTitle}>{meta.symbol} Converter</div>
                    {/* Token amount row */}
                    <div className={styles.converterRow}>
                        <input
                            className={styles.converterInput}
                            type="number"
                            min="0"
                            value={tokenAmount}
                            onChange={(e) => setTokenAmount(e.target.value)}
                        />
                        <span className={styles.converterSymbol}>{meta.symbol}</span>
                    </div>
                    {/* Converted value row */}
                    <div className={styles.converterRow}>
                        <span className={styles.converterUsdValue}>
                            {convertedValue != null
                                ? convertedValue.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 8,
                                })
                                : "–"}
                        </span>
                        <select
                            className={styles.converterSelect}
                            value={selectedCurrency}
                            onChange={(e) => setSelectedCurrency(e.target.value)}
                        >
                            {(exchangeRates
                                ? Object.keys(exchangeRates).filter((k) =>
                                    popularCurrencies.includes(k)
                                )
                                : popularCurrencies
                            ).map((key) => {
                                const rate = exchangeRates?.[key];
                                return (
                                    <option key={key} value={key}>
                                        {rate ? `${rate.unit} ${key.toUpperCase()}` : key.toUpperCase()}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>
            )}

            {/* Info Section */}
            <div className={styles.infoSection}>
                <div className={styles.sectionTitle}>Info</div>

                {/* Contract */}
                <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Contract</span>
                    <div className={styles.infoBadges}>
                        <span
                            className={styles.badgeClickable}
                            onClick={() => navigator.clipboard.writeText(meta.address)}
                            title="Copy address"
                        >
                            {meta.address.slice(0, 4)}...{meta.address.slice(-4)}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                        </span>
                    </div>
                </div>

                {/* Website */}
                {meta.linkHomepage && (() => {
                    try {
                        return (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Website</span>
                                <div className={styles.infoBadges}>
                                    <a className={styles.badgeLink} href={meta.linkHomepage} target="_blank" rel="noopener noreferrer">
                                        {new URL(meta.linkHomepage!).hostname}
                                    </a>
                                </div>
                            </div>
                        );
                    } catch { return null; }
                })()}

                {/* Explorers */}
                {(() => {
                    const explorers = safeParseJson<string[]>(meta.linkBlockchainSites, []);
                    if (explorers.length === 0) return null;
                    const visibleCount = 3;
                    const isExpanded = expandedSections["explorers"];
                    const visible = isExpanded ? explorers : explorers.slice(0, visibleCount);
                    const hiddenCount = explorers.length - visibleCount;
                    return (
                        <div className={styles.infoRowExpandable}>
                            <div className={styles.infoRowMain}>
                                <span className={styles.infoLabel}>Explorers</span>
                                <div className={styles.infoBadges}>
                                    {explorers.slice(0, visibleCount).map((url, i) => (
                                        <a key={i} className={styles.badgeLink} href={url} target="_blank" rel="noopener noreferrer">
                                            {getExplorerName(url)}
                                        </a>
                                    ))}
                                    {hiddenCount > 0 && (
                                        <span className={styles.badgeToggle} onClick={() => toggleSection("explorers")}>
                                            {hiddenCount} more <span className={isExpanded ? styles.chevronUp : styles.chevronDown}>&#8250;</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                            {isExpanded && hiddenCount > 0 && (
                                <div className={styles.dropdown}>
                                    {explorers.slice(visibleCount).map((url, i) => (
                                        <a key={i} className={styles.dropdownItem} href={url} target="_blank" rel="noopener noreferrer">
                                            {getExplorerName(url)}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Community */}
                {(meta.twitterScreenName || meta.telegramChannel || meta.linkDiscord) && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Community</span>
                        <div className={styles.infoBadges}>
                            {meta.twitterScreenName && (
                                <a className={styles.badgeLink} href={`https://twitter.com/${meta.twitterScreenName}`} target="_blank" rel="noopener noreferrer">
                                    𝕏 Twitter
                                </a>
                            )}
                            {meta.telegramChannel && (
                                <a className={styles.badgeLink} href={`https://t.me/${meta.telegramChannel}`} target="_blank" rel="noopener noreferrer">
                                    Telegram
                                </a>
                            )}
                            {meta.linkDiscord && (
                                <a className={styles.badgeLink} href={meta.linkDiscord.startsWith("http") ? meta.linkDiscord : `https://discord.com/invite/${meta.linkDiscord}`} target="_blank" rel="noopener noreferrer">
                                    Discord
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* API ID */}
                {meta.coingeckoId && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>API ID</span>
                        <div className={styles.infoBadges}>
                            <span
                                className={styles.badgeClickable}
                                onClick={() => navigator.clipboard.writeText(meta.coingeckoId!)}
                                title="Copy API ID"
                            >
                                {meta.coingeckoId}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                            </span>
                        </div>
                    </div>
                )}

                {/* Chains / Platforms */}
                {(() => {
                    const platforms = safeParseJson<Record<string, string>>(meta.platforms, {});
                    const platformNames = Object.keys(platforms).filter((k) => k.length > 0);
                    if (platformNames.length === 0) return null;
                    const visibleCount = 1;
                    const isExpanded = expandedSections["chains"];
                    const hiddenCount = platformNames.length - visibleCount;
                    return (
                        <div className={styles.infoRowExpandable}>
                            <div className={styles.infoRowMain}>
                                <span className={styles.infoLabel}>Chains</span>
                                <div className={styles.infoBadges}>
                                    {platformNames.slice(0, visibleCount).map((name) => (
                                        <span key={name} className={styles.badge}>{formatPlatformName(name)}</span>
                                    ))}
                                    {hiddenCount > 0 && (
                                        <span className={styles.badgeToggle} onClick={() => toggleSection("chains")}>
                                            {hiddenCount} more <span className={isExpanded ? styles.chevronUp : styles.chevronDown}>&#8250;</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                            {isExpanded && hiddenCount > 0 && (
                                <div className={styles.dropdown}>
                                    {platformNames.slice(visibleCount).map((name) => (
                                        <span key={name} className={styles.dropdownItem}>
                                            {formatPlatformName(name)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Categories */}
                {(() => {
                    const cats = safeParseJson<string[]>(meta.categories, []);
                    if (cats.length === 0) return null;
                    const visibleCount = 1;
                    const isExpanded = expandedSections["categories"];
                    const hiddenCount = cats.length - visibleCount;
                    return (
                        <div className={styles.infoRowExpandable}>
                            <div className={styles.infoRowMain}>
                                <span className={styles.infoLabel}>Categories</span>
                                <div className={styles.infoBadges}>
                                    {cats.slice(0, visibleCount).map((cat, i) => (
                                        <span key={i} className={styles.badge}>{cat}</span>
                                    ))}
                                    {hiddenCount > 0 && (
                                        <span className={styles.badgeToggle} onClick={() => toggleSection("categories")}>
                                            {hiddenCount} more <span className={isExpanded ? styles.chevronUp : styles.chevronDown}>&#8250;</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                            {isExpanded && hiddenCount > 0 && (
                                <div className={styles.dropdown}>
                                    {cats.slice(visibleCount).map((cat, i) => (
                                        <span key={i} className={styles.dropdownItem}>{cat}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};
