import { Hono } from "hono";
import { addressListSchema, validate } from "@middlewares/validation.js";
import { statusCode, messageText } from "@/util/responses.js";
import * as tokenService from "@services/tokens.js";

const app = new Hono()
  .get("/meta/:addresses", validate("param", addressListSchema), async (c) => {
    try {
      const { addresses } = c.req.valid("param");

      const meta = await tokenService.getTokenMetaList(addresses);

      if (meta) {
        return c.json(meta, statusCode.Ok);
      } else {
        return c.json(
          messageText.FailedToFetchRequestedData,
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
  })
  .get(
    "/markets/:addresses",
    validate("param", addressListSchema),
    async (c) => {
      try {
        const { addresses } = c.req.valid("param");
        const marketData = await tokenService.getTokenMarketData(addresses);

        if (marketData) {
          return c.json(marketData, statusCode.Ok);
        } else {
          return c.json(
            messageText.FailedToFetchRequestedData,
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
