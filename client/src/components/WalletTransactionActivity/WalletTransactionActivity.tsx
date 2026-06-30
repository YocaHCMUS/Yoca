import client from "@/api/main";
import Tble from "@/components/Tble"; // adjust import path as needed
import { SwapDetailModal } from "@/components/wallet/SwapDetailModal/SwapDetailModal";
import { TransferDetailModal } from "@/components/wallet/TransferDetailModal/TransferDetailModal";
import { useGet, UseGetResp } from "@/hooks/useGet";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { WalletSwap, WalletTransfer } from "@/services/wallet/walletApi";
import { useMemo, useState } from "react";
import { PillTabs } from "@/components/common/PillTabs/PillTabs";
import { IconActionButton } from "@/components/charts/shared/ChartControls";
import { TknImg } from "../TknImg";
import { Flex } from "../Flex";
import { Txt } from "../Txt";
import { CpyBtn } from "../CpyBtn";
import { TrendNum } from "../TrendNum";
import styles from "./WalletTransactionActivity.module.scss";
import { ExternalLink } from "lucide-react";
import { SOLSCAN_TX_URL } from "@/config/constants";

type WalletSwapData = {
  transactions: {
    transactionHash: string;
    actId: string;
    blockTimestampMs: number;
    bought: {
      address: string;
      amount: number;
      symbol: string | null;
      name: string | null;
      logoUri: string | null;
      priceUsd: number | null;
    };
    sold: {
      address: string;
      amount: number;
      symbol: string | null;
      name: string | null;
      logoUri: string | null;
      priceUsd: number | null;
    };
    totalValueUsd: number | null;
  }[];
  cursor: string | null;
};

type ActivityTab = "swaps" | "transfers";

type WalletTransferData = {
  transactions: {
    transactionHash: string;
    actId: string;
    blockTimestampMs: number;
    token: {
      address: string;
      amount: number;
      symbol: string | null;
      name: string | null;
      logoUri: string | null;
      priceUsd: number | null;
    };
    direction: "send" | "receive";
    counterpartyAddress: string;
    valueUsd: number;
  }[];
  cursor: string | null;
};

function LowValueFilter({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { tr } = useLocalization();

  return (
    <Flex
      className={styles.lowValueFilter}
      align="center"
      justify="end"
      gap={2}
      pBlock={3}
      pInline={4}
    >
      <label className={styles.checkboxLabel} htmlFor={id}>
        <input
          id={id}
          className={styles.checkboxInput}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className={styles.checkboxBox} aria-hidden="true" />
        <span>{tr("walletPage.hideLowValue")}</span>
      </label>
    </Flex>
  );
}

function AddressCell({
  address,
  secondary = false,
}: {
  address: string;
  secondary?: boolean;
}) {
  const { fmt } = useLocalization();
  return (
    <Flex gap={2} align="center">
      <Txt size="sm" weight={secondary ? "regular" : "bold"}>
        {fmt.text.address(address)}
      </Txt>
      <CpyBtn copyWhat={address} size="xs" />
    </Flex>
  );
}

function TokenAmountCell({
  address,
  amount,
  symbol,
  logoUri,
  direction,
}: {
  address: string;
  amount: number;
  symbol: string;
  logoUri: string | null;
  direction: "in" | "out" | "none";
}) {
  const { fmt } = useLocalization();
  return (
    <Flex gap={4} align="center">
      <TrendNum
        value={amount}
        direction={direction}
        prefixes="none"
        formatter={fmt.num.compact.decimal}
        size="sm"
      />
      <Flex gap={2} align="center">
        <TknImg size={22} src={logoUri} />
        <Txt size="sm">{symbol}</Txt>
        <CpyBtn copyWhat={address} size="xs" />
      </Flex>
    </Flex>
  );
}

export function WalletTransactionActivity({ address }: { address: string }) {
  const { tr, fmt } = useLocalization();
  const [selectedSwap, setSelectedSwap] = useState<WalletSwap | null>(null);
  const [selectedTransfer, setSelectedTransfer] =
    useState<WalletTransfer | null>(null);
  const [hideLowValue, setHideLowValue] = useState(false);
  const [activeActivityTab, setActiveActivityTab] = useState<ActivityTab>("swaps");
  const minValueUsd = hideLowValue ? 1 : undefined;

  const swapResp: UseGetResp<WalletSwapData> = useGet(
    client.api.wallets.swaps.history[":address"],
    200,
    {
      param: { address },
      query: { minValueUsd },
    },
  );

  const transferResp: UseGetResp<WalletTransferData> = useGet(
    client.api.wallets.transfers.history[":address"],
    200,
    { param: { address }, query: { minValueUsd } },
  );

  // Swap rows – plain text
  const swapRows = useMemo(() => {
    const transactions = swapResp.data?.transactions ?? [];
    return transactions.map((tx) => {
      const soldSym = tx.sold.symbol?.toUpperCase() ?? tx.sold.address;
      const boughtSym = tx.bought.symbol?.toUpperCase() ?? tx.bought.address;
      const time = (
        <Txt size="sm">
          {fmt.datetime.relativeShort(tx.blockTimestampMs, true)}
        </Txt>
      );
      const soldDisplay = (
        <TokenAmountCell
          address={tx.sold.address}
          amount={tx.sold.amount}
          symbol={soldSym}
          logoUri={tx.sold.logoUri}
          direction="out"
        />
      );
      const boughtDisplay = (
        <TokenAmountCell
          address={tx.bought.address}
          amount={tx.bought.amount}
          symbol={boughtSym}
          logoUri={tx.bought.logoUri}
          direction="in"
        />
      );
      const value = (
        <Txt size="sm">{fmt.num.compact.currency(tx.totalValueUsd)}</Txt>
      );

      const transaction = (
        <IconActionButton
          href={`${SOLSCAN_TX_URL}/${tx.transactionHash}`}
          label={tr("walletPage.openInSolscan")}
          icon={ExternalLink}
          target="_blank"
        />
      );

      return {
        id: `${tx.transactionHash}-${tx.actId}`,
        time,
        tokenSold: soldDisplay,
        tokenBought: boughtDisplay,
        value,
        transaction,
      };
    });
  }, [swapResp.data, fmt, tr]);

  // Transfer rows – plain text
  const transferRows = useMemo(() => {
    const transactions = transferResp.data?.transactions ?? [];

    return transactions
      .map((tx) => {
        const tokenSym = tx.token.symbol?.toUpperCase() ?? tx.token.address;
        const time = (
          <Txt size="sm">
            {fmt.datetime.relativeShort(tx.blockTimestampMs, true)}
          </Txt>
        );

        const sender = (
          <AddressCell
            address={tx.direction == "send" ? address : tx.counterpartyAddress}
            secondary={tx.direction == "receive"}
          />
        );
        const receiver = (
          <AddressCell
            address={tx.direction == "send" ? tx.counterpartyAddress : address}
            secondary={tx.direction == "send"}
          />
        );

        const tokenDisplay = (
          <TokenAmountCell
            address={tx.token.address}
            amount={tx.token.amount}
            symbol={tokenSym}
            logoUri={tx.token.logoUri}
            direction={tx.direction == "send" ? "out" : "in"}
          />
        );
        const value = (
          <Txt size="sm">{fmt.num.compact.currency(tx.valueUsd)}</Txt>
        );

        const transaction = (
          <IconActionButton
            href={`${SOLSCAN_TX_URL}/${tx.transactionHash}`}
            label={tr("walletPage.openInSolscan")}
            icon={ExternalLink}
            target="_blank"
          />
        );

        return {
          id: `${tx.transactionHash}-${tx.actId}`,
          time,
          sender,
          receiver,
          token: tokenDisplay,
          value,
          transaction,
        };
      });
  }, [transferResp.data, fmt, address, tr]);

  // Headers – plain text
  const swapHeaders = [
    { key: "time", header: tr("walletPage.time") },
    { key: "tokenSold", header: tr("walletPage.tokenSold") },
    { key: "tokenBought", header: tr("walletPage.tokenBought") },
    { key: "value", header: tr("walletPage.value") },
    {
      key: "transaction",
      header: tr("walletPage.transaction"),
      align: "center" as const,
    },
  ];

  const transferHeaders = [
    { key: "time", header: tr("walletPage.time") },
    { key: "sender", header: tr("walletPage.sender") },
    { key: "receiver", header: tr("walletPage.receiver") },
    { key: "token", header: tr("walletPage.token") },
    { key: "value", header: tr("walletPage.value") },
    {
      key: "transaction",
      header: tr("walletPage.transaction"),
      align: "center" as const,
    },
  ];

  const swapLoading = swapResp.isLoading;
  const transferLoading = transferResp.isLoading;

  return (
    <div className={styles.root}>
      <div className={styles.tabs}>
        <PillTabs
          options={[
            { value: "swaps", label: "Swaps" },
            { value: "transfers", label: "Transfers" },
          ]}
          value={activeActivityTab}
          onChange={(value) => setActiveActivityTab(value as ActivityTab)}
          size="sm"
          className={styles.tabSwitch}
        />

        {activeActivityTab == "swaps" ? (
          <div className={styles.tabPanel}>
            <Tble
              key="swaps"
              rows={swapRows}
              headers={swapHeaders}
              loading={swapLoading}
              height="auto"
              enablePagination
              pageSize={16}
              boxed
              pageUnknown
              toolBar={
                <LowValueFilter
                  id="hide-low-value-swaps"
                  checked={hideLowValue}
                  onChange={setHideLowValue}
                />
              }
              onRowClick={(row) => {
                const transaction = swapResp.data?.transactions.find(
                  (tx, index) =>
                    (tx.transactionHash || `swap-${index}`) == row.id,
                );
                if (!transaction) return;

                const soldPriceUsd = transaction.sold.priceUsd ?? 0;
                const boughtPriceUsd = transaction.bought.priceUsd ?? 0;
                setSelectedSwap({
                  transactionHash: transaction.transactionHash,
                  transactionType: "swap",
                  blockTimestampIso: new Date(
                    transaction.blockTimestampMs,
                  ).toISOString(),
                  subcategory: null,
                  walletAddress: address,
                  pairAddress: "",
                  tokensInvolved: `${transaction.sold.symbol ?? transaction.sold.address},${transaction.bought.symbol ?? transaction.bought.address}`,
                  sold: {
                    address: transaction.sold.address,
                    amount: transaction.sold.amount,
                    symbol: transaction.sold.symbol,
                    name: transaction.sold.name,
                    logoUri: transaction.sold.logoUri,
                    priceUsd: soldPriceUsd,
                    valueUsd: transaction.sold.amount * soldPriceUsd,
                  },
                  bought: {
                    address: transaction.bought.address,
                    amount: transaction.bought.amount,
                    symbol: transaction.bought.symbol,
                    name: transaction.bought.name,
                    logoUri: transaction.bought.logoUri,
                    priceUsd: boughtPriceUsd,
                    valueUsd: transaction.bought.amount * boughtPriceUsd,
                  },
                  totalValueUsd: transaction.totalValueUsd,
                  baseQuotePrice: null,
                });
              }}
            />
          </div>
        ) : (
          <div className={styles.tabPanel}>
            <Tble
              key="transfers"
              rows={transferRows}
              headers={transferHeaders}
              loading={transferLoading}
              height="auto"
              enablePagination
              pageSize={16}
              boxed
              pageUnknown
              toolBar={
                <LowValueFilter
                  id="hide-low-value-transfers"
                  checked={hideLowValue}
                  onChange={setHideLowValue}
                />
              }
              onRowClick={(row) => {
                const transaction = transferResp.data?.transactions.find(
                  (tx, index) =>
                    (tx.transactionHash || `transfer-${index}`) == row.id,
                );
                if (!transaction) return;

                setSelectedTransfer({
                  from:
                    transaction.direction == "send"
                      ? address
                      : transaction.counterpartyAddress,
                  to:
                    transaction.direction == "send"
                      ? transaction.counterpartyAddress
                      : address,
                  amount: transaction.token.amount,
                  amountUsd: transaction.valueUsd,
                  timestamp: new Date(
                    transaction.blockTimestampMs,
                  ).toISOString(),
                  tokenAddress: transaction.token.address,
                  tokenSymbol: transaction.token.symbol ?? "Unknown",
                  tokenName: transaction.token.name ?? undefined,
                  tokenLogoUri: transaction.token.logoUri ?? undefined,
                  priceUsd: transaction.token.priceUsd ?? undefined,
                  transactionSignature: transaction.transactionHash,
                  instructionIndex: 0,
                });
              }}
            />
          </div>
        )}
      </div>
      <SwapDetailModal
        isOpen={selectedSwap != null}
        onClose={() => setSelectedSwap(null)}
        swap={selectedSwap}
        walletAddress={address}
      />
      <TransferDetailModal
        isOpen={selectedTransfer != null}
        onClose={() => setSelectedTransfer(null)}
        transfer={selectedTransfer}
        walletAddress={address}
      />
    </div>
  );
}
