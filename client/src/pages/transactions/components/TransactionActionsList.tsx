import React from "react";
import styles from "../index.module.scss";
import type { SummaryFlow } from "../shared/types";

type TransactionActionsListProps = {
  actionsList: SummaryFlow[];
  hoveredToken: string | null;
  hoveredAddress: string | null;
  setHoveredToken: React.Dispatch<React.SetStateAction<string | null>>;
  formatAmount: (amount: number) => string;
  shortAddress: (address: string, len?: number) => string;
};

export function TransactionActionsList({
  actionsList,
  hoveredToken,
  hoveredAddress,
  setHoveredToken,
  formatAmount,
  shortAddress,
}: TransactionActionsListProps) {
  return (
    <>
      <h3 className={styles.actionsTitle}>Transaction Actions</h3>

      <div className={styles.actionsList}>
        {actionsList.map((flow) => {
          return (
            <div
              key={flow.id}
              onMouseEnter={() => setHoveredToken(flow.tokenMint)}
              onMouseLeave={() => setHoveredToken(null)}
              className={styles.actionItem}
              style={{
                borderLeftColor:
                  hoveredToken === flow.tokenMint ||
                  hoveredAddress === flow.fromAddr ||
                  hoveredAddress === flow.toAddr
                    ? flow.color
                    : "transparent",
                background: hoveredToken === flow.tokenMint ? `${flow.color}10` : "#ffffff",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: flow.color,
                  flexShrink: 0,
                  marginTop: 6,
                }}
              />

              <div className={styles.actionContent}>
                <span style={{ color: "#9ca3af" }}>Transfer from </span>
                <a href={`/wallets/${flow.fromAddr}`} className={styles.actionAddress}>
                  {shortAddress(flow.fromAddr, 6)}
                </a>
                <span style={{ color: "#9ca3af" }}> to </span>
                <a href={`/wallets/${flow.toAddr}`} className={styles.actionAddress}>
                  {shortAddress(flow.toAddr, 6)}
                </a>
                <span style={{ color: "#9ca3af" }}> for </span>
                <b style={{ color: "#111827", fontWeight: 700 }}>{formatAmount(flow.amount)}</b>{" "}
                <span style={{ color: flow.color, fontWeight: 700 }}>{flow.symbol}</span>
                <span style={{ color: "#6b7280", marginLeft: 6, fontWeight: 600 }}>
                  (~${flow.valueUsd.toFixed(4)})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
