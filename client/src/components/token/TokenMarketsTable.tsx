import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { dexLabel } from "@/util/format";
import {
  DataTable,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import { type InferResponseType } from "hono/client";
import { Link } from "react-router";
import styles from "./TokenMarketsTable.module.scss";

const $getPools = client.api.tokens[":address"].pools.$get;
type PoolResponse = InferResponseType<typeof $getPools, 200>;

interface TokenMarketsTableProps {
  address: string;
  symbol: string;
}

export function TokenMarketsTable({ address }: TokenMarketsTableProps) {
  const { tr, fmt } = useLocalization();
  const [pools, setPools] = useState<PoolResponse>([]);
  const [loading, setLoading] = useState(true);
  const { tr, fmt } = useLocalization();

  const HEADERS = [
    { key: "rank", header: tr("token.marketsTable.rank") },
    { key: "exchange", header: tr("token.marketsTable.exchange") },
    { key: "pair", header: tr("token.marketsTable.pair") },
    { key: "price", header: tr("token.marketsTable.price") },
    { key: "change", header: tr("token.marketsTable.change24h") },
    { key: "volume", header: tr("token.marketsTable.volume24h") },
    { key: "liquidity", header: tr("token.marketsTable.liquidity") },
    { key: "txns", header: tr("token.marketsTable.txns24h") },
  ];

  const pools = useGet(client.api.tokens[":address"].pools, 200, {
    param: {
      address,
    },
  });

  if (pools.isLoading || pools.data == undefined) {
    return (
      <DataTableSkeleton
        headers={HEADERS}
        rowCount={10}
        showHeader={false}
        showToolbar={false}
      />
    );
  }

  const rows = pools.data.map((pool, idx) => {
    const data = pool.data;
    const rankInfo = pool.rankInfo;
    const chgNum = Number(data.priceChangePercentage24h ?? 0);
    const buys = data.buys24h ?? 0;
    const sells = data.sells24h ?? 0;
    return {
      id: data.poolAddress,
      rank: rankInfo.rank || idx + 1,
      exchange: dexLabel(data.dexId),
      pair: {
        value: data.poolName || "Unknown",
        poolAddress: data.poolAddress,
      },
      price: fmt.num.currency(Number(data.baseTokenPriceUsd ?? 0)),
      change: {
        value: chgNum,
        text: `${chgNum >= 0 ? "+" : ""}${chgNum.toFixed(2)}%`,
        positive: chgNum >= 0,
      },
      volume: fmt.num.compact.currency(Number(data.volumeUsd24h ?? 0)),
      liquidity: fmt.num.compact.currency(Number(data.liquidityUsd ?? 0)),
      txns: (buys + sells).toLocaleString(),
    };
  });

  return (
    <TableContainer className={styles.tableContainer}>
      <DataTable rows={rows} headers={HEADERS} size="lg">
        {({
          rows: tableRows,
          headers,
          getTableProps,
          getHeaderProps,
          getRowProps,
          getCellProps,
        }) => (
          <Table {...getTableProps()} className={styles.table}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader {...getHeaderProps({ header })} key={header.key}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows.map((row) => (
                <TableRow {...getRowProps({ row })} key={row.id}>
                  {row.cells.map((cell) => {
                    if (cell.info.header === "pair") {
                      const val = cell.value as {
                        value: string;
                        poolAddress: string;
                      };
                      return (
                        <TableCell {...getCellProps({ cell })} key={cell.id}>
                          <Link
                            to={`/tokens/${address}/${val.poolAddress}`}
                            className={styles.pairLink}
                          >
                            {val.value}
                          </Link>
                        </TableCell>
                      );
                    }
                    if (cell.info.header === "change") {
                      const val = cell.value as {
                        text: string;
                        positive: boolean;
                      };
                      return (
                        <TableCell {...getCellProps({ cell })} key={cell.id}>
                          <span
                            className={
                              val.positive ? styles.positive : styles.negative
                            }
                          >
                            {val.text}
                          </span>
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell {...getCellProps({ cell })} key={cell.id}>
                        {cell.value as string}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </TableContainer>
  );
}
