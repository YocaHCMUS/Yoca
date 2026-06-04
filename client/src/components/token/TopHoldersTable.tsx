import Tble from "@/components/Tble";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Link } from "@carbon/react";
import { useMemo } from "react";
import styles from "./TopHoldersTable.module.scss";

type TopHoldersData = Array<{
  holderAddress: string;
  percentage: number | string;
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

    return holders.map((holder, idx) => ({
      id: holder.holderAddress,
      rank: <span>{idx + 1}</span>,
      address: (
        <Link
          href={`/wallets/${holder.holderAddress}`}
          className={styles.addressLink}
        >
          {fmt.text.address(holder.holderAddress)}
        </Link>
      ),
      percentage: <span>{Number(holder.percentage).toFixed(2)}%</span>,
    }));
  }, [holders]);

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
