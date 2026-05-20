import { useLocalization } from "@/contexts/LocalizationContext";
import { formatChange } from "@/util/format";
import styles from "./TokenResultItem.module.scss";

export type TokenResult = {
  address: string;
  name: string | null;
  symbol: string | null;
  imgUrl: string | null;
  priceUsd: number;
  priceChangePercentage24h: number;
  sparkline7d: number[] | null;
  marketCap: number;
  volume24h: number;
};

function TokenPlaceholder({ symbol }: { symbol: string }) {
  return (
    <div className={styles.tokenImgPlaceholder}>
      {symbol?.slice(0, 2).toUpperCase() || "?"}
    </div>
  );
}

interface TokenResultItemProps {
  token: TokenResult;
  isFocused: boolean;
  onSelect: (token: TokenResult) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function TokenResultItem({
  token,
  isFocused,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: TokenResultItemProps) {
  const { fmt } = useLocalization();
  const change = formatChange(token.priceChangePercentage24h);

  return (
    <div
      className={`${styles.resultItem} ${isFocused ? styles.focused : ""}`}
      onClick={() => onSelect(token)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {token.imgUrl ? (
        <img
          src={token.imgUrl}
          alt={token.name ?? ""}
          className={styles.tokenImg}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <TokenPlaceholder symbol={token.symbol ?? ""} />
      )}

      <div className={styles.tokenMeta}>
        <p className={styles.tokenSymbol}>{token.symbol}</p>
        <p className={styles.tokenName}>{token.name}</p>
      </div>

      <div className={styles.stats}>
        <p className={styles.tokenPrice}>{fmt.num.currency(token.priceUsd)}</p>
        <p
          className={`${styles.tokenChange} ${
            change.positive === true
              ? styles.positive
              : change.positive === false
                ? styles.negative
                : ""
          }`}
        >
          {change.text}
        </p>
      </div>
    </div>
  );
}
