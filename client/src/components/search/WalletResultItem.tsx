import { formatAddress } from "@/util/format";
import styles from "./WalletResultItem.module.scss";

export type WalletResult = {
  address: string;
  label: string | null;
};

interface WalletResultItemProps {
  wallet: WalletResult;
  isFocused: boolean;
  onSelect: (wallet: WalletResult) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function WalletResultItem({
  wallet,
  isFocused,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: WalletResultItemProps) {
  return (
    <div
      className={`${styles.resultItem} ${isFocused ? styles.focused : ""}`}
      onClick={() => onSelect(wallet)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.walletBadge}>W</div>

      <div className={styles.walletMeta}>
        <p className={styles.walletLabel}>{wallet.label || "Wallet"}</p>
        <p className={styles.walletAddress}>{formatAddress(wallet.address)}</p>
      </div>
    </div>
  );
}
