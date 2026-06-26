import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { ArrowLeft, ArrowRight, ExternalLink as Launch, LoaderCircle, X as Close } from "lucide-react";
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
  type WalletTransfer,
  type WalletTxDetail,
} from "@/services/wallet/walletApi";
import styles from "./TransferDetailModal.module.scss";
import { Divider } from "@/components/partials/Divider/Divider";

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

function AddressLinkWithCopy({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const { fmt } = useLocalization();
  return (
    <Flex align="center" gap={2}>
      <a href={`/wallets/${encodeURIComponent(address)}`} target="_blank">
        <Txt mono className={className}>
          {fmt.text.address(address)}
        </Txt>
      </a>
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

// ── Props & Types ──────────────────────────────────────────────────────────

interface TransferDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: WalletTransfer | null;
  walletAddress: string;
}

interface TokenMetaEntry {
  symbol: string;
  name: string | null;
  logoUri: string | null;
}

export function TransferDetailModal({
  isOpen,
  onClose,
  transfer,
  walletAddress,
}: TransferDetailModalProps) {
  const { fmt, tr } = useLocalization();
  const navigate = useNavigate();

  const [txDetail, setTxDetail] = useState<WalletTxDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenMetaMap, setTokenMetaMap] = useState<
    Record<string, TokenMetaEntry>
  >({});

  const isOut = transfer ? transfer.from === walletAddress : false;

  // Fetch transaction details
  useEffect(() => {
    if (!isOpen || !transfer) {
      setTxDetail(null);
      setTokenMetaMap({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchTxDetail(walletAddress, transfer.transactionSignature)
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
  }, [isOpen, transfer, walletAddress]);

  // Fetch token metadata
  useEffect(() => {
    if (!txDetail || txDetail.transfers.length === 0) return;

    const mintsToFetch = txDetail.transfers
      .map((t) => resolveTokenMetaLookupAddress(t.mint))
      .filter((mint, i, arr) => {
        if (!mint) return false;
        const existing = txDetail.transfers.find(
          (t) => resolveTokenMetaLookupAddress(t.mint) === mint,
        );
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
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [txDetail]);

  // Escape key hook
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !transfer) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  const signature = transfer.transactionSignature;
  const timestamp = transfer.timestamp;
  const tokenSymbol = (transfer.tokenSymbol || "UNKNOWN").toUpperCase();
  const tokenName = transfer.tokenName ?? null;
  const tokenLogoUri = transfer.tokenLogoUri ?? null;
  const priorityFee = txDetail
    ? Math.max(0, txDetail.feePaid - BASE_FEE_LAMPORTS)
    : 0;
  const baseFeeSol = BASE_FEE_LAMPORTS / 1e9;
  const priorityFeeSol = priorityFee / 1e9;

  const otherAddr = isOut ? transfer.to : transfer.from;

  return ReactDOM.createPortal(
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Transfer details"
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <Flex justify="between" align="center">
          <Txt size="lg">{tr("walletPage.transferDetails")}</Txt>
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
            <LoaderCircle className={styles.loadingSpinner} size={20} strokeWidth={1.8} />
          </div>
        ) : (
          <div className={styles.twoColumnLayout}>
            {/* Left column: main transfer info */}
            <div>
              {/* Transfer Visual mapping */}
              <Flex dir="row" align="center" gap={6}>
                <Flex
                  dir="column"
                  align="center"
                  gap={3}
                  className={styles.tokenCard}
                >
                  <Txt size="sm" secondary uppercase>
                    {isOut ? tr("walletPage.sent") : tr("walletPage.received")}
                  </Txt>
                  <Txt size="lg" mono>
                    {fmt.num.compact.decimal(transfer.amount)}
                  </Txt>
                  <TokenIdentityCell
                    symbol={tokenSymbol}
                    fullName={tokenName}
                    imageUrl={tokenLogoUri ?? undefined}
                    imageSize={30}
                    tooltipAlign="right"
                  />
                </Flex>

                <div className={styles.arrow}>
                  {isOut ? <ArrowRight size={28} /> : <ArrowLeft size={28} />}
                </div>

                <Flex
                  dir="column"
                  align="center"
                  gap={3}
                  className={styles.tokenCard}
                >
                  <Txt size="sm" secondary uppercase>
                    {isOut ? tr("walletPage.to") : tr("walletPage.from")}
                  </Txt>
                  <AddressLinkWithCopy address={otherAddr} />
                </Flex>
              </Flex>

              {/* Summary Sentence */}
              <div className={styles.summary}>
                <Txt>
                  {isOut ? tr("walletPage.sent") : tr("walletPage.received")}{" "}
                  <strong>
                    {fmt.num.compact.decimal(transfer.amount)} {tokenSymbol}
                  </strong>{" "}
                  {isOut ? tr("walletPage.to") : tr("walletPage.from")}{" "}
                  <strong title={otherAddr}>
                    {fmt.text.address(otherAddr)}
                  </strong>
                </Txt>
              </div>

              {/* Detail Rows */}
              <Flex dir="column" gap={6}>
                <Divider />

                <Flex justify="between" align="center">
                  <Txt>{tr("walletPage.signature")}</Txt>
                  <Flex align="center" gap={2}>
                    <a
                      href={`https://solscan.io/tx/${signature}`}
                      target="_blank"
                    >
                      <Txt mono>{fmt.text.txHash(signature)}</Txt>
                    </a>
                    <Launch size={16} />
                  </Flex>
                </Flex>

                <Flex justify="between" align="center" gap={5}>
                  <Txt>{tr("walletPage.time")}</Txt>
                  <Txt mono>{fmt.datetime.datetime(timestamp)}</Txt>
                </Flex>

                <Flex justify="between" align="center" gap={5}>
                  <Txt>{tr("walletPage.from")}</Txt>
                  <AddressLinkWithCopy address={transfer.from} />
                </Flex>

                <Flex justify="between" align="center" gap={5}>
                  <Txt>{tr("walletPage.to")}</Txt>
                  <AddressLinkWithCopy address={transfer.to} />
                </Flex>

                <Flex justify="between" align="center" gap={5}>
                  <Txt>{tr("walletPage.token")}</Txt>
                  <TokenIdentityCell
                    symbol={tokenSymbol}
                    fullName={tokenName}
                    imageUrl={tokenLogoUri ?? undefined}
                    imageSize={16}
                  />
                </Flex>

                <Flex justify="between" align="center" gap={5}>
                  <Txt>{tr("walletPage.amount")}</Txt>
                  <Txt mono>{fmt.num.compact.decimal(transfer.amount)}</Txt>
                </Flex>

                {transfer.amountUsd != null && (
                  <Flex justify="between" align="center" gap={5}>
                    <Txt>{tr("walletPage.value")}</Txt>
                    <Txt mono>{fmt.num.currency(transfer.amountUsd)}</Txt>
                  </Flex>
                )}

                {txDetail && (
                  <Flex dir="column" gap={5}>
                    <Divider />
                    <Flex justify="between" align="center">
                      <Txt>{tr("walletPage.feeInLamports")}</Txt>
                      <Txt mono>
                        {fmt.num.unit(txDetail.feePaid / 1e9, "SOL")}
                      </Txt>
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
                      <AddressLinkWithCopy address={txDetail.feePayer} />
                    </Flex>
                  </Flex>
                )}
              </Flex>
            </div>

            {/* Right column: Transfers list in same tx */}
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
                      const isTransferOut = t.from === walletAddress;
                      const otherTransferAddr = isTransferOut ? t.to : t.from;
                      const isInternal = t.from === t.to;
                      const lookupMint = resolveTokenMetaLookupAddress(t.mint);
                      const meta = tokenMetaMap[lookupMint];
                      const symbol =
                        meta?.symbol || t.symbol || t.mint.slice(0, 8);
                      const name = meta?.name ?? t.name;
                      const logoUri = meta?.logoUri ?? t.logoUri;
                      const isCurrentTransfer =
                        t.from === transfer.from &&
                        t.to === transfer.to &&
                        t.mint === transfer.tokenAddress &&
                        t.amount === transfer.amount;

                      return (
                        <div
                          key={i}
                          className={`${styles.transferGroup} ${
                            isCurrentTransfer ? styles.highlighted : ""
                          }`}
                        >
                          <Flex justify="between" align="center">
                            <Flex align="center" gap={3}>
                              {isTransferOut ? (
                                <ArrowRight size={16} />
                              ) : (
                                <ArrowLeft size={16} />
                              )}
                              <TrendAmount
                                value={isTransferOut ? -t.amount : t.amount}
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
                                {isTransferOut
                                  ? tr("walletPage.to")
                                  : tr("walletPage.from")}
                              </Txt>
                              {isInternal ? (
                                <Txt mono>{tr("walletPage.internal")}</Txt>
                              ) : (
                                <AddressLinkWithCopy
                                  address={otherTransferAddr}
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
