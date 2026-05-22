import { getTransactionBySignature } from "@sv/services/transactions.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

const app = new Hono().get("/:txHash", async (c) => {
  const txHash = c.req.param("txHash");

  try {
    const tx = await getTransactionBySignature(txHash);
    if (!tx) {
      return c.json({ error: "Transaction not found" }, statusCode.NotFound);
    }

    return c.json(tx, statusCode.Ok);
  } catch (err) {
    console.error("Failed to get transaction", err);

    if (
      err instanceof Error &&
      err.message.includes("HELIUS_API_KEY is not set")
    ) {
      return c.json(
        { error: "HELIUS_API_KEY is missing on server" },
        statusCode.ServiceUnavailable,
      );
    }

    if (err instanceof Error) {
      const heliusErr = err.message.match(
        /Helius enhanced tx request failed \((\d+)\):\s*(.*)$/,
      );
      if (heliusErr) {
        return c.json(
          {
            error: "Failed to fetch transaction from Helius",
            providerStatus: Number(heliusErr[1]),
            details: heliusErr[2],
          },
          statusCode.BadGateway,
        );
      }
    }

    return c.json(
      { error: "Failed to get transaction" },
      statusCode.InternalServerError,
    );
  }
});

export default app;

export type TransactionsAppType = typeof app;
