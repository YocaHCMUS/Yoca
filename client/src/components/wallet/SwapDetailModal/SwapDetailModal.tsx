import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { ArrowRight, Close } from "@carbon/react/icons";
import { Loading } from "@carbon/react";
import { ID_MODAL_ROOT } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import { CpyBtn } from "@/components/CpyBtn";
import { Launch } from "@carbon/icons-react";
import { useNavigate } from "react-router";
import {
  fetchTxDetail,
  type WalletSwap,
  type WalletTxDetail,
} from "@/services/wallet/walletApi";
import styles from "./SwapDetailModal.module.scss";

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const BASE_FEE_LAMPORTS = 5_000;

// ── Helpers ────────────────────────────────────────────────────────────────

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

function truncateSig(sig: string): string {
  if (!sig || sig.length <= 8) return sig;
  return `${sig.slice(0, 4)}...${sig.slice(-4)}`;
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFeeLabel(swap: WalletSwap): string {
  if (!swap.baseQuotePrice || !Number.isFinite(swap.baseQuotePrice)) {
    return "—";
  }

  return `${swap.baseQuotePrice * 10 ** (-9)} SOL`;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface SwapDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  swap: WalletSwap | null;
  walletAddress: string;
}

interface TokenMetaEntry {
  symbol: string;
  name: string | null;
  logoUri: string | null;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SwapDetailModal({
  isOpen,
  onClose,
  swap,
  walletAddress,
}: SwapDetailModalProps) {
  const { fmt, tr } = useLocalization();
  const navigate = useNavigate();

  const [txDetail, setTxDetail] = useState<WalletTxDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenMetaMap, setTokenMetaMap] = useState<Record<string, TokenMetaEntry>>({});

  useEffect(() => {
    if (!isOpen || !swap) {
      setTxDetail(null);
      setTokenMetaMap({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchTxDetail(walletAddress, swap.transactionHash)
      .then((data) => {
        if (!cancelled) {
          setTxDetail(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTxDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, swap, walletAddress]);

  useEffect(() => {
    if (!txDetail || txDetail.transfers.length === 0) return;

    const mintsToFetch = txDetail.transfers
      .map((t) => resolveTokenMetaLookupAddress(t.mint))
      .filter((mint, i, arr) => {
        if (!mint) return false;
        const existing = txDetail.transfers.find((t) => resolveTokenMetaLookupAddress(t.mint) === mint);
        if (existing?.symbol && existing?.logoUri) return false;
        return arr.indexOf(mint) === i;
      });

    if (mintsToFetch.length === 0) return;

    let cancelled = false;
    import("@/api/main").then(({ default: client }) => {
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
    });

    return () => {
      cancelled = true;
    };
  }, [txDetail]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !swap) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  const signature = swap.transactionHash;
  const timestamp = swap.blockTimestampIso;
  const priorityFee = txDetail ? Math.max(0, txDetail.feePaid - BASE_FEE_LAMPORTS) : 0;

  return ReactDOM.createPortal(
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Swap details"
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <span className={styles.title}>{tr("walletPage.swapDetails")}</span>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <Close size={20} />
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingContainer}>
            <Loading withOverlay={false} />
          </div>
        ) : (
          <div className={styles.twoColumnLayout}>
            {/* ── Left column: swap info ── */}
            <div>
              {/* ── Swap visual ── */}
              <div className={styles.swapRow}>
                <div className={styles.tokenCard}>
                  <span className={styles.dirLabel}>{tr("walletPage.sold")}</span>
                  {swap.sold ? (
                    <>
                      <span className={styles.tokenAmt} title={String(swap.sold.amount)}>
                        {fmt.num.compact.decimal(swap.sold.amount)}
                      </span>
                      <span className={styles.tokenIdentity} title={swap.sold.symbol ?? swap.sold.address}>
                        <TokenIdentityCell
                          symbol={swap.sold.symbol ?? swap.sold.address}
                          fullName={swap.sold.name ?? swap.sold.address}
                          imageUrl={swap.sold.logoUri ?? undefined}
                          imageSize={30}
                          tooltipAlign="right"
                        />
                      </span>
                    </>
                  ) : (
                    <span className={styles.tokenAmt}>—</span>
                  )}
                </div>

                <div className={styles.arrow}>
                  <ArrowRight size={28} />
                </div>

                <div className={styles.tokenCard}>
                  <span className={styles.dirLabel}>{tr("walletPage.bought")}</span>
                  {swap.bought ? (
                    <>
                      <span className={styles.tokenAmt} title={String(swap.bought.amount)}>
                        {fmt.num.compact.decimal(swap.bought.amount)}
                      </span>
                      <span className={styles.tokenIdentity} title={swap.bought.symbol ?? swap.bought.address}>
                        <TokenIdentityCell
                          symbol={swap.bought.symbol ?? swap.bought.address}
                          fullName={swap.bought.name ?? swap.bought.address}
                          imageUrl={swap.bought.logoUri ?? undefined}
                          imageSize={30}
                          tooltipAlign="right"
                        />
                      </span>
                    </>
                  ) : (
                    <span className={styles.tokenAmt}>—</span>
                  )}
                </div>
              </div>

              {/* ── Summary ── */}
              {swap.sold && swap.bought && (
                <p className={styles.summary}>
                  {tr("walletPage.swapped")}{" "}
                  <strong>
                    {fmt.num.compact.decimal(Math.abs(swap.sold.amount))} {swap.sold.symbol ?? tr("walletPage.unknown")}
                  </strong>{" "}
                  {tr("walletPage.forSwap")}{" "}
                  <strong>
                    {fmt.num.compact.decimal(Math.abs(swap.bought.amount))} {swap.bought.symbol ?? tr("walletPage.unknown")}
                  </strong>
                </p>
              )}

              {/* ── Detail rows ── */}
              <div className={styles.details}>
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>{tr("walletPage.signature")}</span>
                  <span className={styles.txSigGroup}>
                    <a
                      className={styles.detailLink}
                      href={`https://solscan.io/tx/${signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={signature}
                    >
                      {truncateSig(signature)}
                      <Launch size={12} />
                    </a>
                  </span>
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>{tr("walletPage.time")}</span>
                  <span className={styles.detailVal}>{formatTimestamp(timestamp)}</span>
                </div>

                {swap.transactionType && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>{tr("walletPage.type")}</span>
                    <span className={styles.detailVal}>{swap.transactionType}</span>
                  </div>
                )}

                {swap.tokensInvolved && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>{tr("walletPage.pair")}</span>
                    <span className={styles.detailVal} title={swap.tokensInvolved ?? undefined}>
                      {swap.tokensInvolved}
                    </span>
                  </div>
                )}

                {swap.totalValueUsd != null && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>{tr("walletPage.totalValue")}</span>
                    <span className={styles.detailVal}>{fmt.num.currency(swap.totalValueUsd)}</span>
                  </div>
                )}

                {Number.isFinite(swap.baseQuotePrice) && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>{tr("walletPage.transactionFee")}</span>
                    <span className={styles.detailVal}>{formatFeeLabel(swap)}</span>
                  </div>
                )}

                {txDetail && (
                  <div className={styles.feeSection}>
                    <div className={styles.feeRow}>
                      <span className={styles.feeLabel}>{tr("walletPage.feeInLamports")}</span>
                      <span className={styles.feeValue}>{txDetail.feePaid / 1e9} SOL</span>
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
                          title={txDetail.feePayer}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/wallets/${encodeURIComponent(txDetail.feePayer)}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              e.preventDefault();
                              navigate(`/wallets/${encodeURIComponent(txDetail.feePayer)}`);
                            }
                          }}
                        >
                          {truncateAddr(txDetail.feePayer)}
                        </span>
                        <CpyBtn size="sm" copyWhat={txDetail.feePayer} align="top" />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column: transfers + fees ── */}
            <div className={styles.rightColumn}>
              {txDetail && txDetail.transfers.length > 0 && (
                <div className={styles.transfersSection}>
                  <h4 className={styles.transferSectionTitle}>
                    {tr("walletPage.transfersInTransaction", { count: txDetail.transfers.length })}
                  </h4>
                  <div className={styles.transferList}>
                    {txDetail.transfers.map((t, i) => {
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
                            {fmt.num.compact.decimal(t.amount)}
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
                              {truncateAddr(otherAddr)}
                            </span>
                            <CpyBtn size="sm" copyWhat={otherAddr} align="top" />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    modalRoot,
  );
}
