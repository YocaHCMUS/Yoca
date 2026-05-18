import type { WalletDayToken } from "@/services/wallet/walletApi";
import React, { useState } from "react";
import styles from "./TokenStack.module.scss";
import { ChevronDown, ChevronUp } from "@carbon/react/icons";

interface TokenStackProps {
  tokens: WalletDayToken[];
  totalTokens: number;
}

const fmtCompact = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  notation: "compact",
});

const fmtAmount = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 4,
  notation: "compact",
});

const fmtSignedAmount = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 4,
  notation: "compact",
  signDisplay: "always",
});

const fmtSignedUsd = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  notation: "compact",
  signDisplay: "always",
});

const getDeltaClassName = (delta: number) => {
  if (delta > 0) return styles.positive;
  if (delta < 0) return styles.negative;
  return styles.neutral;
};

export const TokenStack: React.FC<TokenStackProps> = ({ tokens, totalTokens }) => {
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
        <div className={styles.emptySpace}></div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        // <div className={styles.tooltip}>
        <div>
          <div className={styles.tooltipHeader}>
            <span>All Tokens ({totalTokens})</span>
          </div>
          <div className={styles.tooltipList}>
            {tokens.map((token) => {
              const amountDelta = token.buyAmount - token.sellAmount;

              return (
                <div key={token.address} className={styles.tokenRow}>
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
                        {fmtSignedAmount.format(amountDelta)}
                      </span>
                    </div>

                  </div>
                  <div className={styles.tokenVolumes}>
                    <div className={styles.volRow}>

                      <span className={styles.buyVol}>{fmtCompact.format(token.buyVolumeUsd)}</span>
                      <span className={styles.buyAmt}>{fmtAmount.format(token.buyAmount)}</span>
                      <span className={styles.buyAmt}>{fmtCompact.format(token.buyAmount > 0 ? token.buyVolumeUsd / token.buyAmount : 0)}/token</span>
                    </div>
                    <div className={styles.volRow}>

                      <span className={styles.sellVol}>{fmtCompact.format(token.sellVolumeUsd)}</span>
                      <span className={styles.sellAmt}>{fmtAmount.format(token.sellAmount)}</span>
                      <span className={styles.buyAmt}>{fmtCompact.format(token.sellAmount > 0 ? token.sellVolumeUsd / token.sellAmount : 0)}/token</span>
                    </div>
                  </div>
                </div>
              );
            })}
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
