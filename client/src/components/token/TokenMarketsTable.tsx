import client from "@/api/main";
import Tble from "@/components/Tble";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { dexLabel } from "@/util/format";
import { useMemo } from "react";
import { Link } from "react-router";
import { TrendNum } from "../TrendNum";
import styles from "./TokenMarketsTable.module.scss";

interface TokenMarketsTableProps {
  address: string;
  symbol: string;
}

export function TokenMarketsTable({ address }: TokenMarketsTableProps) {
  const { tr, fmt } = useLocalization();

  const pools = useGet(client.api.tokens[":address"].pools, 200, {
    param: { address },
  });

  const rows = useMemo(() => {
    if (!pools.data) return [];

    return pools.data.map((pool, idx) => {
      const { data, rankInfo } = pool;
      const totalTxns =
        data.buys24h == null || data.sells24h == null
          ? null
          : data.buys24h + data.sells24h;

      return {
        id: data.poolAddress,
        rank: <span>{rankInfo.rank || idx + 1}</span>,
        exchange: <span>{dexLabel(data.dexId)}</span>,
        pair: (
          <Link
            to={`/tokens/${address}/${data.poolAddress}`}
            className={styles.pairLink}
          >
            {data.poolName || "Unknown"}
          </Link>
        ),
        price: <span>{fmt.num.currency(data.baseTokenPriceUsd)}</span>,
        change: (
          <TrendNum
            value={data.priceChangePercentage24h}
            formatter={fmt.num.percent}
          />
        ),
        volume: <span>{fmt.num.compact.currency(data.volumeUsd24h)}</span>,
        liquidity: <span>{fmt.num.compact.currency(data.liquidityUsd)}</span>,
        txns: <span>{fmt.num.compact.decimal(totalTxns)}</span>,
      };
    });
  }, [pools.data, address, fmt]);

  return (
    <Tble
      height={500}
      stickyHeader
      headers={[
        {
          key: "rank",
          header: tr("token.marketsTable.rank"),
          width: 60,
          align: "center",
        },
        {
          key: "exchange",
          header: tr("token.marketsTable.exchange"),
          align: "start",
        },
        {
          key: "pair",
          header: tr("token.marketsTable.pair"),
          align: "start",
        },
        {
          key: "price",
          header: tr("token.marketsTable.price"),
          align: "end",
        },
        {
          key: "change",
          header: tr("token.marketsTable.change24h"),
          align: "end",
        },
        {
          key: "volume",
          header: tr("token.marketsTable.volume24h"),
          align: "end",
        },
        {
          key: "liquidity",
          header: tr("token.marketsTable.liquidity"),
          align: "end",
        },
        {
          key: "txns",
          header: tr("token.marketsTable.txns24h"),
          align: "center",
        },
      ]}
      rows={rows}
      loading={pools.isLoading}
      boxed
      enablePagination
      pageSize={16}
      size="lg"
    />
  );
}
