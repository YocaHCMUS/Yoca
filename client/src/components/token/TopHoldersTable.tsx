import Tble from "@/components/Tble";
import { SOLSCAN_ACCOUNT_URL } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Link } from "@carbon/react";
import { useMemo } from "react";
import styles from "./TopHoldersTable.module.scss";

type TopHoldersData = Array<{
  holderAddress: string;
  percentage: number | string;
  balance?: number | null;
}>;

interface TopHoldersTableProps {
  holders: TopHoldersData;
  loading?: boolean;
}

export function TopHoldersTable({
  holders,
  loading = false,
}: TopHoldersTableProps) {
  const { tr, fmt } = useLocalization();

  const rows = useMemo(() => {
    if (!holders) return [];

    const top10 = holders.slice(0, 10);
    return top10.map((holder, idx) => ({
      id: holder.holderAddress,
      rank: <span>{idx + 1}</span>,
      address: (
        <Link
          href={`${SOLSCAN_ACCOUNT_URL}/${holder.holderAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.addressLink}
        >
          {fmt.text.address(holder.holderAddress)}
        </Link>
      ),
      amount: <span>{fmt.num.compact.decimal(holder.balance ?? 0)}</span>,
      percentage: <span>{Number(holder.percentage).toFixed(2)}%</span>,
    }));
  }, [holders, fmt]);

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
          key: "address",
          header: tr("token.topHolders.address"),
          align: "start",
        },
        {
          key: "amount",
          header: "Amount",
          align: "end",
        },
        {
          key: "percentage",
          header: tr("token.topHolders.percent"),
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
