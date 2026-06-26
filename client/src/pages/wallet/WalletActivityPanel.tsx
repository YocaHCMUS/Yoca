import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import type { WalletSwap, WalletTransfer } from "@/services/wallet/walletApi";
import { ArrowDownLeft, ArrowUpRight, Copy, ExternalLink, Repeat2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SwapDetailModal } from "@/components/wallet/SwapDetailModal/SwapDetailModal";
import { TransferDetailModal } from "@/components/wallet/TransferDetailModal/TransferDetailModal";
import styles from "./WalletActivityPanel.module.scss";

type WalletSwapData = {
  transactions: Array<{
    transactionHash: string;
    blockTimestampMs: number;
    bought: { address: string; amount: number; symbol: string | null; name: string | null; logoUri: string | null; priceUsd: number | null };
    sold: { address: string; amount: number; symbol: string | null; name: string | null; logoUri: string | null; priceUsd: number | null };
    totalValueUsd: number | null;
  }>;
};

type WalletTransferData = {
  transactions: Array<{
    transactionHash: string;
    blockTimestampMs: number;
    token: { address: string; amount: number; symbol: string | null; name: string | null; logoUri: string | null; priceUsd: number | null };
    direction: "send" | "receive";
    counterpartyAddress: string;
    valueUsd: number;
  }>;
};

type ActivityMode = "swap" | "transfer";

function TokenPill({ symbol, logoUri, amount, direction }: { symbol: string; logoUri: string | null; amount: number; direction: "in" | "out" }) {
  const { fmt } = useLocalization();
  return (
    <span className={styles.tokenPill} data-direction={direction}>
      {logoUri ? <img src={logoUri} alt="" /> : <span className={styles.tokenFallback}>{symbol.slice(0, 1)}</span>}
      <span><strong>{fmt.num.compact.decimal(amount)}</strong> {symbol}</span>
    </span>
  );
}

function CopyAddress({ address }: { address: string }) {
  const { fmt, tr } = useLocalization();
  return (
    <span className={styles.addressCell}>
      <code>{fmt.text.address(address)}</code>
      <button type="button" onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(address); }} aria-label={String(tr("walletPage.ui.copyAddress"))} title={String(tr("walletPage.ui.copyAddress"))}><Copy size={13} strokeWidth={1.8} /></button>
    </span>
  );
}

export function WalletActivityPanel({ address }: { address: string }) {
  const { tr, fmt } = useLocalization();
  const [mode, setMode] = useState<ActivityMode>("swap");
  const [hideLowValue, setHideLowValue] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<WalletSwap | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<WalletTransfer | null>(null);

  const swapResponse = useGet(
    client.api.wallets.swaps.history[":address"],
    200,
    { param: { address }, query: {} },
  );
  const transferResponse = useGet(
    client.api.wallets.transfers.history[":address"],
    200,
    { param: { address }, query: {} },
  );

  const swaps = useMemo(() => {
    const values = (swapResponse.data as unknown as WalletSwapData | undefined)?.transactions ?? [];
    return values.filter((item) => !hideLowValue || item.totalValueUsd == null || item.totalValueUsd >= 1).slice(0, 16);
  }, [hideLowValue, swapResponse.data]);

  const transfers = useMemo(() => {
    const values = (transferResponse.data as unknown as WalletTransferData | undefined)?.transactions ?? [];
    return values.filter((item) => !hideLowValue || item.valueUsd >= 1).slice(0, 16);
  }, [hideLowValue, transferResponse.data]);

  const loading = mode === "swap" ? swapResponse.isLoading : transferResponse.isLoading;
  const rows = mode === "swap" ? swaps : transfers;

  const selectSwap = (transaction: WalletSwapData["transactions"][number]) => {
    const soldPriceUsd = transaction.sold.priceUsd ?? 0;
    const boughtPriceUsd = transaction.bought.priceUsd ?? 0;
    setSelectedSwap({
      transactionHash: transaction.transactionHash,
      transactionType: "swap",
      blockTimestampIso: new Date(transaction.blockTimestampMs).toISOString(),
      subcategory: null,
      walletAddress: address,
      pairAddress: "",
      tokensInvolved: `${transaction.sold.symbol ?? transaction.sold.address},${transaction.bought.symbol ?? transaction.bought.address}`,
      sold: { ...transaction.sold, priceUsd: soldPriceUsd, valueUsd: transaction.sold.amount * soldPriceUsd },
      bought: { ...transaction.bought, priceUsd: boughtPriceUsd, valueUsd: transaction.bought.amount * boughtPriceUsd },
      totalValueUsd: transaction.totalValueUsd,
      baseQuotePrice: null,
    });
  };

  const selectTransfer = (transaction: WalletTransferData["transactions"][number]) => {
    setSelectedTransfer({
      from: transaction.direction === "send" ? address : transaction.counterpartyAddress,
      to: transaction.direction === "send" ? transaction.counterpartyAddress : address,
      amount: transaction.token.amount,
      amountUsd: transaction.valueUsd,
      timestamp: new Date(transaction.blockTimestampMs).toISOString(),
      tokenAddress: transaction.token.address,
      tokenSymbol: transaction.token.symbol ?? tr("walletPage.unknown"),
      tokenName: transaction.token.name ?? undefined,
      tokenLogoUri: transaction.token.logoUri ?? undefined,
      priceUsd: transaction.token.priceUsd ?? undefined,
      transactionSignature: transaction.transactionHash,
      instructionIndex: 0,
    });
  };

  return (
    <section className={styles.card} aria-label={tr("walletPage.activity")}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon}><Repeat2 size={17} strokeWidth={1.75} /></span>
          <div><h2>{tr("walletPage.activity")}</h2><p>{tr("walletPage.ui.recentOnchainActivity")}</p></div>
        </div>
        <label className={styles.filterToggle}>
          <input type="checkbox" checked={hideLowValue} onChange={(event) => setHideLowValue(event.target.checked)} />
          <span>{tr("walletPage.hideLowValue")}</span>
        </label>
      </header>

      <div className={styles.tabs} role="tablist" aria-label={tr("walletPage.activity")}>
        <button type="button" role="tab" aria-selected={mode === "swap"} data-active={mode === "swap"} onClick={() => setMode("swap")}><Repeat2 size={14} strokeWidth={1.85} />{tr("walletPage.swap")}</button>
        <button type="button" role="tab" aria-selected={mode === "transfer"} data-active={mode === "transfer"} onClick={() => setMode("transfer")}><ArrowUpRight size={14} strokeWidth={1.85} />{tr("walletPage.transfer")}</button>
      </div>

      <div className={styles.tableWrap}>
        {mode === "swap" ? (
          <table className={styles.table}>
            <thead><tr><th>{tr("walletPage.time")}</th><th>{tr("walletPage.tokenSold")}</th><th>{tr("walletPage.tokenBought")}</th><th>{tr("walletPage.value")}</th><th aria-label={tr("walletPage.view")} /></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className={styles.statusCell}>{tr("common.loading")}</td></tr> : swaps.length === 0 ? <tr><td colSpan={5} className={styles.statusCell}>{tr("common.noData")}</td></tr> : swaps.map((transaction) => (
                <tr key={transaction.transactionHash} onClick={() => selectSwap(transaction)}>
                  <td>{fmt.datetime.relativeShort(transaction.blockTimestampMs, true)}</td>
                  <td><TokenPill amount={transaction.sold.amount} symbol={(transaction.sold.symbol ?? transaction.sold.address).toUpperCase()} logoUri={transaction.sold.logoUri} direction="out" /></td>
                  <td><TokenPill amount={transaction.bought.amount} symbol={(transaction.bought.symbol ?? transaction.bought.address).toUpperCase()} logoUri={transaction.bought.logoUri} direction="in" /></td>
                  <td className={styles.valueCell}>{transaction.totalValueUsd != null ? fmt.num.currency(transaction.totalValueUsd) : "—"}</td>
                  <td><a href={`https://solscan.io/tx/${transaction.transactionHash}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={styles.externalLink} aria-label={tr("walletPage.openInSolscan")}><ExternalLink size={14} strokeWidth={1.8} /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>{tr("walletPage.time")}</th><th>{tr("walletPage.sender")}</th><th>{tr("walletPage.receiver")}</th><th>{tr("walletPage.token")}</th><th>{tr("walletPage.value")}</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className={styles.statusCell}>{tr("common.loading")}</td></tr> : transfers.length === 0 ? <tr><td colSpan={5} className={styles.statusCell}>{tr("common.noData")}</td></tr> : transfers.map((transaction) => (
                <tr key={transaction.transactionHash} onClick={() => selectTransfer(transaction)}>
                  <td>{fmt.datetime.relativeShort(transaction.blockTimestampMs, true)}</td>
                  <td><CopyAddress address={transaction.direction === "send" ? address : transaction.counterpartyAddress} /></td>
                  <td><CopyAddress address={transaction.direction === "send" ? transaction.counterpartyAddress : address} /></td>
                  <td><TokenPill amount={transaction.token.amount} symbol={(transaction.token.symbol ?? transaction.token.address).toUpperCase()} logoUri={transaction.token.logoUri} direction={transaction.direction === "send" ? "out" : "in"} /></td>
                  <td className={styles.valueCell}><span className={styles.direction} data-direction={transaction.direction}>{transaction.direction === "send" ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}</span>{fmt.num.currency(transaction.valueUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SwapDetailModal isOpen={selectedSwap != null} onClose={() => setSelectedSwap(null)} swap={selectedSwap} walletAddress={address} />
      <TransferDetailModal isOpen={selectedTransfer != null} onClose={() => setSelectedTransfer(null)} transfer={selectedTransfer} walletAddress={address} />
    </section>
  );
}
