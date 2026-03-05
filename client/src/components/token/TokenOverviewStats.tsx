import { useLocalization } from "@/contexts/LocalizationContext";
import { Stack, Tooltip } from "@carbon/react";
import StrctLst from "../StrctLst";
import styles from "./TokenOverviewStats.module.scss";

type MarketData = {
  priceUsd: number;
  priceChangePercentage24h: number | null;

  high24h: number | null;
  low24h: number | null;

  marketCapRank: number | null;

  marketCap: number | null;
  fullyDilutedValuation: number | null;
  volume24h: number | null;

  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;

  ath: number | null;
  athChangePercentage: number | null;
  athDate: string | null;

  atl: number | null;
  atlChangePercentage: number | null;
  atlDate: string | null;
};

export type TokenMeta = {
  address: string;
  symbol: string;

  linkHomepage: string | null;
  linkBlockchainSites: string | null;
  platforms: string | null;
  categories: string | null;

  twitterScreenName: string | null;
  telegramChannel: string | null;
  linkDiscord: string | null;

  coingeckoId: string | null;
};

type TokenOverviewStatsProps = {
  meta: TokenMeta;
  data: MarketData;
};

export const TrendNum = ({
  value,
  formatter,
}: {
  value: number | null;
  formatter: (value: number | null) => string;
}) => {
  const { fmt } = useLocalization();

  function TrendPositive({ children }: { children: React.ReactNode }) {
    return <span className={styles.positive}>▲ {children}</span>;
  }

  function TrendNegative({ children }: { children: React.ReactNode }) {
    return <span className={styles.negative}>▼ {children}</span>;
  }

  function TrendNeutral({ children }: { children: React.ReactNode }) {
    return <span className={styles.neutral}>{children}</span>;
  }

  if (!value) {
    return <TrendNeutral>{formatter(value)}</TrendNeutral>;
  } else if (value > 0) {
    return <TrendPositive>{formatter(value)}</TrendPositive>;
  } else {
    return <TrendNegative>{formatter(Math.abs(value))}</TrendNegative>;
  }
};

export const TokenOverviewStats = ({ meta, data }: TokenOverviewStatsProps) => {
  const { tr, fmt } = useLocalization();

  return (
    <div>
      <Stack orientation="horizontal" gap={5}>
        <b>{fmt.num.currency(data.priceUsd)}</b>
        <TrendNum
          value={data.priceChangePercentage24h}
          formatter={fmt.num.percent}
        />
      </Stack>
      <Stack gap={8}>
        {/* Market Stats */}
        <StrctLst
          title={tr("token.overviewSectionTitle")}
          loading={false}
          rows={[
            {
              id: "marketCap",
              label: (
                <Tooltip label={tr("tooltips.marketCap")} align="bottom-left">
                  <p>Market Cap</p>
                </Tooltip>
              ),
              value: fmt.num.currency(data.marketCap),
            },
            {
              id: "fdv",
              label: (
                <Tooltip
                  label={tr("tooltips.fullyDilutedValuation")}
                  align="bottom-left"
                >
                  <p>Fully Diluted Valuation</p>
                </Tooltip>
              ),
              value: fmt.num.currency(data.fullyDilutedValuation),
            },
            {
              id: "volume24h",
              label: (
                <Tooltip
                  label={tr("tooltips.tradingVolume24h")}
                  align="bottom-left"
                >
                  <p>24 Hour Trading Vol</p>
                </Tooltip>
              ),
              value: fmt.num.currency(data.volume24h),
            },
            {
              id: "circulatingSupply",
              label: (
                <Tooltip
                  label={tr("tooltips.circulatingSupply")}
                  align="bottom-left"
                >
                  <p>Circulating Supply</p>
                </Tooltip>
              ),
              value: fmt.num.decimal(data.circulatingSupply),
            },
            {
              id: "totalSupply",
              label: (
                <Tooltip label={tr("tooltips.totalSupply")} align="bottom-left">
                  <p>Total Supply</p>
                </Tooltip>
              ),
              value: fmt.num.decimal(data.totalSupply),
            },
            {
              id: "maxSupply",
              label: (
                <Tooltip label={tr("tooltips.maxSupply")} align="bottom-left">
                  <p>Max Supply</p>
                </Tooltip>
              ),
              value: fmt.num.decimal(data.maxSupply),
            },
          ]}
        />

        {/* Historical Price */}
        <StrctLst
          title={tr("token.historicalPriceSectionTitle")}
          rows={[
            {
              id: "range24h",
              label: <span>24h Range</span>,
              value: (
                <span>
                  {fmt.num.currency(data.low24h)} -
                  {fmt.num.currency(data.high24h)}
                </span>
              ),
            },
            {
              id: "ath",
              label: <span>All-Time High</span>,
              value: (
                <Stack gap={1}>
                  <Stack
                    orientation="horizontal"
                    style={{ justifyContent: "end" }}
                    gap={4}
                  >
                    <TrendNum value={data.ath} formatter={fmt.num.currency} />
                    <TrendNum
                      value={data.athChangePercentage}
                      formatter={fmt.num.percent}
                    />
                  </Stack>
                  <small style={{ textAlign: "right" }}>
                    {fmt.datetime.date(data.athDate)} (
                    {fmt.datetime.relative(data.athDate)})
                  </small>
                </Stack>
              ),
            },
            {
              id: "atl",
              label: <span>All-Time Low</span>,
              value: (
                <Stack gap={1}>
                  <Stack
                    orientation="horizontal"
                    style={{ justifyContent: "end" }}
                    gap={4}
                  >
                    <TrendNum value={data.atl} formatter={fmt.num.currency} />
                    <TrendNum
                      value={data.atlChangePercentage}
                      formatter={fmt.num.percent}
                    />
                  </Stack>
                  <small style={{ textAlign: "right" }}>
                    {fmt.datetime.date(data.atlDate)} (
                    {fmt.datetime.relative(data.atlDate)})
                  </small>
                </Stack>
              ),
            },
          ]}
        />
      </Stack>
    </div>
  );
};
