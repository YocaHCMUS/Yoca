import client from "@/api/main";
import Tble from "@/components/Tble";
import { TokenHeader } from "@/components/token";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import type { InferResponseType } from "hono/client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import styles from "./index.module.scss";

type HistoryPoint = InferResponseType<
  (typeof client.api.tokens.history)[":address"]["$get"],
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

export default function HistoricalDataPage() {
  const { address } = useParams<{ address: string }>();
  const { tr, fmt } = useLocalization();
  const [selectedRange, setSelectedRange] = useState<TimeRange>(TIME_RANGES[0]);
  const [rows, setRows] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const tokenDetails = useGet(
    client.api.tokens.details[":addresses"],
    200,
    {
      param: { addresses: address! },
    },
    { select: (data) => ({ ...data[0].meta, ...data[0].details }) },
  );
  const details = tokenDetails.data;

  useEffect(() => {
    if (!address) return;

    // Huỷ request cũ nếu đang chạy
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(false);

    client.api.tokens.history[":address"]
      .$get({
        param: { address },
        query: { days: selectedRange.days.toString() },
      })
      .then(async (res) => {
        if (ctrl.signal.aborted) return;
        if (res.status !== 200) {
          setError(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        // Hiển thị mới nhất lên đầu
        setRows([...data].reverse());
        setLoading(false);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => ctrl.abort();
  }, [address, selectedRange.days]);

  if (!address) return <>Missing address</>;

  const allRows = rows.map((r, i) => ({
    id: String(i),
    date: fmt.datetime.datetime(r.dateStr),
    marketCap: fmt.num.currency(r.marketCap),
    volume: fmt.num.currency(r.volume),
    close: fmt.num.currency(r.price),
  }));

  const TABLE_HEADERS = [
    { key: "date", header: tr("token.historicalData.date"), align: "start" as const },
    { key: "marketCap", header: tr("token.historicalData.marketCap"), align: "end" as const },
    { key: "volume", header: tr("token.historicalData.volume"), align: "end" as const },
    { key: "close", header: tr("token.historicalData.close"), align: "end" as const },
  ];

  return (
    <PageWrapper>
      <div className={styles.page}>
        {/* Token header */}
        {details && (
          <div className={styles.tokenHeaderWrap}>
            <TokenHeader
              name={details.name}
              symbol={details.symbol}
              address={details.address}
              imageUrl={details.imageUrl ?? undefined}
              coinGeckoId={details.coingeckoId ?? null}
              discordInvite={details.linkDiscord}
              websiteUrl={details.linkHomepage}
              twitterHandle={details.twitterScreenName}
              compact
            />
          </div>
        )}

        <div className={styles.content}>
          {/* Tiêu đề + range selector */}
          <div className={styles.header}>
            <h2 className={styles.title}>
              {tr("token.historicalData.title", { name: details?.name ?? "—" })}
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
          {error ? (
            <div className={styles.errorMsg}>
              {tr("token.historicalData.error")}
            </div>
          ) : (
            <Tble
              rows={allRows}
              headers={TABLE_HEADERS}
              loading={loading}
              boxed
              enablePagination
              pageSize={20}
              pageSizes={[20, 50, 100]}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
