import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { ArrowRight, Close, Launch } from "@carbon/react/icons";
import { Link, Loading } from "@carbon/react";
import { ID_MODAL_ROOT } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import { CpyBtn } from "@/components/CpyBtn";
import { TrendNum } from "@/components/TrendNum";
import { Flex } from "@/components/Flex";
import { Txt } from "@/components/Txt";
import { useNavigate } from "react-router";
import {
  fetchTxDetail,
  type WalletSwap,
  type WalletTxDetail,
} from "@/services/wallet/walletApi";
import styles from "./SwapDetailModal.module.scss";
import { Divider } from "@/components/partials/Divider/Divider";
import { ArrowLeft } from "lucide-react";

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const BASE_FEE_LAMPORTS = 5_000;

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveTokenMetaLookupAddress(tokenAddress: string): string {
  const normalized = tokenAddress.trim().toLowerCase();
  if (
    normalized == "native" ||
    normalized == "sol" ||
    normalized == "11111111111111111111111111111111"
  ) {
    return WSOL_MINT;
  }
  return tokenAddress;
}

function AddressLinkWithCopy({
  address,
  className,
}: {
  address: string;
  internal?: boolean; // use react-router link instead of external
  className?: string;
}) {
  const { fmt } = useLocalization();
  return (
    <Flex align="center" gap={2}>
      <Link href={`/wallets/${encodeURIComponent(address)}`} target="_blank">
        <Txt mono className={className}>
          {fmt.text.address(address)}
        </Txt>
      </Link>
      <CpyBtn size="xs" copyWhat={address} align="top" />
    </Flex>
  );
}

function TrendAmount({
  value,
  formatter,
}: {
  value: number | null;
  formatter: (value: number | null) => string;
}) {
  return <TrendNum value={value} prefixes="none" formatter={formatter} />;
}

// ── Token meta map type ──────────────────────────────────────────────────

interface TokenMetaEntry {
  symbol: string;
  name: string | null;
  logoUri: string | null;
}

// ── Main Modal ────────────────────────────────────────────────────────────

interface SwapDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  swap: WalletSwap | null;
  walletAddress: string;
}

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
  const [tokenMetaMap, setTokenMetaMap] = useState<
    Record<string, TokenMetaEntry>
  >({});

  // Fetch transaction details
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
        if (!cancelled) setTxDetail(data);
      })
      .catch(() => {
        if (!cancelled) setTxDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, swap, walletAddress]);

  // Fetch token metadata for transfers
  useEffect(() => {
    if (!txDetail || txDetail.transfers.length == 0) return;

    const mintsToFetch = txDetail.transfers
      .map((t) => resolveTokenMetaLookupAddress(t.mint))
      .filter((mint, i, arr) => {
        if (!mint) return false;
        const existing = txDetail.transfers.find(
          (t) => resolveTokenMetaLookupAddress(t.mint) == mint,
        );
        if (existing?.symbol && existing?.logoUri) return false;
        return arr.indexOf(mint) == i;
      });

    if (mintsToFetch.length == 0) return;

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
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [txDetail]);

  // Keyboard escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key == "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !swap) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  const signature = swap.transactionHash;
  const priorityFee = txDetail
    ? Math.max(0, txDetail.feePaid - BASE_FEE_LAMPORTS)
    : 0;
  const feeInSol = txDetail ? txDetail.feePaid / 1e9 : 0;
  const baseFeeSol = BASE_FEE_LAMPORTS / 1e9;
  const priorityFeeSol = priorityFee / 1e9;

  return ReactDOM.createPortal(
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Swap details"
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <Flex justify="between" align="center">
          <Txt size="lg">{tr("walletPage.swapDetails")}</Txt>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <Close size={20} />
          </button>
        </Flex>

        {loading ? (
          <div className={styles.loadingContainer}>
            <Loading withOverlay={false} />
          </div>
        ) : (
          <div className={styles.twoColumnLayout}>
            {/* Left column: swap info */}
            <div>
              {/* Swap visual */}
              <Flex dir="row" align="center" gap={6}>
                <Flex
                  dir="column"
                  align="center"
                  gap={3}
                  className={styles.tokenCard}
                >
                  <Txt size="sm" secondary uppercase>
                    {tr("walletPage.sold")}
                  </Txt>
                  {swap.sold ? (
                    <>
                      <Txt size="lg" mono>
                        {fmt.num.compact.decimal(swap.sold.amount)}
                      </Txt>
                      <TokenIdentityCell
                        symbol={swap.sold.symbol ?? swap.sold.address}
                        fullName={swap.sold.name ?? swap.sold.address}
                        imageUrl={swap.sold.logoUri ?? undefined}
                        imageSize={30}
                        tooltipAlign="right"
                      />
                    </>
                  ) : (
                    <Txt size="lg">—</Txt>
                  )}
                </Flex>

                <div className={styles.arrow}>
                  <ArrowRight size={28} />
                </div>

                <Flex
                  dir="column"
                  align="center"
                  gap={3}
                  className={styles.tokenCard}
                >
                  <Txt size="sm" secondary uppercase>
                    {tr("walletPage.bought")}
                  </Txt>
                  {swap.bought ? (
                    <>
                      <Txt size="lg" mono>
                        {fmt.num.compact.decimal(swap.bought.amount)}
                      </Txt>
                      <span className={styles.tokenIdentity}>
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
                    <Txt size="lg">—</Txt>
                  )}
                </Flex>
              </Flex>

              {/* Summary */}
              {swap.sold && swap.bought && (
                <div className={styles.summary}>
                  <Txt>
                    {tr("walletPage.swappedFor", {
                      $fromAmount: (
                        <strong>
                          {fmt.num.compact.unit(
                            swap.sold.amount,
                            swap.sold.symbol ?? tr("walletPage.unknown"),
                          )}
                        </strong>
                      ),
                      $toAmount: (
                        <strong>
                          {fmt.num.compact.unit(
                            swap.bought.amount,
                            swap.bought.symbol ?? tr("walletPage.unknown"),
                          )}
                        </strong>
                      ),
                    })}
                  </Txt>
                </div>
              )}

              {/* Detail rows */}
              <Flex dir="column" gap={6}>
                <Divider />

                <Flex justify="between" align="center">
                  <Txt>{tr("walletPage.signature")}</Txt>
                  <Flex align="center" gap={2}>
                    <Link
                      href={`https://solscan.io/tx/${signature}`}
                      target="_blank"
                    >
                      <Txt mono>{fmt.text.txHash(signature)}</Txt>
                    </Link>
                    <Launch size={16} />
                  </Flex>
                </Flex>

                <Flex justify="between" align="center" gap={5}>
                  <Txt>{tr("walletPage.time")}</Txt>
                  <Txt mono>
                    {fmt.datetime.datetime(swap.blockTimestampIso)}
                  </Txt>
                </Flex>

                {swap.transactionType && (
                  <Flex justify="between" align="center" gap={5}>
                    <Txt>{tr("walletPage.type")}</Txt>
                    <Txt mono>{swap.transactionType}</Txt>
                  </Flex>
                )}

                {swap.tokensInvolved && (
                  <Flex justify="between" align="center" gap={5}>
                    <Txt>{tr("walletPage.pair")}</Txt>
                    <Txt mono>{swap.tokensInvolved}</Txt>
                  </Flex>
                )}

                {swap.totalValueUsd != null && (
                  <Flex justify="between" align="center" gap={5}>
                    <Txt>{tr("walletPage.totalValue")}</Txt>
                    <Txt mono>{fmt.num.currency(swap.totalValueUsd)}</Txt>
                  </Flex>
                )}

                <Divider />

                {swap.baseQuotePrice != null &&
                  Number.isFinite(swap.baseQuotePrice) && (
                    <Flex justify="between" align="center" gap={5}>
                      <Txt>{tr("walletPage.transactionFee")}</Txt>
                      <Txt mono>
                        {fmt.num.unit(swap.baseQuotePrice * 1e-9, "SOL")}
                      </Txt>
                    </Flex>
                  )}

                {txDetail && (
                  <Flex dir="column" gap={5}>
                    <Flex justify="between" align="center">
                      <Txt>{tr("walletPage.feeInLamports")}</Txt>
                      <Txt mono>{fmt.num.unit(baseFeeSol, "SOL")}</Txt>
                    </Flex>
                    <Flex justify="between" align="center">
                      <Txt>{tr("walletPage.baseFee")}</Txt>
                      <Txt mono>{fmt.num.unit(baseFeeSol, "SOL")}</Txt>
                    </Flex>
                    <Flex justify="between" align="center">
                      <Txt>{tr("walletPage.priorityFee")}</Txt>
                      <Txt mono>{fmt.num.unit(priorityFeeSol, "SOL")}</Txt>
                    </Flex>
                    <Flex justify="between" align="center">
                      <Txt>{tr("walletPage.feePayer")}</Txt>
                      <AddressLinkWithCopy
                        address={txDetail.feePayer}
                        internal
                      />
                    </Flex>
                  </Flex>
                )}
              </Flex>
            </div>

            {/* Right column: transfers */}
            <div className={styles.rightColumn}>
              {txDetail && txDetail.transfers.length > 0 && (
                <div className={styles.transfersSection}>
                  <Txt secondary uppercase>
                    {tr("walletPage.transfersInTransaction", {
                      count: txDetail.transfers.length,
                    })}
                  </Txt>
                  <div className={styles.transferList}>
                    {txDetail.transfers.map((t, i) => {
                      const isOut = t.from == walletAddress;
                      const otherAddr = isOut ? t.to : t.from;
                      const isInternal = t.from == t.to;
                      const lookupMint = resolveTokenMetaLookupAddress(t.mint);
                      const meta = tokenMetaMap[lookupMint];
                      const symbol =
                        meta?.symbol || t.symbol || t.mint.slice(0, 8);
                      const name = meta?.name ?? t.name;
                      const logoUri = meta?.logoUri ?? t.logoUri;

                      return (
                        <div key={i} className={styles.transferGroup}>
                          <Flex justify="between" align="center">
                            <Flex align="center" gap={3}>
                              {isOut ? (
                                <ArrowRight size={16} />
                              ) : (
                                <ArrowLeft size={16} />
                              )}
                              <TrendAmount
                                value={isOut ? -t.amount : t.amount}
                                formatter={(value) =>
                                  fmt.num.compact.decimal(value, true)
                                }
                              />
                              <TokenIdentityCell
                                symbol={symbol.toUpperCase()}
                                fullName={name}
                                imageUrl={logoUri}
                                imageSize={16}
                              />
                            </Flex>
                            <Flex align="center" gap={3}>
                              <Txt secondary uppercase>
                                {isOut
                                  ? tr("walletPage.to")
                                  : tr("walletPage.from")}
                              </Txt>
                              {isInternal ? (
                                <Txt mono>{tr("walletPage.internal")}</Txt>
                              ) : (
                                <AddressLinkWithCopy
                                  address={otherAddr}
                                  internal
                                />
                              )}
                            </Flex>
                          </Flex>
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
