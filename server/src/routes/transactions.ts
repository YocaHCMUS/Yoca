import { transactionListSchema, validate } from "@sv/middlewares/validation";
import * as transactionService from "@sv/services/transactions.js";
import { messageText, statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

const app = new Hono().get(
  "/:transactions",
  validate("param", transactionListSchema),
  async (c) => {
    try {
      const { transactions } = c.req.valid("param");

      const transactionDetails =
        await transactionService.getTransactionDetails(transactions);

      if (transactionDetails) {
        return c.json(transactionDetails, statusCode.Ok);
      } else {
        return c.json(
          messageText.FailedToFetchRequestData,
          statusCode.BadGateway,
        );
      }
    } catch (err) {
      console.error(err);
      return c.json(
        messageText.InternalServerError,
        statusCode.InternalServerError,
      );
    }
  },
);

export default app;
