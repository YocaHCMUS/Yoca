import { db } from "@db/index.js";
import { tokenTransfers, type TokenTransferInsert } from "@db/schema.js";
import { desc } from "drizzle-orm";
import * as bitquery from "@util/util-bitquery.js";

interface BQ_Transfer {
  Transfer: {
    Amount: number;
    AmountInUSD: number;
    Sender: {
      Address: string;
    };
    Receiver: {
      Address: string;
    };
    Currency: {
      MintAddress: string;
      Native: boolean;
      Wrapped: boolean;
    };
  };
  Block: {
    Time: string;
  };
}

interface BQ_TransfersResponse {
  data: {
    Solana: {
      Transfers: BQ_Transfer[];
    };
  };
}

async function fetchLatestTransfers(limit: number) {
  const query = `
    query GetLatestTransfers($limit: Int!) {
      Solana {
        Transfers(limit: { count : $limit}, orderBy: {descending: Block_Time}) {
          Transfer {
            Amount
            AmountInUSD
            Sender {
              Address
            }
            Receiver {
              Address
            }
            Currency {
              Native
              Wrapped
              MintAddress
            }
          }
          Block {
            Time
          }
        }
      }
    }
  `;

  const req = new Request(bitquery.getStreamingEndpoint(), {
    method: "POST",
    headers: bitquery.getRequiredHeaders(),
    body: JSON.stringify({
      query,
      variables: { limit },
    }),
  });

  const resp = await fetch(req);

  if (resp.ok) {
    const res: BQ_TransfersResponse = await resp.json();

    const transfersList: TokenTransferInsert[] = await Promise.all(
      res.data.Solana.Transfers.map(async (rawTransfer) => {
        return {
          fromAddress: rawTransfer.Transfer.Sender.Address,
          toAddress: rawTransfer.Transfer.Receiver.Address,
          amount: rawTransfer.Transfer.Amount,
          amountUsd: rawTransfer.Transfer.AmountInUSD,
          time: new Date(rawTransfer.Block.Time),
          tokenAddress: rawTransfer.Transfer.Currency.Native
            ? "native"
            : rawTransfer.Transfer.Currency.MintAddress,
        };
      }),
    );

    console.log(transfersList);

    if (transfersList.length > 0) {
      return await db
        .insert(tokenTransfers)
        .values(transfersList)
        .onConflictDoNothing()
        .returning();
    }
    return transfersList;
  }

  return null;
}

export async function getLatestTransfers(limit: number) {
  // Try to get fresh data from cache
  const res = await db
    .select()
    .from(tokenTransfers)
    .orderBy(desc(tokenTransfers.time))
    .limit(limit);

  if (res.length == 0) {
    return await fetchLatestTransfers(limit);
  }

  return res;
}
