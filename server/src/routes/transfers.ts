import { Hono } from "hono";
import { messageText, statusCode } from "@/util/responses.js";
import { paginationSchema, validate } from "@middlewares/validation.js";
import * as transferService from "@services/transfers.js";

const app = new Hono().get(
  "/",
  validate("query", paginationSchema),
  async (c) => {
    try {
      const { limit } = c.req.valid("query");

      const transfers = await transferService.getLatestTransfers(limit);

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
