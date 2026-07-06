import type { WalletDayToken } from "@/services/wallet/walletApi";
import React, { useState, useMemo } from "react";
import styles from "./TokenStack.module.scss";
import { ChevronDown, ChevronUp } from "@carbon/react/icons";
import { useLocalization } from "@/contexts/LocalizationContext";

interface TokenStackProps {
  tokens: WalletDayToken[];
  totalTokens: number;
  onTokenClick?: (token: WalletDayToken) => void;
}

const INITIAL_SHOW = 20;

const getDeltaClassName = (delta: number) => {
  if (delta > 0) return styles.positive;
  if (delta < 0) return styles.negative;
  return styles.neutral;
};

export const TokenStack: React.FC<TokenStackProps> = ({ tokens, totalTokens, onTokenClick }) => {
  const { tr, fmt } = useLocalization();
  const [expanded, setExpanded] = useState(false);
  const [showCount, setShowCount] = useState(INITIAL_SHOW);
  const [search, setSearch] = useState("");

  const remaining = totalTokens - 3;

  const filtered = useMemo(() => {
    if (totalTokens === 0) return [];
    if (!search.trim()) return tokens;
    const q = search.trim().toLowerCase();
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q),
    );
  }, [tokens, search, totalTokens]);

  const visibleTokens = useMemo(
    () => filtered.slice(0, showCount),
    [filtered, showCount],
  );

  if (totalTokens === 0) return null;

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      setShowCount(INITIAL_SHOW);
      setSearch("");
    }
  };

  return (
    <div className={styles.stackContainer}>
      <div className={styles.stack} onClick={handleExpand}>
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
          <div className={styles.ellipsisBadge}>+{remaining}</div>
        )}
        <div className={styles.emptySpace} />
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className={styles.tokenListPanel}>
          <input
            className={styles.tokenSearch}
            placeholder={tr("walletPage.searchTokens")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowCount(INITIAL_SHOW);
            }}
          />
          <div className={styles.tokenList}>
            {visibleTokens.length === 0 ? (
              <div className={styles.tokenRow}>
                <span className={styles.tokenSymbol}>{tr("common.noData")}</span>
              </div>
            ) : (
              visibleTokens.map((token) => {
                const amountDelta = token.buyAmount - token.sellAmount;
                return (
                  <div
                    key={token.address}
                    className={styles.tokenRow}
                    onClick={() => onTokenClick?.(token)}
                    role={onTokenClick ? "button" : undefined}
                    tabIndex={onTokenClick ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (
                        onTokenClick &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
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
                          <span>{token.symbol?.[0] ?? "?"}</span>
                        )}
                      </div>
                      <span className={styles.tokenSymbol}>{token.symbol}</span>
                      <div className={styles.tokenMeta}>
                        <span
                          className={`${styles.tokenChange} ${getDeltaClassName(amountDelta)}`}
                        >
                          {amountDelta > 0 ? "+" : ""}
                          {fmt.num.compact.decimal(amountDelta)} {token.symbol}
                        </span>
                      </div>
                    </div>
                    <div className={styles.tokenVolumes}>
                      <div className={styles.volRow}>
                        <span className={styles.buyVol}>
                          {fmt.num.compact.currency(token.buyVolumeUsd)}
                        </span>
                        <span className={styles.buyAmt}>
                          {fmt.num.compact.decimal(token.buyAmount)}
                        </span>
                        <span className={styles.buyAmt}>
                          {fmt.num.compact.currency(
                            token.buyAmount > 0
                              ? token.buyVolumeUsd / token.buyAmount
                              : 0,
                          )}
                          /{token.symbol}
                        </span>
                      </div>
                      <div className={styles.volRow}>
                        <span className={styles.sellVol}>
                          {fmt.num.compact.currency(token.sellVolumeUsd)}
                        </span>
                        <span className={styles.sellAmt}>
                          {fmt.num.compact.decimal(token.sellAmount)}
                        </span>
                        <span className={styles.buyAmt}>
                          {fmt.num.compact.currency(
                            token.sellAmount > 0
                              ? token.sellVolumeUsd / token.sellAmount
                              : 0,
                          )}
                          /{token.symbol}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {showCount < filtered.length && (
            <button
              className={styles.showMoreBtn}
              onClick={() => setShowCount((prev) => prev + INITIAL_SHOW)}
            >
              {tr("walletPage.showMore", {
                count: filtered.length - showCount,
              })}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
