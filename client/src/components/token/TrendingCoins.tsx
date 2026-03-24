import { useEffect, useState } from "react";
import client from "@/api/main";
import { formatPriceString, formatPct } from "@/util/format";
import { Star } from "@carbon/icons-react";
import SparklineChart from "@/components/charts/SparklineChart";
import styles from "./TrendingCoins.module.scss";

interface TrendingCombinedData {
    id: string; // address
    name: string;
    small: string; // image
    priceRaw: number;
    priceChangePercentage24h: number;
    sparkline: number[] | null;
}

const $getTrending = client.api.tokens.trending.$get;
const $getMeta = client.api.tokens.meta[":addresses"].$get;
const $getMarket = client.api.tokens.markets[":addresses"].$get;

export function TrendingCoins() {
    const [coins, setCoins] = useState<TrendingCombinedData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrending = async () => {
            setLoading(true);
            try {
                const trendingRes = await $getTrending();
                if (!trendingRes.ok) return;
                const trendingData = await trendingRes.json();
                
                if (trendingData.length === 0) return;
                
                const top10 = trendingData.slice(0, 10).map((t: any) => t.address);
                const addressesParam = top10.join(",");
                
                const [metaRes, marketRes] = await Promise.all([
                    $getMeta({ param: { addresses: addressesParam } }),
                    $getMarket({ param: { addresses: addressesParam } }),
                ]);
                
                if (metaRes.ok && marketRes.ok) {
                    const metas = await metaRes.json();
                    const markets = await marketRes.json();
                    
                    const combined = top10.map((addr: string) => {
                        const mMeta = metas.find((m: any) => m.address === addr);
                        const mMarket = (markets as Record<string, any>)[addr];
                        
                        return {
                            id: addr,
                            name: mMeta?.name || "Unknown",
                            small: mMeta?.imageUrl || "",
                            priceRaw: mMarket?.priceUsd || 0,
                            priceChangePercentage24h: mMarket?.priceChangePercentage24h || 0,
                            sparkline: mMarket?.sparkline7d || null,
                        };
                    });
                    setCoins(combined);
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
                    const priceStr = formatPriceString(coin.priceRaw);
                    const chg = formatPct(coin.priceChangePercentage24h);
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

                            {coin.sparkline && (
                                <div className={styles.sparklineWrapper}>
                                    <SparklineChart 
                                        data={coin.sparkline} 
                                        positive={chg.positive ?? undefined} 
                                        width={80} 
                                        height={30} 
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
