import { setErr } from "@sv/config/errors.js";
import {
  addressListSchema,
  addressSchema,
  validate,
} from "@sv/middlewares/validation.js";
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
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.BadGateway,
        );
      }
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
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
            
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }
      } catch (err) {
        console.error(err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
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
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }
      } catch (err) {
        console.error(err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  )
  .get(
    "/markets/chart/:address/overview",
    validate("param", addressSchema),
    async (c) => {
      try {
        const { address } = c.req.valid("param");
        const days = c.req.query("days") ?? "1";
        const parsedDays = days === "max" ? ("max" as const) : Number(days);
        const chartData = await tokenService.getTokenMarketChart(
          address,
          parsedDays,
        );
        if (chartData) {
          return c.json(chartData, statusCode.Ok);
        } else {
          return c.json(
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }
      } catch (err) {
        console.error(err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  )
  .get(
    "/holders/stats/:addresses",
    validate("param", addressListSchema),
    async (c) => {
      try {
        const { addresses } = c.req.valid("param");

        const holders = await tokenService.getTokenHolderStats(addresses);

        if (holders) {
          return c.json(holders, statusCode.Ok);
        } else {
          return c.json(
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }
      } catch (err) {
        console.error(err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  )
  .get("/holders/:address", validate("param", addressSchema), async (c) => {
    try {
      const { address } = c.req.valid("param");

      const holders = await tokenService.getTopTokenHolders(address);

      if (holders) {
        return c.json(holders, statusCode.Ok);
      } else {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .get("/:address/pools", validate("param", addressSchema), async (c) => {
    try {
      const { address } = c.req.valid("param");

      const pools = await tokenService.getTokenTopPools(address);

      return c.json(pools, statusCode.Ok);
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .get("/pools/:addresses", validate("param", addressListSchema), async (c) => {
    try {
      const { addresses } = c.req.valid("param");

      const pools = await tokenService.getTokenPoolDataList(addresses);

      if (pools) {
        return c.json(pools, statusCode.Ok);
      } else {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .get(
    "/pools/trades/:address",
    validate("param", addressSchema),
    async (c) => {
      try {
        const { address: poolAddress } = c.req.valid("param");

        const trades = await tokenService.getPoolTrades24h(poolAddress);
        return c.json(trades, statusCode.Ok);
      } catch (err) {
        console.error(err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  );
// .get("/trending", async (c) => {
//   try {
//     const trending = await tokenService.getTrendingTokens();
//     return c.json(trending, statusCode.Ok);
//   } catch (err) {
//     console.error(err);
//     return c.json(
//       messageText.InternalServerError,
//       statusCode.InternalServerError,
//     );
//   }
// });

export default app;
