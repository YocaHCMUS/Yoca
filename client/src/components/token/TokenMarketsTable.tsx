import {
    DataTable,
    DataTableSkeleton,
    Table,
    TableHead,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    TableContainer,
} from "@carbon/react";
import { useEffect, useState } from "react";
import styles from "./TokenMarketsTable.module.scss";

interface TokenMarketsTableProps {
    address: string;
    symbol: string;
}

interface CGPoolData {
    id: string;
    attributes: {
        address: string;
        name: string;
        base_token_price_usd: string;
        price_change_percentage: { h24: string };
        volume_usd: { h24: string };
        reserve_in_usd: string;
        transactions: { h24: { buys: number; sells: number } };
    };
    relationships: {
        dex: { data: { id: string } };
    };
}

const DEX_LABELS: Record<string, string> = {
    raydium: "Raydium",
    raydium_clmm: "Raydium-Clmm",
    raydium_cpmm: "Raydium-Cpmm",
    orca: "Orca",
    orca_whirlpools: "Orca Whirlpools",
    meteora: "Meteora",
    meteora_dlmm: "Meteora DLMM",
    lifinity_v2: "Lifinity V2",
    pancakeswap_v3: "Pancakeswap-V3-Solana",
};

function fmt$(v: number | null | undefined): string {
    if (v == null || isNaN(v)) return "–";
    const a = Math.abs(v);
    if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
}

function fmtPrice(v: number | null | undefined): string {
    if (v == null || isNaN(v)) return "–";
    if (v < 0.0001) return `$${v.toExponential(4)}`;
    if (v < 0.01) return `$${v.toFixed(8)}`;
    if (v < 1) return `$${v.toFixed(6)}`;
    return `$${v.toFixed(2)}`;
}

function dexLabel(dexId: string | null): string {
    if (!dexId) return "–";
    return DEX_LABELS[dexId] ?? dexId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const HEADERS = [
    { key: "rank", header: "#" },
    { key: "exchange", header: "Exchange" },
    { key: "pair", header: "Pair" },
    { key: "price", header: "Price" },
    { key: "change", header: "24H Chg" },
    { key: "volume", header: "24H Volume" },
    { key: "liquidity", header: "Liquidity" },
    { key: "txns", header: "Txns 24H" },
];

export function TokenMarketsTable({ address }: TokenMarketsTableProps) {
    const [pools, setPools] = useState<CGPoolData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!address) return;
        setLoading(true);
        const network = address.startsWith("0x") ? "eth" : "solana";
        fetch(
            `https://api.coingecko.com/api/v3/onchain/networks/${network}/tokens/${address}/pools?include=base_token&sort=h24_volume_usd_desc`,
            { headers: { "x-cg-demo-api-key": "CG-MjPFyX8QAo68K93S65PHjrki" } }
        )
            .then((r) => r.json())
            .then((data) => { if (data?.data) setPools(data.data.slice(0, 10)); })
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
            price: fmtPrice(Number(p.base_token_price_usd)),
            change: { value: chgNum, text: `${chgNum >= 0 ? "+" : ""}${chgNum.toFixed(2)}%`, positive: chgNum >= 0 },
            volume: fmt$(Number(p.volume_usd?.h24)),
            liquidity: fmt$(Number(p.reserve_in_usd)),
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
