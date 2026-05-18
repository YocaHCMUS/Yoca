import type { WalletDayToken } from "@/services/wallet/walletApi";
import React, { useState } from "react";
import styles from "./TokenStack.module.scss";

interface TokenStackProps {
  tokens: WalletDayToken[];
  totalTokens: number;
}

const fmtCompact = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  notation: "compact",
});

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
              <span>{token.symbol?.[0] ?? "?"}</span>
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
          <div className={styles.tooltipHeader}>
            <span>All Tokens ({totalTokens})</span>
          </div>
          <div className={styles.tooltipList}>
            {tokens.map((token) => (
              <div key={token.address} className={styles.tokenRow}>
                <div className={styles.tokenInfo}>
                  <div className={styles.tokenIconSmall}>
                    {token.logoUri ? (
                      <img src={token.logoUri} alt={token.symbol} />
                    ) : (
                      <span>{token.symbol?.[0] ?? "?"}</span>
                    )}
                  </div>
                  <span className={styles.tokenSymbol}>{token.symbol}</span>
                </div>
                <div className={styles.tokenVolumes}>
                  <span className={styles.buyVol}>{fmtCompact.format(token.buyVolumeUsd)}</span>
                  <span className={styles.sellVol}>{fmtCompact.format(token.sellVolumeUsd)}</span>
                </div>
              </div>
            ))}
            {remaining > 0 && (
              <div className={styles.tooltipMore}>
                +{remaining} more token{remaining > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
