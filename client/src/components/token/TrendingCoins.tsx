import { useEffect, useState } from "react";
import { Star } from "@carbon/icons-react"; // Or similar for the favorite icon
import styles from "./TrendingCoins.module.scss";

interface CoinItem {
    id: string;
    coin_id: number;
    name: string;
    symbol: string;
    thumb: string;
    small: string;
    large: string;
    slug: string;
    price_btc: number;
    score: number;
    data: {
        price: string | number;
        price_btc: string | number;
        price_change_percentage_24h: {
            usd: number;
        };
        sparkline: string;
    };
}

interface TrendingResponse {
    coins: { item: CoinItem }[];
}

function formatPriceString(priceValue: string | number | undefined): string {
    if (priceValue == null) return "–";

    // The price from CG API might be a number or a string.
    let num: number;
    if (typeof priceValue === "number") {
        num = priceValue;
    } else {
        const stripped = priceValue.replace(/[^\d.-]/g, '');
        num = parseFloat(stripped);
    }

    // The price string from CG API might naturally contain $ prefix or formatting
    // If it starts with $, return as is or reformat slightly
    if (!isNaN(num)) {
        if (num < 0.0001) return `$${num.toExponential(4)}`;
        if (num < 0.01) return `$${num.toFixed(6)}`;
        if (num < 1) return `$${num.toFixed(4)}`;
        // For numbers >= 1, locale string works well
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    return priceValue.toString();
}

function formatPct(value: number | undefined) {
    if (value === undefined) return { text: "–", positive: null };
    const positive = value >= 0;
    // Add arrow symbol mimicking the image (e.g. ▲ 2.5%)
    const arrow = positive ? "▲" : "▼";
    return { text: `${arrow} ${Math.abs(value).toFixed(1)}%`, positive };
}

export function TrendingCoins() {
    const [coins, setCoins] = useState<CoinItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrending = async () => {
            setLoading(true);
            try {
                const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
                    headers: {
                        "x-cg-demo-api-key": "CG-MjPFyX8QAo68K93S65PHjrki",
                    },
                });
                const data: TrendingResponse = await res.json();
                if (data && data.coins) {
                    // Get top 8 to fit nicely in 4-column grid (2 rows) or max 10
                    setCoins(data.coins.map(c => c.item).slice(0, 10));
                }
            } catch (err) {
                console.error("Failed to fetch trending coins", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTrending();
    }, []);

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading trending coins...</div>
            </div>
        );
    }

    if (!coins.length) {
        return null;
    }

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                {coins.map(coin => {
                    const priceRaw = coin.data?.price;
                    const priceStr = priceRaw ? formatPriceString(priceRaw) : "–";
                    const chg = formatPct(coin.data?.price_change_percentage_24h?.usd);
                    // Decide sparkline color class if we wanted to filter it, but CG SVG has inline styles usually.
                    // Actually CG returns basic stroke SVG. If we want to style it, we can't easily modify the img, 
                    // but we can apply CSS filter or rely on the fact CG already returns green/red colored SVG sometimes, 
                    // or just render it directly.
                    return (
                        <div key={coin.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div className={styles.coinInfo}>
                                    <img src={coin.small} alt={coin.name} className={styles.icon} />
                                    <span className={styles.name}>{coin.name}</span>
                                </div>
                                <button className={styles.starBtn}>
                                    <Star size={16} />
                                </button>
                            </div>

                            <div className={styles.priceRow}>
                                <span className={styles.price}>{priceStr}</span>
                                <span className={`${styles.change} ${chg.positive === true ? styles.positive : chg.positive === false ? styles.negative : ""}`}>
                                    {chg.text}
                                </span>
                            </div>

                            {coin.data?.sparkline && (
                                <div className={styles.sparklineWrapper}>
                                    <img
                                        src={coin.data.sparkline}
                                        alt={`${coin.name} sparkline`}
                                        className={styles.sparklineImg}
                                        loading="lazy"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
