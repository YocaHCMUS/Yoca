import { Hono } from "hono";
import { paginationSchema } from "../data/schema.js";
import { Message, messageText } from "../util/response-messages.js";
import { validate } from "@middlewares/validation.js";
import * as transferService from "@services/transfers.js";

const app = new Hono().get(
  "/",
  validate("query", paginationSchema),
  async (c) => {
    try {
      const { limit } = c.req.valid("query");

      const transfers = await transferService.getLatestTransfers(limit);

      if (transfers) {
        return c.json(transfers, 200);
      } else {
        return c.json(messageText[Message.FailedToFetchRequestedData], 502);
      }
    } catch (err) {
      return c.json(messageText[Message.InternalServerError], 500);
    }
  },
);

export default app;
