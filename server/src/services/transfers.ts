import { db } from "@db/index.js";
import { tokenTransfers, tokenMeta } from "@db/schema.js";
import { desc } from "drizzle-orm";
import * as bitquery from "@util/util-bitquery.js";
import { TOKEN_TRANSFERS_TTL_MS } from "@config/constants.js";

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
      Symbol: string;
      Name: string;
      MintAddress: string;
      Native: boolean;
      Uri: string;
    };
  };
  Block: {
    Time: number;
  };
}

interface BQ_TransfersResponse {
  data: {
    Solana: {
      Transfers: BQ_Transfer[];
    };
  };
}

async function getTokenImage(uri: string): Promise<string> {
  try {
    const resp = await fetch(uri, { method: "GET" });
    if (resp.ok) {
      const metaData = await resp.json();
      return metaData.image ?? "";
    }
  } catch (err) {
    console.log("Unable to fetch image from URI:", uri);
  }
  return "placeholder";
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
              Symbol
              Name
              MintAddress
              Native
              Uri
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

    const transfersList = await Promise.all(
      res.data.Solana.Transfers.map(async (rawTransfer) => {
        const tokenImgUrl = await getTokenImage(
          rawTransfer.Transfer.Currency.Uri,
        );

        // Store token metadata if not exists
        await db
          .insert(tokenMeta)
          .values({
            address: rawTransfer.Transfer.Currency.MintAddress,
            name: rawTransfer.Transfer.Currency.Name,
            symbol: rawTransfer.Transfer.Currency.Symbol,
            imageUrl: tokenImgUrl,
          })
          .onConflictDoNothing();

        return {
          fromAddress: rawTransfer.Transfer.Sender.Address,
          toAddress: rawTransfer.Transfer.Receiver.Address,
          amount: rawTransfer.Transfer.Amount,
          amountUsd: rawTransfer.Transfer.AmountInUSD,
          time: rawTransfer.Block.Time,
          tokenAddress: rawTransfer.Transfer.Currency.MintAddress,
        };
      }),
    );

    // Insert transfers into database
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
  const thresholdDate = new Date(Date.now() - TOKEN_TRANSFERS_TTL_MS);

  // Try to get fresh data from cache
  const res = await db
    .select()
    .from(tokenTransfers)
    .orderBy(desc(tokenTransfers.time))
    .limit(limit);

  // Check if we have enough fresh data
  if (
    res.length == 0 ||
    (res.length > 0 && res[0].time < thresholdDate.getTime() / 1000)
  ) {
    // Data is stale or doesn't exist, fetch new data
    return await fetchLatestTransfers(limit);
  }

  return res;
}
