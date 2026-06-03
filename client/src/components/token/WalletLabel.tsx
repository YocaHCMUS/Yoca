import { useWalletIdentity } from "@/hooks/useWalletIdentity";
import { Checkmark, CheckmarkFilled, Copy } from "@carbon/icons-react";
import { Tag } from "@carbon/react";
import { useMemo, useState } from "react";
import styles from "./WalletLabel.module.scss";

interface WalletLabelProps {
  address: string;
}

function truncateAddress(address: string): string {
  if (!address || address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletLabel({ address }: WalletLabelProps) {
  const { label, isSolDomain, isLoading } = useWalletIdentity(address);
  const [copied, setCopied] = useState(false);
  const fallbackAddress = useMemo(() => truncateAddress(address), [address]);
  const isFallback = label === fallbackAddress;
  const showSecondaryAddress = !isFallback;

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (isLoading) {
    return <span className={styles.skeleton} aria-label="Resolving wallet" />;
  }

  return (
    <span className={styles.wrapper} title={address}>
      <span
        className={
          isSolDomain
            ? styles.solDomain
            : isFallback
              ? styles.fallback
              : styles.label
        }
      >
        <span>{label}</span>
        {showSecondaryAddress && (
          <span className={styles.secondaryAddress}>{fallbackAddress}</span>
        )}
      </span>

      {isSolDomain ? (
        <CheckmarkFilled className={styles.solBadge} size={14} />
      ) : !isFallback ? (
        <Tag className={styles.labelBadge} size="sm" type="gray">
          Label
        </Tag>
      ) : null}

      <button
        type="button"
        className={`${styles.copyBtn} ${copied ? styles.copied : ""}`}
        onClick={handleCopy}
        aria-label="Copy wallet address"
        title={copied ? "Copied" : "Copy address"}
      >
        {copied ? <Checkmark size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

export default WalletLabel;
