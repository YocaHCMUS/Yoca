import { setErr } from "@sv/config/errors.js";
import { searchQuerySchema, validate } from "@sv/middlewares/validation.js";
import { getAddressesByCoinGeckoIds } from "@sv/services/tokens/token-list.js";
import { getTokenMarketData } from "@sv/services/tokens/token-market-data.js";
import * as bds from "@sv/util/util-birdeye.js";
import { statusCode } from "@sv/util/responses.js";
import * as cg from "@sv/util/util-coingecko.js";
import { Hono } from "hono";
import z from "zod";

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

type WalletSearchResult = {
  address: string;
  label: string | null;
};

const SOLANA_BASE58_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const bdsWalletSearchSchema = z.object({
  data: z
    .object({
      meta: z
        .object({
          address: z.string().trim().min(1),
        })
        .partial()
        .optional(),
    })
    .partial()
    .optional(),
});

function isLikelySolanaWalletAddress(query: string) {
  return SOLANA_BASE58_ADDRESS_REGEX.test(query);
}

function extractSolanaWalletAddress(input: string): string | null {
  const trimmed = input.trim();
  if (isLikelySolanaWalletAddress(trimmed)) {
    return trimmed;
  }

  const matched = trimmed.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (!matched) {
    return null;
  }

  return isLikelySolanaWalletAddress(matched[0]) ? matched[0] : null;
}

async function getSearchWalletsResult(query: string): Promise<WalletSearchResult[]> {
  const walletAddress = extractSolanaWalletAddress(query);
  if (!walletAddress) {
    return [];
  }

  try {
    const endpoint = bds.getEndpoint("/wallet/v2/pnl/details");
    const req = new Request(endpoint, {
      method: "POST",
      headers: bds.getRequiredHeaders(),
      body: JSON.stringify({
        duration: "all",
        sort_type: "desc",
        sort_by: "last_trade",
        limit: 1,
        wallet: walletAddress,
      }),
    });

    const resp = await fetch(req);
    if (!resp.ok) {
      return [{ address: walletAddress, label: null }];
    }

    const raw = await resp.json();
    const parsed = bdsWalletSearchSchema.safeParse(raw);
    if (!parsed.success) {
      return [{ address: walletAddress, label: null }];
    }

    const address = parsed.data.data?.meta?.address?.trim();
    if (!address || !isLikelySolanaWalletAddress(address)) {
      return [{ address: walletAddress, label: null }];
    }

    return [{ address, label: null }];
  } catch {
    return [{ address: walletAddress, label: null }];
  }
}

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
      const normalizedQuery = q.trim();
      const searchQuery = normalizedQuery.toLowerCase();

      if (!normalizedQuery) {
        return c.json(
          {
            tokens: [],
            pools: [],
            wallets: [],
          },
          statusCode.Ok,
        );
      }

      const [poolSearch, queriesSearch, wallets] = await Promise.all([
        getSearchPoolsResult(searchQuery),
        getSearchQueriesResult(searchQuery),
        getSearchWalletsResult(normalizedQuery),
      ]);

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
          wallets,
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
