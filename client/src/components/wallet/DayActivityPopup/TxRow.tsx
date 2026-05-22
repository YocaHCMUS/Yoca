import { useLocalization } from "@/contexts/LocalizationContext";
import {
    fetchTxDetail,
    fetchTxInstructions,
    type WalletDaySwapSummary,
    type WalletTxDetail,
    type WalletTxInstructionDetail,
} from "@/services/wallet/walletApi";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell";
import { CpyBtn } from "@/components/CpyBtn";
import { ChevronDown, ChevronUp, Launch } from "@carbon/icons-react";
import { Loading } from "@carbon/react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import client from "@/api/main";
import styles from "./TxRow.module.scss";

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const BASE_FEE_LAMPORTS = 5_000;

interface TxRowProps {
  walletAddress: string;
  swap: WalletDaySwapSummary;
}

interface TokenMetaEntry {
  symbol: string;
  name: string | null;
  logoUri: string | null;
}

function resolveTokenMetaLookupAddress(tokenAddress: string): string {
  const normalized = tokenAddress.trim().toLowerCase();
  if (
    normalized === "native" ||
    normalized === "sol" ||
    normalized === "11111111111111111111111111111111"
  ) {
    return WSOL_MINT;
  }
  return tokenAddress;
}

export const TxRow: React.FC<TxRowProps> = ({ walletAddress, swap }) => {
  const { fmt, tr } = useLocalization();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [detail, setDetail] = useState<WalletTxDetail | null>(null);
  const [instructions, setInstructions] = useState<WalletTxInstructionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const [tokenMetaMap, setTokenMetaMap] = useState<Record<string, TokenMetaEntry>>({});

  const timeStr = new Date(swap.timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  useEffect(() => {
    if (!detail || detail.transfers.length === 0) return;

    const mintsToFetch = detail.transfers
      .map((t) => resolveTokenMetaLookupAddress(t.mint))
      .filter((mint, i, arr) => {
        if (!mint) return false;
        const existing = detail.transfers.find((t) => resolveTokenMetaLookupAddress(t.mint) === mint);
        if (existing?.symbol && existing?.logoUri) return false;
        return arr.indexOf(mint) === i;
      });

    if (mintsToFetch.length === 0) return;

    let cancelled = false;
    client.api.tokens.meta[":addresses"]
      .$get({ param: { addresses: mintsToFetch.join(",") } })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            const map: Record<string, TokenMetaEntry> = {};
            for (const item of data) {
              map[item.address] = {
                symbol: item.symbol ?? "",
                name: item.name ?? null,
                logoUri: item.imageUrl ?? null,
              };
            }
            setTokenMetaMap(map);
          }
        }
      })
      .catch(() => { /* ignore */ });

    return () => {
      cancelled = true;
    };
  }, [detail]);

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    if (!detail) {
      setLoading(true);
      try {
        const data = await fetchTxDetail(walletAddress, swap.transactionHash);
        setDetail(data);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(true);
  };

  const handleLoadInstructions = async () => {
    if (showInstructions) {
      setShowInstructions(false);
      return;
    }

    if (!instructions) {
      setLoadingInstructions(true);
      try {
        const data = await fetchTxInstructions(walletAddress, swap.transactionHash);
        setInstructions(data);
      } catch {
        setInstructions(null);
      } finally {
        setLoadingInstructions(false);
      }
    }
    setShowInstructions(true);
  };

  const priorityFee = Math.max(0, detail ? detail.feePaid - BASE_FEE_LAMPORTS : 0);

  return (
    <div className={styles.txRow}>
      <div className={styles.txHeader} onClick={handleExpand}>
        <span className={styles.txTime}>UTC-{timeStr}</span>
        <span className={styles.txPair}>{swap.pair}</span>
        <span className={styles.txSigGroup}>
          <a
            className={styles.txSignature}
            href={`https://solscan.io/tx/${swap.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {fmt.text.txHash(swap.transactionHash)}
            <Launch size={12} />
          </a>
          {/* <CpyBtn size="sm" copyWhat={swap.transactionHash} align="bottom" /> */}
        </span>
        <span className={styles.txValue}>{fmt.num.currency(swap.valueUsd)}</span>
        {loading ? (
          <Loading withOverlay={false} small className={styles.spinner} />
        ) : (
          expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
        )}
      </div>

      {expanded && detail && (
        <div className={styles.txDetail}>
          <div className={styles.detailSection}>
            <h4 className={styles.detailTitle}>{tr("profileTabs.activity.transfersTableTitle")}</h4>
            <div className={styles.transferList}>
              {detail.transfers.map((t, i) => {
                const isOut = t.from === walletAddress;
                const otherAddr = isOut ? t.to : t.from;
                const lookupMint = resolveTokenMetaLookupAddress(t.mint);
                const meta = tokenMetaMap[lookupMint];
                const symbol = meta?.symbol || t.symbol || t.mint.slice(0, 8);
                const name = meta?.name ?? t.name;
                const logoUri = meta?.logoUri ?? t.logoUri;

                return (
                  <div key={i} className={styles.transferItem}>
                    <span className={styles.transferDir}>{isOut ? "→" : "←"}</span>
                    <span className={`${styles.transferAmount} ${isOut ? styles.transferAmountOut : styles.transferAmountIn}`}>
                      {isOut ? "-" : "+"}{fmt.num.compact.decimal(t.amount)}
                    </span>
                    <TokenIdentityCell
                      symbol={symbol.toUpperCase()}
                      fullName={name}
                      imageUrl={logoUri}
                      imageSize={16}
                    />
                    <span className={styles.transferSpacer} />
                    <span className={styles.transferAddrLabel}>{isOut ? tr("walletPage.to") : tr("walletPage.from")}</span>
                    <span className={styles.addressWithCopy}>
                      <span
                        className={styles.transferAddress}
                        title={otherAddr}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/wallets/${encodeURIComponent(otherAddr)}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            e.preventDefault();
                            navigate(`/wallets/${encodeURIComponent(otherAddr)}`);
                          }
                        }}
                      >
                        {fmt.text.address(otherAddr)}
                      </span>
                      <CpyBtn size="sm" copyWhat={otherAddr} align="top" />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.detailSection}>
            <div className={styles.feeRow}>
              <h4 className={styles.detailTitle}>{tr("walletPage.feeInLamports")}</h4>
              <h4 className={styles.feeValue}>{detail.feePaid / 1e9} SOL</h4>
            </div>
            <div className={styles.feeRow}>
              <span className={styles.feeLabel}>{tr("walletPage.baseFee")}</span>
              <span className={styles.feeValue}>{(BASE_FEE_LAMPORTS / 1e9).toFixed(9)} SOL</span>
            </div>
            <div className={styles.feeRow}>
              <span className={styles.feeLabel}>{tr("walletPage.priorityFee")}</span>
              <span className={styles.feeValue}>{(priorityFee / 1e9).toFixed(9)} SOL</span>
            </div>
            <div className={styles.feeRow}>
              <span className={styles.feeLabel}>{tr("walletPage.feePayer")}</span>
              <span className={styles.addressWithCopy}>
                <span
                  className={`${styles.feeValue} ${styles.feeValueLink}`}
                  title={detail.feePayer}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/wallets/${encodeURIComponent(detail.feePayer)}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      navigate(`/wallets/${encodeURIComponent(detail.feePayer)}`);
                    }
                  }}
                >
                  {fmt.text.address(detail.feePayer)}
                </span>
                <CpyBtn size="sm" copyWhat={detail.feePayer} align="top" />
              </span>
            </div>
          </div>

          {/* <button className={styles.instructionsBtn} onClick={handleLoadInstructions}>
            {showInstructions ? tr("walletPage.hide") : tr("walletPage.view")} {tr("walletPage.instructions")}
            {loadingInstructions && <Loading withOverlay={false} small className={styles.btnSpinner} />}
          </button>

          {showInstructions && instructions && (
            <div className={styles.instructionsSection}>
              <h4 className={styles.detailTitle}>{tr("walletPage.instructions")} ({instructions.instructions.length})</h4>
              <div className={styles.instructionsList}>
                {instructions.instructions.map((ins) => (
                  <div key={ins.index} className={styles.instructionItem}>
                    <span className={styles.instructionIndex}>#{ins.index}</span>
                    <span className={styles.instructionProgram}>
                      {ins.programLabel || ins.programId.slice(0, 8)}...
                    </span>
                    <span className={styles.instructionAccounts}>
                      {ins.accounts.length} {tr("walletPage.account")}{ins.accounts.length !== 1 ? "s" : ""}
                    </span>
                    {ins.innerInstructions.length > 0 && (
                      <div className={styles.innerInstructions}>
                        {ins.innerInstructions.map((inner) => (
                          <div key={inner.index} className={styles.innerItem}>
                            <span className={styles.innerIndex}>#{ins.index}.{inner.index}</span>
                            <span className={styles.innerProgram}>
                              {inner.programLabel || inner.programId.slice(0, 8)}...
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )} */}
        </div>
      )
      }
    </div >
  );
};
