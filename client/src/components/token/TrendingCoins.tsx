import { useEffect, useState } from "react";
import { cgFetch, type CoinItem, type TrendingResponse } from "@/services/coingecko";
import { formatPriceString, formatPct } from "@/util/format";
import { Star } from "@carbon/icons-react"; // Or similar for the favorite icon
import styles from "./TrendingCoins.module.scss";

export function TrendingCoins() {
    const [coins, setCoins] = useState<CoinItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrending = async () => {
            setLoading(true);
            try {
                const data = await cgFetch("/search/trending") as TrendingResponse | null;
                if (data?.coins) {
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
