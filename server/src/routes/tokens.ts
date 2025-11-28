import { Hono } from "hono";
import { addressListSchema, validate } from "@middlewares/validation.js";
import { Message, messageText } from "@util/response-messages.js";
import * as tokenService from "@services/tokens.js";

const app = new Hono()
  .get("/meta/:addresses", validate("param", addressListSchema), async (c) => {
    try {
      const { addresses } = c.req.valid("param");

      const meta = await tokenService.getTokenMetaList(addresses);

      if (meta) {
        return c.json(meta, 200);
      } else {
        return c.json(messageText[Message.FailedToFetchRequestedData], 502);
      }
    } catch {
      return c.json(messageText[Message.InternalServerError], 500);
    }
  })
  .get(
    "/markets/:addresses",
    validate("param", addressListSchema),
    async (c) => {
      try {
        const { addresses } = c.req.valid("param");
        const marketData = await tokenService.getTokenMarketData(addresses);

        if (marketData) {
          return c.json(marketData, 200);
        } else {
          return c.json(messageText[Message.FailedToFetchRequestedData], 502);
        }
      } catch (err) {
        return c.json(messageText[Message.InternalServerError], 500);
      }
    },
  );

export default app;
