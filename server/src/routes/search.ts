import { setErr } from "@sv/config/errors.js";
import { searchQuerySchema, validate } from "@sv/middlewares/validation.js";
import { getAddressesByCoinGeckoIds } from "@sv/services/tokens/token-list.js";
import { getTokenMarketData } from "@sv/services/tokens/token-market-data.js";
import { statusCode } from "@sv/util/responses.js";
import * as cg from "@sv/util/util-coingecko.js";
import { Hono } from "hono";

function trimIdPrefix(
  id: string | null | undefined,
  prefix: string = "solana_",
): string {
  if (!id) return "";
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

type TokenQuickMeta = {
  address: string;
  name: string | null;
  symbol: string | null;
  imgUrl: string | null;
};

async function getSearchPoolsResult(q: string) {
  const res = await cg.client.onchain.search.pools.get({
    query: q,
    network: "solana",
    include: "base_token,quote_token",
  });

  const poolTokens = Object.fromEntries(
    res
      .included!.filter((raw) => raw.type == "token")
      .filter((token) => token.attributes!.coingecko_coin_id)
      .map((token): [string, TokenQuickMeta] => {
        const address = token.attributes?.address!;
        return [
          address,
          {
            address: address,
            symbol: token.attributes?.symbol || null,
            name: token.attributes?.name || null,
            imgUrl: token.attributes?.image_url || null,
          },
        ];
      }),
  );

  const pools = res.data!.filter((pool) => {
    const address = trimIdPrefix(pool.relationships?.base_token?.data?.id);
    return poolTokens[address];
  });

  return {
    pools,
    poolTokens,
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
      const { q = "" } = c.req.valid("query");
      const searchQuery = q.toLowerCase().trim();

      if (!searchQuery) {
        return c.json(
          {
            tokens: [],
            pools: [],
          },
          statusCode.Ok,
        );
      }

      const poolSearch = await getSearchPoolsResult(searchQuery);
      const queriesSearch = await getSearchQueriesResult(searchQuery);

      if (!poolSearch || queriesSearch == undefined) {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }

      const cgIdToSolanaAddress = await getAddressesByCoinGeckoIds(
        queriesSearch.map((token) => token.id!),
      );

      const tokenResultMeta = queriesSearch
        // Maybe not on Solana chain
        .filter((token) => cgIdToSolanaAddress[token.id!])
        .map((token): TokenQuickMeta => {
          return {
            address: cgIdToSolanaAddress[token.id!],
            name: token.name || null,
            symbol: token.symbol || null,
            imgUrl: token.thumb || null,
          };
        });

      const tokenAddresses = tokenResultMeta.map((token) => token.address);
      const marketData = await getTokenMarketData(tokenAddresses);

      const tokenDataList = tokenResultMeta.map((token) => ({
        ...marketData[token.address],
        ...token,
      }));

      const pools = poolSearch.pools.map((pool) => {
        const baseTokenId = trimIdPrefix(
          pool.relationships?.base_token?.data?.id,
        );
        const quoteTokenId = trimIdPrefix(
          pool.relationships?.quote_token?.data?.id,
        );

        return {
          ...pool,
          baseTokenImg: baseTokenId
            ? poolSearch.poolTokens[baseTokenId]?.imgUrl
            : null,
          quoteTokenImg: quoteTokenId
            ? poolSearch.poolTokens[quoteTokenId]?.imgUrl
            : null,
        };
      });

      return c.json(
        {
          tokens: tokenDataList,
          pools,
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
