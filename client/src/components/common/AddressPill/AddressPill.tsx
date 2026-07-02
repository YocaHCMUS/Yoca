import type { ReactNode } from "react";
import { useCallback } from "react";
import { Copy } from "@carbon/icons-react";
import styles from "./AddressPill.module.scss";

interface AddressPillProps {
  address: string;
  label?: string;
  copyable?: boolean;
  truncate?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  size?: "sm" | "md";
  className?: string;
}

function shortenAddress(address: string): string {
  const normalized = address.trim();
  if (normalized.length <= 14) return normalized;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export function AddressPill({
  address,
  label,
  copyable = false,
  truncate = true,
  icon,
  onClick,
  size = "md",
  className = "",
}: AddressPillProps) {
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(address).catch(() => { });
    },
    [address],
  );

  const displayText = truncate ? shortenAddress(address) : address;

  return (
    <span
      className={`${styles.pill} ${size === "sm" ? styles.sm : ""} ${onClick ? styles.clickable : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={address}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {label && <span className={styles.label}>{label}</span>}
      {/* <span className={styles.address}>{displayText}</span> */}
      {copyable && (
        <button
          type="button"
          className={styles.copyBtn}
          onClick={handleCopy}
          aria-label="Copy address"
        >
          <Copy size={12} />
        </button>
      )}
    </span>
  );
}
