import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useState } from "react";
import useSWR from "swr";
import styles from "./GlobalPrices.module.scss";

const PAGE_SIZE = 10;

type RateEntry = {
  name: string;
  unit: string;
  value: number;
  type: string;
};

type RatesMap = Record<string, RateEntry>;

type ExchangeRatesApi = {
  $get: () => Promise<Response>;
};

const FIAT_ALLOWLIST = [
  "usd", "eur", "gbp", "jpy", "cad", "aud", "cny", "inr",
  "krw", "brl", "rub", "chf", "hkd", "sgd", "mxn", "zar",
  "sek", "nok", "dkk", "nzd", "thb", "php", "idr", "myr",
  "twd", "pln", "czk", "huf", "vnd", "ngn", "pkr", "bdt",
  "lkr",
];

function formatPrice(priceUsd: number, rateVsUsd: number, unit: string): string {
  const price = priceUsd * rateVsUsd;
  if (price >= 10_000) return `${unit}${Math.round(price).toLocaleString("en-US")}`;
  if (price >= 100) return `${unit}${price.toFixed(2)}`;
  if (price >= 1) return `${unit}${price.toFixed(4)}`;
  if (price >= 0.0001) return `${unit}${price.toFixed(6)}`;
  return `${unit}${price.toExponential(4)}`;
}

function useExchangeRates() {
  return useSWR<RatesMap | null>("misc/exchange-rates", async () => {
    const res = await (client.api.misc["exchange-rates"] as ExchangeRatesApi).$get();
    if (!res.ok) return null;
    const json = await res.json();
    return (json as { rates?: RatesMap })?.rates ?? null;
  });
}

interface GlobalPricesProps {
  priceUsd: number;
  symbol: string;
}

type RateRow = { id: string; pair: string; currency: string; price: string };

export function GlobalPrices({ priceUsd, symbol }: GlobalPricesProps) {
  const { data: ratesMap, isLoading } = useExchangeRates();
  const { tr } = useLocalization();
  const sym = symbol.toUpperCase();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const rates: RateRow[] = ratesMap
    ? (() => {
        const usdRate = ratesMap["usd"]?.value ?? 1;
        return Object.entries(ratesMap)
          .filter(([key]) => FIAT_ALLOWLIST.includes(key))
          .map(([key, entry]) => ({
            id: key,
            pair: `${sym} / ${key.toUpperCase()}`,
            currency: entry.name,
            price: formatPrice(priceUsd, entry.value / usdRate, entry.unit),
          }))
          .sort((a, b) => FIAT_ALLOWLIST.indexOf(a.id) - FIAT_ALLOWLIST.indexOf(b.id));
      })()
    : [];

  // Group into rows of 2, limited by visibleCount
  const visibleRates = rates.slice(0, visibleCount);
  const hasMore = visibleCount < rates.length;

  const visualRows: RateRow[][] = [];
  for (let i = 0; i < visibleRates.length; i += 2) {
    visualRows.push(visibleRates.slice(i, i + 2));
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeletonRow}>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className={styles.skeletonCell} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {visualRows.map((row, ri) => (
        <div key={ri} className={styles.row}>
          {row.map((entry) => (
            <div key={entry.id} className={styles.cell}>
              <span className={styles.pair}>{entry.pair}</span>
              <span className={styles.currency}>{entry.currency}</span>
              <span className={styles.price}>{entry.price}</span>
            </div>
          ))}
          {/* Fill empty cells for last row if < 2 entries */}
          {row.length < 2 &&
            Array.from({ length: 2 - row.length }).map((_, k) => (
              <div key={`empty-${k}`} className={styles.cell} />
            ))}
        </div>
      ))}
      {hasMore && (
        <div className={styles.showMoreWrap}>
          <button
            className={styles.showMoreBtn}
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            {tr("token.globalPrices.showMore")}
          </button>
        </div>
      )}
    </div>
  );
}



