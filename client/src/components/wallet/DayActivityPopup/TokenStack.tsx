import type { WalletDayToken } from "@/services/wallet/walletApi";
import React, { useState } from "react";
import styles from "./TokenStack.module.scss";

interface TokenStackProps {
  tokens: WalletDayToken[];
  totalTokens: number;
}

export const TokenStack: React.FC<TokenStackProps> = ({ tokens, totalTokens }) => {
  const [hovered, setHovered] = useState(false);

  if (tokens.length === 0) return null;

  const remaining = totalTokens - tokens.length;

  return (
    <div
      className={styles.stackContainer}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.stack}>
        {tokens.slice(0, 3).map((token, i) => (
          <div
            key={token.address}
            className={styles.tokenIcon}
            style={{ zIndex: 3 - i }}
          >
            {token.logoUri ? (
              <img src={token.logoUri} alt={token.symbol} />
            ) : (
              <span>{token.symbol?.[0]?.toUpperCase() ?? "?"}</span>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <div className={styles.ellipsisBadge}>
            +{remaining}
          </div>
        )}
      </div>

      {hovered && (
        <div className={styles.tooltip}>
          {tokens.map((token) => (
            <div key={token.address} className={styles.tooltipRow}>
              <span className={styles.tooltipSymbol}>{token.symbol}</span>
              <span className={styles.tooltipVolume}>
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: "USD",
                  notation: "compact",
                }).format(token.volumeUsd)}
              </span>
            </div>
          ))}
          {remaining > 0 && (
            <div className={styles.tooltipMore}>
              +{remaining} more token{remaining > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
