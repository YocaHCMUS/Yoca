import { setErr } from "@sv/config/errors.js";
import { searchQuerySchema, validate } from "@sv/middlewares/validation.js";
import { getTokenMetaList } from "@sv/services/tokens/token-info.js";
import { getAddressesByCoinGeckoId } from "@sv/services/tokens/token-list.js";
import { getTokenMarketData } from "@sv/services/tokens/token-market-data.js";
import { statusCode } from "@sv/util/responses.js";
import * as cg from "@sv/util/util-coingecko.js";
import { Hono } from "hono";

async function getSearchPoolsResult(q: string) {
  const res = await cg.client.onchain.search.pools.get({
    query: q,
    network: "solana",
    include: "base_token,quote_token",
  });

  const pools = res.data!;
  const quoteTokens = pools.map(
    (pool) => pool.relationships!.quote_token!.data!.id,
  );

  const tokens = res
    .included!.filter((raw) => raw.type == "token")
    .filter((token) => token.attributes!.coingecko_coin_id != null);

  return {
    tokens,
    pools,
    included: res.included,
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

      const searchQ = q.toLowerCase();
      poolSearch.tokens.forEach((token) => {
        const symbol = token.attributes?.symbol?.toLowerCase() || "";
        const name = token.attributes?.name?.toLowerCase() || "";
        const address = token.attributes?.address?.toLowerCase() || "";

        // Only add token to the main list if it actually matches the query
        // This prevents quote tokens (USDC, SOL) from cluttering results for "pengu"
        if (
          symbol.includes(searchQ) ||
          name.includes(searchQ) ||
          address === searchQ
        ) {
          tokenList.push({
            address: token.attributes!.address!,
            imgUrl: token.attributes!.image_url || null,
          });
        }
      });

      const cgIdToAddress = await getAddressesByCoinGeckoId(
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

      let tokenAddresses = [...new Set(tokenList.map((token) => token.address))];
      const [marketData, metaData] = await Promise.all([
        getTokenMarketData(tokenAddresses),
        getTokenMetaList(tokenAddresses),
      ]);

      // tokenAddresses = tokenAddresses.filter((address) => marketData[address]);
      const addressToTokenImg = Object.fromEntries(
        tokenList.map((token) => [token.address, token.imgUrl]),
      );
      const addressToMeta = Object.fromEntries(
        metaData.map((m: any) => [m.address, m]),
      );

      const tokens = tokenAddresses.map((address) => ({
        ...marketData[address],
        name: addressToMeta[address]?.name || "",
        symbol: addressToMeta[address]?.symbol || "",
        imgUrl: addressToTokenImg[address] || addressToMeta[address]?.imageUrl,
        description: addressToMeta[address]?.description || "",
        sparkline7d: marketData[address]?.sparkline7d || null,
      }));

      const addressToIncludedToken = Object.fromEntries(
        (poolSearch.included || [])
          .filter((item) => item.type === "token")
          .map((item) => [item.id, item]),
      );

      const pools = poolSearch.pools.map((pool) => {
        const baseTokenId = pool.relationships?.base_token?.data?.id;
        const quoteTokenId = pool.relationships?.quote_token?.data?.id;

        return {
          ...pool,
          baseTokenImg: baseTokenId
            ? (addressToIncludedToken[baseTokenId]?.attributes as any)
              ?.image_url
            : null,
          quoteTokenImg: quoteTokenId
            ? (addressToIncludedToken[quoteTokenId]?.attributes as any)
              ?.image_url
            : null,
        };
      });

      return c.json(
        {
          tokens,
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
