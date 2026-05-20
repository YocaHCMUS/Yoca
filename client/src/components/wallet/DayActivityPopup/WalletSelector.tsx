import React from "react";
import styles from "./WalletSelector.module.scss";

interface WalletSelectorProps {
  wallets: string[];
  selected: string;
  onSelect: (address: string) => void;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({
  wallets,
  selected,
  onSelect,
}) => {
  return (
    <div className={styles.selector}>
      {wallets.map((wallet) => (
        <button
          key={wallet}
          className={`${styles.tab} ${wallet === selected ? styles.active : ""}`}
          onClick={() => onSelect(wallet)}
        >
          {wallet.slice(0, 8)}...{wallet.slice(-4)}
        </button>
      ))}
    </div>
  );
};
