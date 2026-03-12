import client from "@/api/main";
import { TokenHeader } from "@/components/token";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
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
import type { InferResponseType } from "hono/client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import styles from "./index.module.scss";

type HistoryPoint = InferResponseType<
  typeof client.api.tokens.history[":address"]["$get"],
  200
>[number];

type TimeRange = { label: string; days: number };

const TIME_RANGES: TimeRange[] = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
];

function formatCurrency(value: number | null, compact = false): string {
  if (value == null) return "N/A";
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000)
      return "$" + (value / 1_000_000_000).toFixed(2) + "B";
    if (Math.abs(value) >= 1_000_000)
      return "$" + (value / 1_000_000).toFixed(2) + "M";
    if (Math.abs(value) >= 1_000)
      return "$" + (value / 1_000).toFixed(2) + "K";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 0.01 ? 8 : value < 1 ? 6 : 2,
  }).format(value);
}

function formatDate(dateStr: string, lang: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(lang, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default function HistoricalDataPage() {
  const { address } = useParams<{ address: string }>();
  const { tr, lang } = useLocalization();
  const [selectedRange, setSelectedRange] = useState<TimeRange>(TIME_RANGES[0]);
  const [rows, setRows] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const abortRef = useRef<AbortController | null>(null);

  const metaResult = useGet(client.api.tokens.meta[":addresses"], 200, {
    param: { addresses: address! },
  });
  const meta = metaResult.data?.[0] ?? null;

  useEffect(() => {
    if (!address) return;

    // Huỷ request cũ nếu đang chạy
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(false);
    setVisibleCount(20);

    client.api.tokens.history[":address"]
      .$get({ param: { address }, query: { days: selectedRange.days } })
      .then(async (res) => {
        if (ctrl.signal.aborted) return;
        if (res.status !== 200) { setError(true); setLoading(false); return; }
        const data = await res.json();
        // Hiển thị mới nhất lên đầu
        setRows([...data].reverse());
        setLoading(false);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) { setError(true); setLoading(false); }
      });

    return () => ctrl.abort();
  }, [address, selectedRange.days]);

  if (!address) return <>Missing address</>;

  const PAGE_SIZE = 20;
  const allRows = rows.map((r, i) => ({
    id: String(i),
    date: formatDate(r.dateStr, lang),
    marketCap: formatCurrency(r.marketCap, true),
    volume: formatCurrency(r.volume, true),
    close: formatCurrency(r.price),
  }));
  const tableRows = allRows.slice(0, visibleCount);
  const hasMore = visibleCount < allRows.length;

  const TABLE_HEADERS = [
    { key: "date", header: tr("token.historicalData.date") },
    { key: "marketCap", header: tr("token.historicalData.marketCap") },
    { key: "volume", header: tr("token.historicalData.volume") },
    { key: "close", header: tr("token.historicalData.close") },
  ];

  return (
    <PageWrapper>
      <div className={styles.page}>
        {/* Token header */}
        {meta && (
          <div className={styles.tokenHeaderWrap}>
            <TokenHeader
              name={meta.name}
              symbol={meta.symbol}
              address={meta.address}
              imageUrl={meta.imageUrl ?? undefined}
              coinGeckoId={meta.coingeckoId ?? null}
              discordInvite={meta.linkDiscord}
              websiteUrl={meta.linkHomepage}
              twitterHandle={meta.twitterScreenName}
              compact
            />
          </div>
        )}

        <div className={styles.content}>
          {/* Tiêu đề + range selector */}
          <div className={styles.header}>
            <h2 className={styles.title}>
              {tr("token.historicalData.title", { name: meta?.name ?? "—" })}
            </h2>
            <div className={styles.rangeSelector}>
              {TIME_RANGES.map((r) => (
                <button
                  key={r.label}
                  className={`${styles.rangeBtn} ${selectedRange.days === r.days ? styles.rangeBtnActive : ""}`}
                  onClick={() => setSelectedRange(r)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <DataTableSkeleton
              headers={TABLE_HEADERS}
              rowCount={selectedRange.days}
              showHeader={false}
              showToolbar={false}
            />
          ) : error ? (
            <div className={styles.errorMsg}>
              {tr("token.historicalData.error")}
            </div>
          ) : (
            <div className={styles.tableContainer}>
            <DataTable rows={tableRows} headers={TABLE_HEADERS}>
              {({ rows: tRows, headers, getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
                <TableContainer>
                <Table {...getTableProps()} className={styles.table}>
                  <TableHead>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHeader {...getHeaderProps({ header: h })} key={h.key}>
                          {h.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tRows.map((row) => (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map((cell) => (
                          <TableCell {...getCellProps({ cell })} key={cell.id}>
                            {cell.value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableContainer>
              )}
            </DataTable>
            {hasMore && (
              <div className={styles.showMoreWrap}>
                <button
                  className={styles.showMoreBtn}
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  {tr("token.historicalData.showMore")}
                </button>
              </div>
            )}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
