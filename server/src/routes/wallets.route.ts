import { setErr } from "@sv/config/errors.js";
import {
  addressSchema,
  validate,
  walletTokenSwapSchema,
} from "@sv/middlewares/validation.js";
import { getWalletCounterparties } from "@sv/services/wallet/counterparties.service.js";
import type { WalletPortfolioItem } from "@sv/services/wallet/dtos/walletDataObjects.js";
import * as walletService from "@sv/services/wallet/index.js";
import {
  fetchTestTransaction,
  getWalletExchangeCounts,
  getWalletOverview,
  getWalletPortfolio,
  getWalletSwaps,
  getWalletTransfers,
} from "@sv/services/wallet/walletData.service.js";
import {
  WALLET_IDENTITY_MAX_BATCH_SIZE,
  WalletIdentityServiceError,
  getWalletIdentity,
  getWalletIdentityBatch,
} from "@sv/services/wallet/walletIdentity.service.js";
import { composeWalletIntelligence } from "@sv/services/wallet/walletIntelligence.service.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import { z } from "zod";

const router = new Hono();

const walletRequestSchema = z.object({
  address: z.string(),
});

const walletOverviewRequestSchema = walletRequestSchema.extend({
  period: z.string().optional(),
});

const walletCounterpartyRequestSchema = walletRequestSchema.extend({
  period: z.string().optional(),
  limit: z.string().optional(),
  includeTokens: z.string().optional(),
});

const walletIdentityBatchRequestSchema = z.object({
  addresses: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(WALLET_IDENTITY_MAX_BATCH_SIZE),
});

const DEFAULT_OVERVIEW_PERIOD_SEC = 24 * 60 * 60;
const MIN_OVERVIEW_PERIOD_SEC = 24 * 60 * 60;
const MAX_OVERVIEW_PERIOD_SEC = 7 * 24 * 60 * 60;

const DEFAULT_COUNTERPARTY_PERIOD = "7d";
const DEFAULT_COUNTERPARTY_LIMIT = 20;
const MAX_COUNTERPARTY_LIMIT = 100;
const MAX_EXCHANGE_LIMIT = 5000;

function parseOverviewPeriodSec(rawPeriod?: string): {
  periodSec: number;
  normalized: boolean;
} {
  if (!rawPeriod) {
    return { periodSec: DEFAULT_OVERVIEW_PERIOD_SEC, normalized: false };
  }

  const trimmed = rawPeriod.trim().toLowerCase();
  if (!trimmed) {
    return { periodSec: DEFAULT_OVERVIEW_PERIOD_SEC, normalized: false };
  }

  const explicitUnitMatch = trimmed.match(/^(\d+)\s*([hd])$/);
  const dayOnlyMatch = trimmed.match(/^(\d+)$/);

  let periodSec: number | null = null;
  if (explicitUnitMatch) {
    const amount = Number(explicitUnitMatch[1]);
    const unit = explicitUnitMatch[2];
    periodSec = unit === "h" ? amount * 60 * 60 : amount * 24 * 60 * 60;
  } else if (dayOnlyMatch) {
    periodSec = Number(dayOnlyMatch[1]) * 24 * 60 * 60;
  }

  if (
    periodSec == null ||
    !Number.isFinite(periodSec) ||
    periodSec < MIN_OVERVIEW_PERIOD_SEC ||
    periodSec > MAX_OVERVIEW_PERIOD_SEC
  ) {
    return { periodSec: DEFAULT_OVERVIEW_PERIOD_SEC, normalized: true };
  }

  return { periodSec, normalized: false };
}

function mapWalletIdentityError(err: WalletIdentityServiceError): {
  status: 400 | 401 | 502 | 503;
  error: string;
} {
  if (err.code === "invalid_address") {
    return { status: 400, error: "Invalid wallet address format" };
  }

  if (err.code === "invalid_batch") {
    return { status: 400, error: "Invalid identity batch payload" };
  }

  if (err.code === "provider_unauthorized") {
    return {
      status: 401,
      error: "Wallet identity provider authorization failed",
    };
  }

  if (
    err.code === "provider_rate_limited" ||
    err.code === "provider_unavailable"
  ) {
    return { status: 503, error: "Wallet identity provider is unavailable" };
  }

  if (err.code === "provider_bad_request") {
    return {
      status: 400,
      error: "Invalid request for wallet identity provider",
    };
  }

  const fallbackStatus: 400 | 401 | 502 | 503 =
    err.statusCode === 400
      ? 400
      : err.statusCode === 401
        ? 401
        : err.statusCode === 503
          ? 503
          : 502;

  return {
    status: fallbackStatus,
    error: "Failed to fetch wallet identity",
  };
}

function parseCounterpartyPeriod(rawPeriod?: string): "24h" | "7d" {
  const normalized = String(rawPeriod ?? "")
    .trim()
    .toLowerCase();
  return normalized === "24h"
    ? "24h"
    : normalized === "7d"
      ? "7d"
      : DEFAULT_COUNTERPARTY_PERIOD;
}

function parseCounterpartyLimit(rawLimit?: string): number {
  const parsed = Number(rawLimit ?? DEFAULT_COUNTERPARTY_LIMIT);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_COUNTERPARTY_LIMIT;
  }

  const integerLimit = Math.floor(parsed);
  if (integerLimit < 1) {
    return 1;
  }

  if (integerLimit > MAX_COUNTERPARTY_LIMIT) {
    return MAX_COUNTERPARTY_LIMIT;
  }

  return integerLimit;
}

function parseCounterpartyIncludeTokens(rawIncludeTokens?: string): boolean {
  if (rawIncludeTokens == null) {
    return true;
  }

  const normalized = rawIncludeTokens.trim().toLowerCase();
  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return true;
}

function parseExchangeLimit(rawLimit?: string): number | undefined {
  if (rawLimit == null) {
    return undefined;
  }

  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const integerLimit = Math.floor(parsed);
  if (integerLimit < 1) {
    return 1;
  }

  return Math.min(integerLimit, MAX_EXCHANGE_LIMIT);
}

const routes = router
  .get("/overview", async (c) => {
    const query = c.req.query();
    const params = walletOverviewRequestSchema.parse(query);
    const address = params.address;
    const { periodSec, normalized } = parseOverviewPeriodSec(params.period);

    if (normalized && params.period) {
      console.warn(
        "[wallet-overview-route] Unsupported period normalized to 24h",
        {
          address,
          requestedPeriod: params.period,
        },
      );
    }

    try {
      const overview = await getWalletOverview(address, { periodSec });
      return c.json(overview);
    } catch (err) {
      console.error("Failed to get wallet overview", err);
      return c.json({ error: "Failed to get wallet overview" }, 500);
    }
  })
  .get("/portfolio", async (c) => {
    const query = c.req.query();
    const params = walletRequestSchema.parse(query);
    const address = params.address;

    try {
      const portfolio = await getWalletPortfolio(address);
      return c.json(portfolio);
    } catch (err) {
      console.error("Failed to get wallet portfolio", err);
      return c.json({ error: "Failed to get wallet portfolio" }, 500);
    }
  })
  .get("/swap", async (c) => {
    const query = c.req.query();
    const params = walletRequestSchema.parse(query);
    const address = params.address;

    const limitParam = c.req.query("limit");
    const cursor = c.req.query("cursor");
    const before = c.req.query("before");

    const limit = limitParam ? Number(limitParam) : undefined;

    try {
      const txs = await getWalletSwaps(address, {
        limit: Number.isFinite(limit) ? limit : undefined,
        cursor: cursor ?? undefined,
        before: before ?? undefined,
      });

      return c.json(txs);
    } catch (err) {
      console.error("Failed to get wallet swaps", err);
      return c.json({ error: "Failed to get wallet swaps" }, 500);
    }
  })
  .get(
    "/:walletAddress/swaps/:tokenAddress",
    validate("param", walletTokenSwapSchema),
    async (c) => {
      const { walletAddress, tokenAddress } = c.req.valid("param");

      try {
        const swaps = await walletService.getWalletTokenSwaps(
          walletAddress,
          tokenAddress,
        );

        if (!swaps) {
          return c.json(swaps, statusCode.BadGateway);
        }
        return c.json(swaps, statusCode.Ok);
      } catch (err) {
        console.error("Failed to get wallet swaps", err);
        return c.json({ error: "Failed to get wallet swaps" }, 500);
      }
    },
  )
  .get("/transfers", async (c) => {
    const query = c.req.query();
    const params = walletRequestSchema.parse(query);
    const address = params.address;

    const limitParam = c.req.query("limit");
    const cursor = c.req.query("cursor");
    const before = c.req.query("before");

    const limit = limitParam ? Number(limitParam) : undefined;

    try {
      const txs = await getWalletTransfers(address, {
        limit: Number.isFinite(limit) ? limit : undefined,
        cursor: cursor ?? undefined,
        before: before ?? undefined,
      });

      return c.json(txs);
    } catch (err) {
      console.error("Failed to get wallet transfers", err);
      return c.json({ error: "Failed to get wallet transfers" }, 500);
    }
  })
  .get("/distribution", async (c) => {
    const query = c.req.query();
    const params = walletRequestSchema.parse(query);
    const address = params.address;

    try {
      // Get portfolio data which forms the asset distribution
      const portfolio = await getWalletPortfolio(address);

      // Transform portfolio data into distribution format
      // Calculate percentages based on total value
      const totalValue = portfolio.reduce(
        (sum: number, item: WalletPortfolioItem) => sum + (item.valueUsd ?? 0),
        0,
      );

      const distributionData = portfolio.map((item: WalletPortfolioItem) => ({
        name: item.symbol || item.name || item.tokenAddress || "Unknown",
        value: item.valueUsd ?? 0,
        percentage:
          totalValue > 0 ? ((item.valueUsd ?? 0) / totalValue) * 100 : 0,
        rawAmount: item.amount ?? 0,
        tokenAddress: item.tokenAddress ?? "",
        symbol: item.symbol ?? "",
        logoUri: item.logoUri ?? undefined,
      }));

      return c.json({
        data: distributionData,
        totalValue: totalValue,
        address: address,
        metadata: {
          currency: "USD",
          timestamp: Date.now(),
        },
      });
    } catch (err) {
      console.error("Failed to get wallet asset distribution", err);
      return c.json({ error: "Failed to get wallet asset distribution" }, 500);
    }
  })
  .get("/exchanges", async (c) => {
    const query = c.req.query();
    const params = walletRequestSchema.parse(query);
    const address = params.address;
    const period = c.req.query("period") ?? undefined;
    const chain = c.req.query("chain") ?? undefined;
    const limitParam = c.req.query("limit");
    const limit = parseExchangeLimit(limitParam);

    try {
      const data = await getWalletExchangeCounts(address, {
        period,
        chain,
        limit,
      });
      return c.json(data);
    } catch (err) {
      console.error("Failed to get wallet exchange counts", err);
      return c.json({ error: "Failed to get wallet exchange counts" }, 500);
    }
  })
  .get("/counterparties", async (c) => {
    const query = c.req.query();
    const parsed = walletCounterpartyRequestSchema.safeParse(query);

    if (!parsed.success) {
      return c.json(
        { error: "Missing or invalid required query param: address" },
        400,
      );
    }

    const address = parsed.data.address;
    const period = parseCounterpartyPeriod(parsed.data.period);
    const limit = parseCounterpartyLimit(parsed.data.limit);
    const includeTokens = parseCounterpartyIncludeTokens(
      parsed.data.includeTokens,
    );

    try {
      const counterparties = await getWalletCounterparties(address, {
        period,
        limit,
        includeTokens,
      });
      return c.json(counterparties);
    } catch (err) {
      console.error("Failed to get wallet counterparties", err);
      return c.json({ error: "Failed to get wallet counterparties" }, 500);
    }
  })
  .get("/identity", async (c) => {
    const address = c.req.query("address");

    if (!address) {
      return c.json({ error: "Missing required query param: address" }, 400);
    }

    try {
      const identity = await getWalletIdentity(address);
      return c.json(identity, 200);
    } catch (err) {
      if (err instanceof WalletIdentityServiceError) {
        const mapped = mapWalletIdentityError(err);
        return c.json({ error: mapped.error, code: err.code }, mapped.status);
      }

      console.error("Failed to fetch wallet identity", err);
      return c.json({ error: "Failed to fetch wallet identity" }, 500);
    }
  })
  .post("/identity/batch", async (c) => {
    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON payload" }, 400);
    }

    const parsed = walletIdentityBatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid identity batch payload" }, 400);
    }

    try {
      const identityBatch = await getWalletIdentityBatch(parsed.data.addresses);
      return c.json(identityBatch, 200);
    } catch (err) {
      if (err instanceof WalletIdentityServiceError) {
        const mapped = mapWalletIdentityError(err);
        return c.json({ error: mapped.error, code: err.code }, mapped.status);
      }

      console.error("Failed to fetch wallet identity batch", err);
      return c.json({ error: "Failed to fetch wallet identity batch" }, 500);
    }
  })
  .get("/intelligence", async (c) => {
    const address = c.req.query("address");

    if (!address) {
      return c.json({ error: "Missing required query param: address" }, 400);
    }

    try {
      const intelligence = await composeWalletIntelligence(address);
      return c.json(intelligence, 200);
    } catch (err) {
      if (err instanceof WalletIdentityServiceError) {
        const mapped = mapWalletIdentityError(err);
        return c.json({ error: mapped.error, code: err.code }, mapped.status);
      }

      console.error("Failed to compose wallet intelligence", err);
      return c.json({ error: "Failed to compose wallet intelligence" }, 500);
    }
  })
  .get("/debug/test-transactions", async (c) => {
    const address = c.req.query("address");

    if (!address) {
      return c.json({ error: "Missing required query param: address" }, 400);
    }

    try {
      const data = await fetchTestTransaction(address);
      return c.json({ address, data });
    } catch (err) {
      console.error("Failed to fetch test transactions", err);
      return c.json({ error: "Failed to fetch test transactions" }, 500);
    }
  })
  .get("/first-funds/:address", validate("param", addressSchema), async (c) => {
    try {
      const { address } = c.req.valid("param");
      const firstFunds = await walletService.getWalletFirstFund(address);
      if (firstFunds == null) {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }

      return c.json(firstFunds, 200);
    } catch (err) {
      console.log(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .get("/:address/tokens", validate("param", addressSchema), async (c) => {
    try {
      const { address } = c.req.valid("param");
      const tokenDetails = await walletService.getTokenDetails(address);
      if (tokenDetails == null) {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }

      return c.json(tokenDetails, 200);
    } catch (err) {
      console.log(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  });

export default routes;
