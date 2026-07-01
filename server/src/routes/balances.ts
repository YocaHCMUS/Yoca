import { addressSchema, validate } from "@sv/middlewares/validation.js";
import * as balanceService from "@sv/services/balances.js";
import { Hono } from "hono";
import { messageText, statusCode } from "../util/responses.js";

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

export type BalancesAppType = typeof app;
