import { setErr } from "@sv/config/errors.js";
import { searchQuerySchema, validate } from "@sv/middlewares/validation.js";
import { statusCode } from "@sv/util/responses.js";
import * as cg from "@sv/util/util-coingecko.js";
import { Hono } from "hono";

type CG_SearchPools = {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      base_token_price_usd: string;
      base_token_price_native_currency: string;
      quote_token_price_usd: string;
      quote_token_price_native_currency: string;
      base_token_price_quote_token: string;
      quote_token_price_base_token: string;
      address: string;
      name: string;
      pool_created_at: string;
      fdv_usd: string;
      market_cap_usd: any;
      price_change_percentage: {
        m5: string;
        m15: string;
        m30: string;
        h1: string;
        h6: string;
        h24: string;
      };
      transactions: {
        m5: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        m15: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        m30: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        h1: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
        h24: {
          buys: number;
          sells: number;
          buyers: number;
          sellers: number;
        };
      };
      volume_usd: {
        m5: string;
        m15: string;
        m30: string;
        h1: string;
        h6: string;
        h24: string;
      };
      reserve_in_usd: string;
    };
    relationships: {
      base_token: {
        data: {
          id: string;
          type: string;
        };
      };
      quote_token: {
        data: {
          id: string;
          type: string;
        };
      };
      dex: {
        data: {
          id: string;
          type: string;
        };
      };
    };
  }>;
  included: Array<{
    id: string;
    type: string;
    attributes: {
      address: string;
      name: string;
      symbol: string;
      decimals: number;
      image_url: string;
      coingecko_coin_id: string;
    };
  }>;
};

const app = new Hono().get(
  "/",
  validate("query", searchQuerySchema),
  async (c) => {
    try {
      // TODO: handle undefined q
      const { q = "" } = c.req.valid("query");

      const cgEnpoint = cg.getOnchainEndpoint("/search/pools");
      cgEnpoint.search = new URLSearchParams({
        query: q,
        network: "solana",
        include: "base_token,quote_token,dex",
      }).toString();

      const req = new Request(cgEnpoint, {
        method: "GET",
        headers: cg.getRequiredHeaders(),
      });

      const resp = await fetch(req);

      if (!resp.ok) {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }
      const res: CG_SearchPools = await resp.json();

      return c.json(res, statusCode.Ok);
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  },
);

export default app;
