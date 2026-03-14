import { setErr } from "@sv/config/errors.js";
import { searchQuerySchema, validate } from "@sv/middlewares/validation.js";
import { getAddressesByCoinGeckoIds } from "@sv/services/tokens/token-list.js";
import { getTokenMarketData } from "@sv/services/tokens/token-market-data.js";
import { statusCode } from "@sv/util/responses.js";
import * as cg from "@sv/util/util-coingecko.js";
import { Hono } from "hono";

async function getSearchPoolsResult(q: string) {
  const res = await cg.client.onchain.search.pools.get({
    query: q,
    network: "solana",
    include: "base_token,quote_token,dex",
  });

  const pools = res.data!;
  const quoteTokens = pools.map(
    (pool) => pool.relationships!.quote_token!.data!.id,
  );

  const tokens = res
    .included!.filter((raw) => raw.type == "token")
    .filter(
      (token) =>
        token.attributes!.coingecko_coin_id != null &&
        !quoteTokens.includes(token.id),
    );

  return {
    tokens,
    pools,
  };
}

async function getSearchQueriesResult(q: string) {
  const res = await cg.client.search.get({
    query: q,
  });

  return res.coins;
}

const app = new Hono().get(
  "/",
  validate("query", searchQuerySchema),
  async (c) => {
    try {
      // TODO: handle undefined q
      const { q = "" } = c.req.valid("query");

      const poolSearch = await getSearchPoolsResult(q);
      const queriesSearch = await getSearchQueriesResult(q);

      if (poolSearch == null || queriesSearch == null) {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }

      type Token = {
        address: string;
        imgUrl: string | null;
      };

      const tokenList: Array<Token> = [];

      poolSearch.tokens.forEach((token) => {
        tokenList.push({
          address: token.attributes!.address!,
          imgUrl: token.attributes!.image_url || null,
        });
      });

      const cgIdToAddress = await getAddressesByCoinGeckoIds(
        queriesSearch.map((token) => token.id!),
      );

      queriesSearch.forEach((token) => {
        const address = cgIdToAddress[token.id!];
        if (address) {
          tokenList.push({
            address,
            imgUrl: token.thumb || null,
          });
        }
      });

      let tokenAddresses = tokenList.map((token) => token.address);
      const marketData = await getTokenMarketData(tokenAddresses);
      tokenAddresses = tokenAddresses.filter((address) => marketData[address]);
      const addressToTokenImg = Object.fromEntries(
        tokenList.map((token) => [token.address, token.imgUrl]),
      );

      const tokens = tokenAddresses.map((address) => ({
        ...marketData[address],
        imgUrl: addressToTokenImg[address],
      }));

      return c.json(
        {
          tokens,
          pools: poolSearch.pools,
        },
        statusCode.Ok,
      );
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
