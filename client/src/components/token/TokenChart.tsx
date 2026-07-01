import client from "@/api/main";
import { GeckoTerminalChart } from "@/components/charts/GeckoTerminalChart";
import { useLocalization } from "@/contexts/LocalizationContext";
import { dexLabel } from "@/util/format";
import type { InferResponseType } from "hono/client";
import styles from "./TokenChart.module.scss";

type PoolData = InferResponseType<
  (typeof client.api.tokens.pools)[":addresses"]["$get"],
  200
>[number];

interface TokenChartProps {
  pool: PoolData | null;
}

export const TokenChart = ({ pool }: TokenChartProps) => {
  const { tr } = useLocalization();

  if (!pool) {
    return (
      <div className={styles.loading}>
        <p>{tr("token.chart.loadingPool")}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.eyebrow}>Market Radar</span>
          <h2 className={styles.title}>
            {pool.poolName || "Selected Pool Chart"}
          </h2>
          <p className={styles.subtitle}>
            Live price action and pool structure for the currently selected
            market.
          </p>
        </div>
        {pool.dexId && (
          <span className={styles.metaBadge}>{dexLabel(pool.dexId)}</span>
        )}
      </div>

      <div className={styles.frame}>
        <GeckoTerminalChart poolAddress={pool.poolAddress} height="600" />
      </div>
    </div>
  );
};
