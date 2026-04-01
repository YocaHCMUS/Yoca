import { db } from "@sv/db";
import type {
  TxInfoInsert,
  TxInfoSelect,
  TxNativeTransfersInsert,
  TxNativeTransfersSelect,
  TxTokenTransfersInsert,
  TxTokenTransfersSelect,
} from "@sv/db/transactions";
import {
  txInfo,
  txNativeTransfers,
  txTokenTransfers,
} from "@sv/db/transactions";
import * as hl from "@sv/util/util-helius";
import { inArray } from "drizzle-orm";

type TxInsert = {
  info: TxInfoInsert;
  tokenTransfers: TxTokenTransfersInsert[];
  nativeTransfers: TxNativeTransfersInsert[];
};

type TxAggregate = {
  infos: TxInfoSelect[];
  tokenTransfers: TxTokenTransfersSelect[];
  nativeTransfers: TxNativeTransfersSelect[];
};

function aggregate({ infos, tokenTransfers, nativeTransfers }: TxAggregate) {
  const tokenMap = new Map<string, TxTokenTransfersSelect[]>();
  for (const t of tokenTransfers) {
    if (!tokenMap.has(t.txHash)) tokenMap.set(t.txHash, []);
    tokenMap.get(t.txHash)!.push(t);
  }

  const nativeMap = new Map<string, TxNativeTransfersSelect[]>();
  for (const n of nativeTransfers) {
    if (!nativeMap.has(n.txHash)) nativeMap.set(n.txHash, []);
    nativeMap.get(n.txHash)!.push(n);
  }

  return infos.map((info) => ({
    info,
    tokenTransfers: tokenMap.get(info.txHash) ?? [],
    nativeTransfers: nativeMap.get(info.txHash) ?? [],
  }));
}

export async function fecthTransactionDetails(transactions: string[]) {
  if (transactions.length == 0) {
    return null;
  }

  const res = await hl.client.enhanced.getTransactions({
    transactions,
    commitment: "finalized",
  });

  const txDetails = res.map(
    (tx): TxInsert => ({
      info: {
        txHash: tx.signature,
        timestamp: tx.timestamp!,
        feePayer: tx.feePayer,
        fee: tx.fee,
        slot: tx.slot,
      },
      tokenTransfers: tx.tokenTransfers!.map((transfer) => ({
        txHash: tx.signature,
        amount:
          transfer.decimals == undefined
            ? Number(transfer.tokenAmount)
            : Number(transfer.tokenAmount) / transfer.decimals,
        tokenAddress: transfer.mint,
        fromWallet: transfer.fromUserAccount,
        toWallet: transfer.toUserAccount,
      })),
      nativeTransfers: tx.nativeTransfers!.map((transfer) => ({
        txHash: tx.signature,
        amount: transfer.amount,
        fromWallet: transfer.fromUserAccount,
        toWallet: transfer.toUserAccount,
      })),
    }),
  );

  const infos = await db
    .insert(txInfo)
    .values(txDetails.map((details) => details.info))
    .onConflictDoNothing()
    .returning();
  const tokenTransfers = await db
    .insert(txTokenTransfers)
    .values(txDetails.flatMap((details) => details.tokenTransfers))
    .returning();
  const nativeTransfers = await db
    .insert(txNativeTransfers)
    .values(txDetails.flatMap((details) => details.nativeTransfers))
    .returning();

  return aggregate({ infos, tokenTransfers, nativeTransfers });
}

export async function getTransactionDetails(transactions: string[]) {
  if (transactions.length == 0) {
    return null;
  }

  const res = aggregate({
    infos: await db
      .select()
      .from(txInfo)
      .where(inArray(txInfo.txHash, transactions)),
    tokenTransfers: await db
      .select()
      .from(txTokenTransfers)
      .where(inArray(txTokenTransfers.txHash, transactions)),

    nativeTransfers: await db
      .select()
      .from(txNativeTransfers)
      .where(inArray(txNativeTransfers.txHash, transactions)),
  });

  const txToDetails = Object.fromEntries(res.map((tx) => [tx.info.txHash, tx]));

  const missedTxs = transactions.filter((tx) => !txToDetails[tx]);
  const newlyFetchedTxs = await fecthTransactionDetails(missedTxs);
  if (newlyFetchedTxs != null) {
    return [...res, ...newlyFetchedTxs];
  }

  return res;
}
