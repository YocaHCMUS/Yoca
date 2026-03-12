import { cgFetch, type CGPoolData } from "@/services/coingecko";
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

interface TokenMarketsTableProps {
    address: string;
    symbol: string;
}

export function TokenMarketsTable({ address }: TokenMarketsTableProps) {
    const { tr, fmt } = useLocalization();
    const [pools, setPools] = useState<CGPoolData[]>([]);
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
        const network = address.startsWith("0x") ? "eth" : "solana";
        cgFetch(`/onchain/networks/${network}/tokens/${address}/pools?include=base_token&sort=h24_volume_usd_desc`)
            .then((json) => {
                const data = json as { data?: CGPoolData[] } | null;
                if (data?.data) setPools(data.data.slice(0, 10));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [address]);

    if (loading) {
        return <DataTableSkeleton headers={HEADERS} rowCount={10} showHeader={false} showToolbar={false} />;
    }

    const rows = pools.map((pool, idx) => {
        const p = pool.attributes;
        const dexId = pool.relationships?.dex?.data?.id;
        const chgNum = Number(p.price_change_percentage?.h24);
        const buys = p.transactions?.h24?.buys ?? 0;
        const sells = p.transactions?.h24?.sells ?? 0;
        return {
            id: pool.id,
            rank: idx + 1,
            exchange: dexLabel(dexId),
            pair: p.name,
            price: fmt.num.currency(Number(p.base_token_price_usd)),
            change: { value: chgNum, text: `${chgNum >= 0 ? "+" : ""}${chgNum.toFixed(2)}%`, positive: chgNum >= 0 },
            volume: fmt.num.compact.currency(Number(p.volume_usd?.h24)),
            liquidity: fmt.num.compact.currency(Number(p.reserve_in_usd)),
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
