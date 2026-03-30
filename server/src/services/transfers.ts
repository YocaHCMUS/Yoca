import { type TokenTransferInsert } from "@sv/db/schema.js";
import { trackedFetch } from "@sv/services/tracking/apiCallTracker.service.js";
import * as bitquery from "@sv/util/util-bitquery.js";

interface BQ_Transfer {
  Transfer: {
    Amount: number;
    AmountInUSD: number;
    Sender: {
      Address: string;
      Owner: string;
    };
    Receiver: {
      Address: string;
      Owner: string;
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
  Instruction: {
    Index: number;
  };
  Transaction: {
    Signature: string;
  };
}

interface BQ_TransfersResponse {
  data: {
    Solana: {
      Transfers: BQ_Transfer[];
    };
  };
}

async function fetchLatestTransfers(limit: number, offset: number) {
  const query = `
    query GetLatestTransfers($limit: Int!, $offset: Int!) {
      Solana {
        Transfers(limit: { count : $limit, offset: $offset}, orderBy: {descending: Block_Time}) {
          Transfer {
            Amount
            AmountInUSD
            Sender {
              Address
              Owner
            }
            Receiver {
              Address
              Owner
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
          Instruction {
            Index
          }
          Transaction {
            Signature
          }
        }
      }
    }
  `;

  const resp = await trackedFetch({
    provider: "bitquery",
    url: bitquery.getStreamingEndpoint(),
    init: {
      method: "POST",
      headers: bitquery.getRequiredHeaders(),
      body: JSON.stringify({
        query,
        variables: { limit, offset },
      }),
    },
    apiKey: bitquery.getBitqueryApiKeyMetadata(),
    serviceFile: "server/src/services/transfers.ts",
    functionName: "fetchLatestTransfers",
  });

  if (resp.ok) {
    const res = (await resp.json()) as BQ_TransfersResponse;

    const transfersList = await Promise.all(
      res.data.Solana.Transfers.map(
        async (rawTransfer): Promise<TokenTransferInsert> => ({
          address: rawTransfer.Transfer.Currency.Native
            ? "native"
            : rawTransfer.Transfer.Currency.MintAddress,
          tokenAddress: rawTransfer.Transfer.Currency.Native
            ? "native"
            : rawTransfer.Transfer.Currency.MintAddress,
          fromOwner: rawTransfer.Transfer.Sender.Address,
          toOwner: rawTransfer.Transfer.Receiver.Address,
          amount: rawTransfer.Transfer.Amount,
          amountUsd: rawTransfer.Transfer.AmountInUSD,
          blockTime: new Date(rawTransfer.Block.Time),
          tokenSymbol: "",
          transactionSignature: rawTransfer.Transaction.Signature,
          instructionIndex: rawTransfer.Instruction.Index,
        }),
      ),
    );

    return transfersList;
  }

  return null;
}

export async function getLatestTransfers(limit: number, offset: number) {
  return await fetchLatestTransfers(limit, offset);
}
