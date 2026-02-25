import client from "@/api/main";
import { GeckoTerminalChart } from "@/components/charts/GeckoTerminalChart";
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
  if (!pool) {
    return (
      <div className={styles.loading}>
        <p>Loading pool data...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <GeckoTerminalChart poolAddress={pool.poolAddress} height="600" />
    </div>
  );
};
