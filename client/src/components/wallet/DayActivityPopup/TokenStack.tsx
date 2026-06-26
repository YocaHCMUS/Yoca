import type { WalletDayToken } from "@/services/wallet/walletApi";
import React, { useState } from "react";
import styles from "./TokenStack.module.scss";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

interface TokenStackProps {
  tokens: WalletDayToken[];
  totalTokens: number;
  onTokenClick?: (token: WalletDayToken) => void;
}

const getDeltaClassName = (delta: number) => {
  if (delta > 0) return styles.positive;
  if (delta < 0) return styles.negative;
  return styles.neutral;
};

export const TokenStack: React.FC<TokenStackProps> = ({ tokens, totalTokens, onTokenClick }) => {
  const { tr, fmt } = useLocalization();
  const [expanded, setExpanded] = useState(false);

  if (totalTokens === 0) return null;

  const remaining = totalTokens - 3;

  return (
    <div
      className={styles.stackContainer}

    >
      <div className={styles.stack} onClick={() => setExpanded(!expanded)}>
        {tokens.slice(0, 3).map((token, i) => (
          <div
            key={token.address}
            className={styles.tokenIcon}
            style={{ zIndex: 3 - i, userSelect: "none" }}
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
        <div className={styles.emptySpace}></div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        // <div className={styles.tooltip}>
        <div>
          <div className={styles.tooltipHeader}>
            <span>{tr("walletPage.tokenList")} ({totalTokens})</span>
          </div>
          <div className={styles.tooltipList}>
            {tokens.map((token) => {
              const amountDelta = token.buyAmount - token.sellAmount;

              return (
                <div
                  key={token.address}
                  className={styles.tokenRow}
                  onClick={() => onTokenClick?.(token)}
                  role={onTokenClick ? "button" : undefined}
                  tabIndex={onTokenClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onTokenClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onTokenClick(token);
                    }
                  }}
                >
                  <div className={styles.tokenInfo}>
                    <div className={styles.tokenIconSmall}>
                      {token.logoUri ? (
                        <img src={token.logoUri} alt={token.symbol} />
                      ) : (
                        <span>
                          {token.symbol?.[0] ?? "?"}
                        </span>
                      )}
                    </div>
                    <span className={styles.tokenSymbol}>{token.symbol}</span>

                    <div className={styles.tokenMeta}>
                      <span
                        className={`${styles.tokenChange} ${getDeltaClassName(amountDelta)}`}
                      >
                        {amountDelta > 0 ? "+" : ""}{fmt.num.compact.decimal(amountDelta)} {token.symbol}
                      </span>
                    </div>

                  </div>
                  <div className={styles.tokenVolumes}>
                    <div className={styles.volRow}>
                      <span className={styles.buyVol}>{fmt.num.compact.currency(token.buyVolumeUsd)}</span>
                      <span className={styles.buyAmt}>{fmt.num.compact.decimal(token.buyAmount)}</span>
                      <span className={styles.buyAmt}>{fmt.num.compact.currency(token.buyAmount > 0 ? token.buyVolumeUsd / token.buyAmount : 0)}{"/"}{token.symbol}</span>
                    </div>
                    <div className={styles.volRow}>
                      <span className={styles.sellVol}>{fmt.num.compact.currency(token.sellVolumeUsd)}</span>
                      <span className={styles.sellAmt}>{fmt.num.compact.decimal(token.sellAmount)}</span>
                      <span className={styles.buyAmt}>{fmt.num.compact.currency(token.sellAmount > 0 ? token.sellVolumeUsd / token.sellAmount : 0)}{"/"}{token.symbol}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
