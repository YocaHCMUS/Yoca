import { paginationSchema, validate } from "@sv/middlewares/validation.js";
import * as transferService from "@sv/services/transfers.js";
import { messageText, statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

const app = new Hono().get(
  "/",
  validate("query", paginationSchema),
  async (c) => {
    try {
      const { limit, offset } = c.req.valid("query");

      const transfers = await transferService.getLatestTransfers(limit, offset);

      if (transfers) {
        return c.json(transfers, statusCode.Ok);
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
