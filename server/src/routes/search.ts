import { searchQuerySchema, validate } from "@sv/middlewares/validation.js";
import { getSearchResult } from "@sv/services/search.js";
import { serverErr } from "@sv/util/errors";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

const app = new Hono().get(
  "/",
  validate("query", searchQuerySchema),
  async (c) => {
    try {
      const { q } = c.req.valid("query");
      const result = await getSearchResult(q);

      return c.json(
        {
          tokens: result.tokens,
          pools: result.pools,
          wallets: result.wallets,
        },
        statusCode.Ok,
      );
    } catch (e) {
      return serverErr(c, e);
    }
  },
);

export default app;

export type SearchAppType = typeof app;
