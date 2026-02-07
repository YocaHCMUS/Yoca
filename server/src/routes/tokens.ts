import {
  addressListSchema,
  addressSchema,
  validate,
} from "@sv/middlewares/validation.js";
import * as coingeckoOnchainService from "@sv/services/coingecko-onchain.js";
import * as moralisService from "@sv/services/moralis.js";
import * as tokenService from "@sv/services/tokens/index.js";
import { messageText, statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

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
  )
  .get(
    "/markets/chart/:address",
    validate("param", addressSchema),
    async (c) => {
      try {
        const { address } = c.req.valid("param");
        const marketData = await tokenService.get24hTokenMarketChart(address);
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
  )
  .get("/holders/:address", validate("param", addressSchema), async (c) => {
    try {
      const { address } = c.req.valid("param");
      const holders = await moralisService.getTopHolders(address);
      return c.json(holders, statusCode.Ok);
    } catch (err) {
      console.error(err);
      return c.json(
        messageText.InternalServerError,
        statusCode.InternalServerError,
      );
    }
  })
  .get("/trades/:network/:address", async (c) => {
    try {
      const { network, address } = c.req.param();
      // Validation handled manually or simple check
      if (!network || !address) {
        return c.json(
          { error: "Missing network or address" },
          statusCode.BadRequest,
        );
      }

      const trades = await coingeckoOnchainService.getPoolTrades(
        network,
        address,
      );
      return c.json(trades, statusCode.Ok);
    } catch (err) {
      console.error(err);
      return c.json(
        messageText.InternalServerError,
        statusCode.InternalServerError,
      );
    }
  });

export default app;
