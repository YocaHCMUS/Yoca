import { searchQuerySchema, validate } from "@sv/middlewares/validation.js";
import { getSearchResult } from "@sv/services/search.js";
import { serverErr } from "@sv/util/errors";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import * as bds from "@sv/util/util-birdeye";
import * as cg from "@sv/util/util-coingecko";
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

async function getSearchWalletsResult(
  query: string,
): Promise<WalletSearchResult[]> {
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
