import { Hono } from "hono";
import { messageText, statusCode } from "../util/responses.js";
import { validate, addressSchema } from "@middlewares/validation.js";
import * as balanceService from "@services/balances.js";

const app = new Hono().get(
  "/:address",
  validate("param", addressSchema),
  async (c) => {
    try {
      const { address } = c.req.valid("param");

      const balances = await balanceService.getWalletBalances(address);

      if (balances) {
        return c.json(balances, statusCode.Ok);
      } else {
        return c.json(
          messageText.FailedToFetchRequestedData,
          statusCode.BadGateway,
        );
      }
    } catch {
      return c.json(
        messageText.InternalServerError,
        statusCode.InternalServerError,
      );
    }
  },
);

export default app;
