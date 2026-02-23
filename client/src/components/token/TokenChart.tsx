import { GeckoTerminalChart } from "@/components/charts/GeckoTerminalChart";
import type { PoolData } from "@/hooks/useTokenPageData";
import styles from "./TokenChart.module.scss";

interface TokenChartProps {
    pool: PoolData | null;
}

export const TokenChart = ({ pool }: TokenChartProps) => {
    if (!pool) {
        return (
            <div className={styles.loading}>
                <p>Loading pool data...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <GeckoTerminalChart poolAddress={pool.address} height="600" />
        </div>
    );
};
