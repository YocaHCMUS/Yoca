import client from "@/api/main";
import { type InferResponseType } from "hono/client";
import { useLocalization } from "@/contexts/LocalizationContext";
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
import { useEffect, useState } from "react";
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

    useEffect(() => {
        if (!address) return;
        setLoading(true);
        $getPools({ param: { address } })
            .then(async (res: any) => {
                if (res.ok) {
                    const data = await res.json();
                    setPools(data.slice(0, 10)); // take top 10
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [address]);

    if (loading) {
        return <DataTableSkeleton headers={HEADERS} rowCount={10} showHeader={false} showToolbar={false} />;
    }

    const rows = pools.map((pool: any, idx: number) => {
        const p = pool.data;
        const dexId = p.dexId;
        const chgNum = Number(p.priceChangePercentage24h);
        const buys = p.buys24h ?? 0;
        const sells = p.sells24h ?? 0;
        return {
            id: p.poolAddress,
            rank: idx + 1,
            exchange: dexLabel(dexId || ""),
            pair: { value: p.poolName || "Unknown", poolAddress: p.poolAddress },
            price: fmt.num.currency(Number(p.baseTokenPriceUsd)),
            change: { value: chgNum, text: `${chgNum >= 0 ? "+" : ""}${chgNum.toFixed(2)}%`, positive: chgNum >= 0 },
            volume: fmt.num.compact.currency(Number(p.volumeUsd24h)),
            liquidity: fmt.num.compact.currency(Number(p.liquidityUsd)),
            txns: (buys + sells).toLocaleString(),
        };
    });

    return (
        <TableContainer className={styles.tableContainer}>
            <DataTable rows={rows} headers={HEADERS} size="lg">
                {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
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
                                            const val = cell.value as { value: string; poolAddress: string };
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
                                            const val = cell.value as { text: string; positive: boolean };
                                            return (
                                                <TableCell {...getCellProps({ cell })} key={cell.id}>
                                                    <span className={val.positive ? styles.positive : styles.negative}>
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
