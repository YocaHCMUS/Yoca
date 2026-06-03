import Tble from "@/components/Tble";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useMemo } from "react";
import styles from "./TopHoldersTable.module.scss";
import { WalletLabel } from "./WalletLabel";

type TopHoldersData = Array<{
  holderAddress: string;
  percentage: number | string;
  amount?: number | string | null;
  balance?: number | string | null;
  tokenAmount?: number | string | null;
}>;

interface TopHoldersTableProps {
  holders: TopHoldersData;
  loading?: boolean;
  currentTokenPriceUsd?: number;
  tokenSymbol?: string;
  holderAmounts?: Record<string, number>;
  totalSupply?: number | null;
}

export function TopHoldersTable({
  holders,
  loading = false,
  currentTokenPriceUsd = 0,
  tokenSymbol = "",
  holderAmounts,
  totalSupply,
}: TopHoldersTableProps) {
  const { tr, fmt } = useLocalization();

  const rows = useMemo(() => {
    if (!holders) return [];

    return holders.map((holder, idx) => {
      const percentage = Number(holder.percentage);
      const rawApiAmount = holder.amount ?? holder.balance ?? holder.tokenAmount;
      const apiAmount = rawApiAmount == null ? null : Number(rawApiAmount);
      const mappedAmount = holderAmounts?.[holder.holderAddress];
      const derivedAmount =
        totalSupply != null && Number.isFinite(percentage)
          ? (Number(totalSupply) * percentage) / 100
          : 0;
      const amount = apiAmount != null && Number.isFinite(apiAmount)
        ? apiAmount
        : mappedAmount != null
          ? mappedAmount
          : derivedAmount;

      return {
        id: holder.holderAddress,
        rank: <span>{idx + 1}</span>,
        amount: (
          <div>
            <span className={styles.amountPrimary}>
              {fmt.num.compact.decimal(amount)} {tokenSymbol}
            </span>
            <span className={styles.amountUsd}>
              ~ {fmt.num.compact.currency(amount * currentTokenPriceUsd)}
            </span>
          </div>
        ),
        address: <WalletLabel address={holder.holderAddress} />,
        percentage: <span>{percentage.toFixed(2)}%</span>,
      };
    });
  }, [
    currentTokenPriceUsd,
    fmt,
    holderAmounts,
    holders,
    tokenSymbol,
    totalSupply,
  ]);

  return (
    <Tble
      headers={[
        {
          key: "rank",
          header: tr("token.topHolders.rank"),
          width: "10%",
          align: "start",
        },
        {
          key: "amount",
          header: tr("token.topHolders.amount"),
          width: "28%",
          align: "start",
        },
        {
          key: "address",
          header: tr("token.topHolders.address"),
          width: "42%",
          align: "start",
        },
        {
          key: "percentage",
          header: tr("token.topHolders.percent"),
          width: "20%",
          align: "end",
        },
      ]}
      rows={rows}
      loading={loading}
      boxed
      size="lg"
    />
  );
}
