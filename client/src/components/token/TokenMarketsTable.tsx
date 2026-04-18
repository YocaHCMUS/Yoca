import client from "@/api/main";
import Tble from "@/components/Tble";
import { TknImg } from "@/components/TknImg";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { dexLabel } from "@/util/format";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { TrendNum } from "../TrendNum";
import styles from "./TokenMarketsTable.module.scss";

interface TokenMarketsTableProps {
  address: string;
  symbol: string;
}

function ExchangeCell({
  dexId,
  dexImageUrl,
}: {
  dexId: string | null | undefined;
  dexImageUrl: string | null | undefined;
}) {
  const [imageError, setImageError] = useState(false);
  const label = dexLabel(dexId);
  const proxiedImageUrl = dexImageUrl
    ? client.api.misc["image-proxy"].$url({
      query: { url: dexImageUrl },
    }).href
    : "";

  return (
    <span className={styles.exchangeCell}>
      {proxiedImageUrl && !imageError ? (
        <img
          src={proxiedImageUrl}
          alt=""
          className={styles.exchangeIcon}
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className={styles.exchangeFallback}>
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className={styles.exchangeName}>{label}</span>
    </span>
  );
}

export function TokenMarketsTable({ address }: TokenMarketsTableProps) {
  const { tr, fmt } = useLocalization();

  const pools = useGet(client.api.tokens[":address"].pools, 200, {
    param: { address },
  });

  const pairTokenAddresses = useMemo(() => {
    if (!pools.data) return "";

    const addresses = new Set<string>();
    for (const pool of pools.data) {
      if (pool.data.baseAddress) {
        addresses.add(pool.data.baseAddress);
      }
      if (pool.data.quoteAddress) {
        addresses.add(pool.data.quoteAddress);
      }
    }

    return Array.from(addresses).join(",");
  }, [pools.data]);

  const pairTokenMeta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: pairTokenAddresses || "" } },
    { enabled: !!pairTokenAddresses },
  );

  const addressToImageUrl = useMemo(() => {
    if (!pairTokenMeta.data) return {} as Record<string, string | null>;

    return Object.fromEntries(
      pairTokenMeta.data.map((token) => [token.address, token.imageUrl ?? null]),
    ) as Record<string, string | null>;
  }, [pairTokenMeta.data]);

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
        exchange: (
          <ExchangeCell dexId={data.dexId} dexImageUrl={data.dexImageUrl} />
        ),
        pair: (
          <Link
            to={`/tokens/${address}/${data.poolAddress}`}
            className={styles.pairLink}
          >
            <span className={styles.pairCell}>
              <span className={styles.pairIcons}>
                <span className={styles.pairIconLeft}>
                  <TknImg
                    size={18}
                    src={addressToImageUrl[data.baseAddress] ?? undefined}
                    alt={data.baseAddress}
                  />
                </span>
                <span className={styles.pairIconRight}>
                  <TknImg
                    size={18}
                    src={addressToImageUrl[data.quoteAddress] ?? undefined}
                    alt={data.quoteAddress}
                  />
                </span>
              </span>
              <span>{data.poolName || "Unknown"}</span>
            </span>
          </Link>
        ),
        price: <span>{fmt.num.currency(data.baseTokenPriceUsd ?? 0)}</span>,
        change: (
          <TrendNum
            value={data.priceChangePercentage24h ?? null}
            formatter={fmt.num.percent}
          />
        ),
        volume: <span>{fmt.num.compact.currency(data.volumeUsd24h ?? 0)}</span>,
        liquidity: <span>{fmt.num.compact.currency(data.liquidityUsd ?? 0)}</span>,
        txns: <span>{fmt.num.compact.decimal(totalTxns)}</span>,
      };
    });
  }, [pools.data, address, fmt, addressToImageUrl]);

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
          minWidth: 160,
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
