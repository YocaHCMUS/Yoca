import { TknImg } from "@/components/TknImg";
import styles from "./SwapPairCell.module.scss";

export interface SwapPairCellProps {
  soldToken: {
    symbol: string | null;
    name: string | null;
    logoUri: string | null;
  } | null;
  boughtToken: {
    symbol: string | null;
    name: string | null;
    logoUri: string | null;
  } | null;
  pairLabel: string;
}

export function SwapPairCell({
  soldToken,
  boughtToken,
  pairLabel,
}: SwapPairCellProps): React.ReactElement {
  const soldSymbol = soldToken?.symbol?.toUpperCase() ?? "UNK";
  const boughtSymbol = boughtToken?.symbol?.toUpperCase() ?? "UNK";
  const uppercasedLabel = pairLabel.toUpperCase();

  return (
    <span className={styles.container}>
      <span className={styles.imageStack}>
        <span className={styles.backImage}>
          <TknImg
            src={soldToken?.logoUri ?? null}
            alt={soldToken?.name ?? soldSymbol}
            size={30}
          />
        </span>
        <span className={styles.frontImage}>
          <TknImg
            src={boughtToken?.logoUri ?? null}
            alt={boughtToken?.name ?? boughtSymbol}
            size={14}
          />
        </span>
      </span>
      <span className={styles.label}>
        <span className={styles.labelText}>
          {uppercasedLabel}
        </span>
      </span>
    </span>
  );
}

export default SwapPairCell;
