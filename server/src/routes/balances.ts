import { Hono } from "hono";
import { addressSchema } from "../data/schema.js";
import { Message, messageText } from "../util/response-messages.js";
import { validate } from "@middlewares/validation.js";
import * as balanceService from "@services/balances.js";

const app = new Hono().get(
  "/:address",
  validate("param", addressSchema),
  async (c) => {
    try {
      const { address } = c.req.valid("param");

      const balances = await balanceService.getWalletBalances(address);

      if (balances) {
        return c.json(balances, 200);
      } else {
        return c.json(messageText[Message.FailedToFetchRequestedData], 502);
      }
    } catch {
      return c.json(messageText[Message.InternalServerError], 500);
    }
  },
);

export default app;
