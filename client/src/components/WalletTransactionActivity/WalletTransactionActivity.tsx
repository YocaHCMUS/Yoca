import client from "@/api/main";
import Tble from "@/components/Tble"; // adjust import path as needed
import { useGet, UseGetResp } from "@/hooks/useGet";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useMemo } from "react";
import {
    TabPanel,
    TabPanels,
    Tab,
    Tabs,
    TabList,
    IconButton,
} from "@carbon/react";
import { SOLSCAN_TX_URL } from "@/config/constants";
import { Launch } from "@carbon/icons-react";
import { TknImg } from "../TknImg";
import { Flex } from "../Flex";
import { Txt } from "../Txt";
import { CpyBtn } from "../CpyBtn";
import { TrendNum } from "../TrendNum";

type WalletSwapData = {
  transactions: {
    transactionHash: string;
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

type WalletTransferData = {
  transactions: {
    transactionHash: string;
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

function AddressCell({ address, secondary = false }: { address: string, secondary?: boolean }) {
  const { fmt } = useLocalization();
  return (
    <Flex gap={2} align="center">
      <Txt size="sm" weight={secondary ? "regular" : "bold"} >
        {fmt.text.address(address)}
      </Txt>
      <CpyBtn copyWhat={address} size="xs" />
    </Flex>
  );
}

function TokenAmountCell({
  amount,
  symbol,
  logoUri,
  direction,
}: {
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
        <Txt size="sm">
          {symbol}
        </Txt>
        <CpyBtn copyWhat={symbol} size="xs" />
      </Flex>
    </Flex>
  );
}

export function WalletTransactionActivity({ address }: { address: string }) {
  const { tr, fmt } = useLocalization();

  const swapResp: UseGetResp<WalletSwapData> = useGet(
    client.api.wallets.swaps.history[":address"],
    200,
    { param: { address }, query: {} },
  );
  const transferResp: UseGetResp<WalletTransferData> = useGet(
    client.api.wallets.transfers.history[":address"],
    200,
    { param: { address }, query: {} },
  );

  // Swap rows – plain text
  const swapRows = useMemo(() => {
    const transactions = swapResp.data?.transactions ?? [];
    return transactions.map((tx, index) => {
      const soldSym = tx.sold.symbol?.toUpperCase() ?? "Unknown";
      const boughtSym = tx.bought.symbol?.toUpperCase() ?? "Unknown";
      const time = fmt.datetime.relativeShort(tx.blockTimestampMs, true);
      const soldDisplay = (
        <TokenAmountCell
          amount={tx.sold.amount}
          symbol={soldSym}
          logoUri={tx.sold.logoUri}
          direction="out"
        />
      );
      const boughtDisplay = (
        <TokenAmountCell
          amount={tx.bought.amount}
          symbol={boughtSym}
          logoUri={tx.bought.logoUri}
          direction="in"
        />
      );
      const value = (<Txt size="sm">
        {tx.totalValueUsd != null ? fmt.num.currency(tx.totalValueUsd) : "—"}
      </Txt>);

      return {
        id: tx.transactionHash || `swap-${index}`,
        time,
        tokenSold: soldDisplay,
        tokenBought: boughtDisplay,
        value,
        transaction: (
          <IconButton
            href={`${SOLSCAN_TX_URL}/${tx.transactionHash}`}
            label={tr("walletPage.openInSolscan")}
            target="_blank"
            kind="ghost"
            size="xs"
          >
            <Launch size={18} />
          </IconButton>
        ),
      };
    });
  }, [swapResp.data, fmt]);

  // Transfer rows – plain text
  const transferRows = useMemo(() => {
    const transactions = transferResp.data?.transactions ?? [];

    return transactions.map((tx, index) => {
      const tokenSym = tx.token.symbol?.toUpperCase() ?? "Unknown";
      const time = fmt.datetime.relativeShort(tx.blockTimestampMs, true);

      const mainAddress = fmt.text.address(address);
      const counterPartyAddress = fmt.text.address(tx.counterpartyAddress);

      const sender = (
        <AddressCell
          address={tx.direction == "send" ? mainAddress : counterPartyAddress}
          secondary={tx.direction == "receive"}
        />
      );
      const receiver = (
        <AddressCell
          address={tx.direction == "send" ? counterPartyAddress : mainAddress}
          secondary={tx.direction == "send"}
        />
      );

      const tokenDisplay = (
        <TokenAmountCell
          amount={tx.token.amount}
          symbol={tokenSym}
          logoUri={tx.token.logoUri}
          direction={tx.direction == "send" ? "out" : "in"}
        />
      );
      const value = (<Txt size="sm">
        {tx.valueUsd != null ? fmt.num.currency(tx.valueUsd) : "—"}
      </Txt>);

      return {
        id: tx.transactionHash || `transfer-${index}`,
        time,
        sender,
        receiver,
        token: tokenDisplay,
        value,
        transaction: (
          <IconButton
            href={`${SOLSCAN_TX_URL}/${tx.transactionHash}`}
            label={tr("walletPage.openInSolscan")}
            target="_blank"
            kind="ghost"
            size="xs"
          >
            <Launch size={18} />
          </IconButton>
        ),
      };
    });
  }, [transferResp.data, fmt, address]);

  // Headers – plain text
  const swapHeaders = [
    { key: "time", header: tr("walletPage.time") },
    { key: "tokenSold", header: tr("walletPage.tokenSold") },
    { key: "tokenBought", header: tr("walletPage.tokenBought") },
    { key: "value", header: tr("walletPage.value") },
    {
      key: "transaction",
      header: " ",
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
      header: " ",
      align: "center" as const,
    },
  ];

  const swapLoading = swapResp.isLoading;
  const transferLoading = transferResp.isLoading;

  return (
    <div style={{ padding: "0.5rem" }}>
      <Tabs>
        <TabList scrollDebounceWait={200} fullWidth contained>
          <Tab>Swaps</Tab>
          <Tab>Transfers</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Tble
              key="swaps"
              rows={swapRows}
              headers={swapHeaders}
              loading={swapLoading}
              height={400}
              enablePagination
              pageSize={16}
              stickyHeader
              boxed
              pageUnknown
            />
          </TabPanel>

          <TabPanel>
            <Tble
              key="transfers"
              rows={transferRows}
              headers={transferHeaders}
              loading={transferLoading}
              height={400}
              enablePagination
              pageSize={16}
              stickyHeader
              boxed
              pageUnknown
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
}
