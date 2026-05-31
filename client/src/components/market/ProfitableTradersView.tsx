import React from "react";
import client from "@/api/main";
import { useGet } from "@/hooks/useGet";
import { TraderTable, TraderRow } from "./TraderTable";
import styles from "./ProfitableTradersView.module.scss";

type TraderType = "today" | "1W" | "30d" | "90d";

interface ProfitableTradersViewProps {
  traderType: TraderType;
}

export function ProfitableTradersView({ traderType }: ProfitableTradersViewProps) {
  const gainersReq = useGet(
    client.api.trades.traders.gainers,
    200,
    { query: { type: traderType } },
  );
  const losersReq = useGet(
    client.api.trades.traders.losers,
    200,
    { query: { type: traderType } },
  );

  const gainers = (gainersReq.data || []) as TraderRow[];
  const losers = (losersReq.data || []) as TraderRow[];
  const loading = gainersReq.isLoading || losersReq.isLoading;

  return (
    <div className={styles.splitLayout}>
      <div className={styles.panel}>
        <div className={styles.panelLabel} data-type="gainers">Top Gainers</div>
        <TraderTable data={gainers} type="gainers" loading={loading} />
      </div>
      <div className={styles.panel}>
        <div className={styles.panelLabel} data-type="losers">Top Losers</div>
        <TraderTable data={losers} type="losers" loading={loading} />
      </div>
    </div>
  );
}
