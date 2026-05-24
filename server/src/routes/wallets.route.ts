import {
    addressSchema,
    solanaBase58Schema,
    validate,
    walletTokenTradesSchema,
} from "@sv/middlewares/validation.js";
import type {
    WalletPortfolioItem,
    WalletSwap,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import {
    getTokenDetails,
    getWalletFirstFund,
} from "@sv/services/wallet/index.js";
import {
    getWalletDayActivitySummary,
    getWalletTxDetail,
    getWalletTxInstructionDetail,
} from "@sv/services/wallet/walletDayActivity.service.js";
import { getTokenPriceChartForDay } from "@sv/services/tokens/token-chart.js";
import { getWalletOverview } from "@sv/services/wallet/walletOverview.service.js";
import { getWalletPortfolio } from "@sv/services/wallet/walletPortfolio.service.js";
import {
    getWalletSwaps,
    getWalletTransfers,
} from "@sv/services/wallet/walletTransfersSwaps.service.js";
import {
    WALLET_IDENTITY_MAX_BATCH_SIZE,
    WalletIdentityServiceError,
    getWalletIdentity,
    getWalletIdentityBatch,
} from "@sv/services/wallet/walletIdentity.service.js";
import { composeWalletIntelligence } from "@sv/services/wallet/walletIntelligence.service.js";
import {
    WalletAnalysisServiceError,
    getWalletAiAnalysis,
} from "@sv/services/wallet/walletAnalysis.service.js";
import {
    WalletAuditServiceError,
    getWalletAudit,
} from "@sv/services/wallet/walletAudit.service.js";
import { statusCode } from "@sv/util/responses.js";
import { z } from "zod";
import { Hono } from "hono";
import { serverErr, setErr } from "@sv/util/errors";

const walletQuerySchema = z.object({
  address: solanaBase58Schema,
});

const walletOverviewQuerySchema = z.object({
  address: solanaBase58Schema,
  period: z
    .enum(["24H", "7D", "30D", "60D", "90D", "1Y", "All"])
    .default("24H"),
});

const walletIdentityQuerySchema = z.object({
  address: solanaBase58Schema,
});

const walletIdentityBatchSchema = z.object({
  addresses: z
    .array(solanaBase58Schema)
    .min(1)
    .max(WALLET_IDENTITY_MAX_BATCH_SIZE),
});

const walletAnalysisBodySchema = z.object({
  address: solanaBase58Schema,
  language: z.enum(["en", "vn"]).optional(),
});

const walletIntelligenceQuerySchema = z.object({
  address: solanaBase58Schema,
});

const walletDayActivityQuerySchema = z.object({
  address: solanaBase58Schema,
  dayMs: z.coerce.number(),
});

const walletTxDetailQuerySchema = z.object({
  address: solanaBase58Schema,
  signature: z.string().trim().min(1),
});

const walletTxInstructionsQuerySchema = z.object({
  address: solanaBase58Schema,
  signature: z.string().trim().min(1),
});

const walletTokenPriceChartQuerySchema = z.object({
  address: solanaBase58Schema,
  dayMs: z.coerce.number(),
});

const walletAuditQuerySchema = z.object({
  force: z.enum(["0", "1", "true", "false"]),
});

function mapWalletIdentityError(err: WalletIdentityServiceError): {
  status: 400 | 401 | 502 | 503;
  error: string;
} {
  if (err.code == "invalid_address") {
    return { status: 400, error: "Invalid wallet address format" };
  }

  if (err.code == "invalid_batch") {
    return { status: 400, error: "Invalid identity batch payload" };
  }

  if (err.code == "provider_unauthorized") {
    return {
      status: 401,
      error: "Wallet identity provider authorization failed",
    };
  }

  if (
    err.code == "provider_rate_limited" ||
    err.code == "provider_unavailable"
  ) {
    return { status: 503, error: "Wallet identity provider is unavailable" };
  }

  if (err.code == "provider_bad_request") {
    return {
      status: 400,
      error: "Invalid request for wallet identity provider",
    };
  }

  const fallbackStatus: 400 | 401 | 502 | 503 =
    err.statusCode == 400
      ? 400
      : err.statusCode == 401
        ? 401
        : err.statusCode == 503
          ? 503
          : 502;

  return {
    status: fallbackStatus,
    error: "Failed to fetch wallet identity",
  };
}

function mapWalletAnalysisStatus(status: number): 400 | 409 | 502 | 504 {
  if (status == 400) {
    return 400;
  }

  if (status == 409) {
    return 409;
  }

  if (status == 504) {
    return 504;
  }

  return 502;
}

function mapSwapToTokenTradeRow(
  swap: WalletSwap,
  walletAddress: string,
  tokenAddress: string,
) {
  const normalizedToken = tokenAddress.trim().toLowerCase();
  const boughtAddress = swap.bought.address.trim().toLowerCase();
  const soldAddress = swap.sold.address.trim().toLowerCase();

  const inferredAction: "buy" | "sell" =
    boughtAddress == normalizedToken
      ? "buy"
      : soldAddress == normalizedToken
        ? "sell"
        : swap.transactionType.trim().toLowerCase() == "buy"
          ? "buy"
          : "sell";

  const selectedAmount =
    inferredAction == "buy" ? swap.bought.amount : swap.sold.amount;
  const selectedTokenAddress =
    inferredAction == "buy" ? swap.bought.address : swap.sold.address;
  const otherTokenAddress =
    inferredAction == "buy" ? swap.sold.address : swap.bought.address;
  const selectedPrice =
    inferredAction == "buy" ? swap.bought.priceUsd : swap.sold.priceUsd;
  const otherPrice =
    inferredAction == "buy" ? swap.sold.priceUsd : swap.bought.priceUsd;

  return {
    address: walletAddress,
    tokenAddress,
    transactionHash: swap.transactionHash,
    blockUnixTimeMs: new Date(swap.blockTimestampIso).getTime(),
    baseTokenAddress: selectedTokenAddress,
    quoteTokenAddress: otherTokenAddress,
    baseAmount: selectedAmount,
    quoteAmount: selectedAmount,
    basePrice: selectedPrice,
    quotePrice: otherPrice,
    volumeUsd: swap.totalValueUsd ?? 0,
    poolAddress: swap.pairAddress,
    poolName: null,
    tradeAction: inferredAction,
  };
}

const app = new Hono()
  .get("/overview", validate("query", walletOverviewQuerySchema), async (c) => {
    const { address, period } = c.req.valid("query");

    try {
      const overview = await getWalletOverview(address, { timePeriod: period });
      return c.json(overview);
    } catch (err) {
      console.error("Failed to get wallet overview", err);
      return c.json({ error: "Failed to get wallet overview" }, 500);
    }
  })
  .get("/portfolio", validate("query", walletQuerySchema), async (c) => {
    const { address } = c.req.valid("query");

    try {
      const portfolio = await getWalletPortfolio(address);
      return c.json(portfolio, statusCode.Ok);
    } catch (e) {
            return serverErr(c, e);
    }
  })
  .get("/swap", validate("query", walletQuerySchema), async (c) => {
    const { address } = c.req.valid("query");

    try {
      const txs = await getWalletSwaps(address);
      return c.json(txs);
    } catch (e) {
      return serverErr(c, e);
    }
  })
  .get(
    "/:walletAddress/trades/:tokenAddress",
    validate("param", walletTokenTradesSchema),
    async (c) => {
      const { walletAddress, tokenAddress } = c.req.valid("param");
      const limitParam = c.req.query("limit");
      const cursor = c.req.query("cursor");
      const before = c.req.query("before");
      const limit = limitParam ? Number(limitParam) : undefined;

      try {
        const swaps = await getWalletSwaps(walletAddress);

        const trades = swaps.swaps.map((swap) =>
          mapSwapToTokenTradeRow(swap, walletAddress, tokenAddress),
        );

        if (!trades) {
          return c.json(trades, statusCode.BadGateway);
        }
        return c.json(trades, statusCode.Ok);
      } catch (e) {
      return serverErr(c, e);        
      }
    },
  )
  .get("/transfers", validate("query", walletQuerySchema), async (c) => {
    const { address } = c.req.valid("query");

    try {
      const txs = await getWalletTransfers(address);
      return c.json(txs);
    } catch (e) {
      return serverErr(c, e);
    }
  })
  .get("/distribution", validate("query", walletQuerySchema), async (c) => {
    const { address } = c.req.valid("query");

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
    } catch (e) {
      return serverErr(c, e);
    }
  })

  .get("/identity", validate("query", walletIdentityQuerySchema), async (c) => {
    const { address } = c.req.valid("query");

    try {
      const identity = await getWalletIdentity(address);
      return c.json(identity, statusCode.Ok);
    } catch (e) {
      if (e instanceof WalletIdentityServiceError) {
        const mapped = mapWalletIdentityError(e);
        return c.json({ error: mapped.error, code: e.code }, mapped.status);
      }

      return serverErr(c, e);
    }
  })
  .post(
    "/identity/batch",
    validate("json", walletIdentityBatchSchema),
    async (c) => {
      const data = c.req.valid("json");

      try {
        const identityBatch = await getWalletIdentityBatch(data.addresses);
        return c.json(identityBatch, statusCode.Ok);
      } catch (e) {
        if (e instanceof WalletIdentityServiceError) {
          const mapped = mapWalletIdentityError(e);
          return c.json({ error: mapped.error, code: e.code }, mapped.status);
        }

        return serverErr(c, e);
      }
    },
  )
  .post(
    "/ai-analysis",
    validate("json", walletAnalysisBodySchema),
    async (c) => {
      const data = c.req.valid("json");

      try {
        const analysis = await getWalletAiAnalysis(data.address, data.language);
        return c.json(analysis, statusCode.Ok);
      } catch (e) {
        if (e instanceof WalletAnalysisServiceError) {
          return c.json(
            { error: e.message, code: e.code, details: e.details },
            mapWalletAnalysisStatus(e.status),
          );
        }

        return serverErr(c, e);
      }
    },
  )
  .post("/analysis", validate("json", walletAnalysisBodySchema), async (c) => {
    const data = c.req.valid("json");

    try {
      const analysis = await getWalletAiAnalysis(data.address, data.language);
      return c.json(analysis, statusCode.Ok);
    } catch (e) {
      if (e instanceof WalletAnalysisServiceError) {
        return c.json(
          { error: e.message, code: e.code, details: e.details },
          mapWalletAnalysisStatus(e.status),
        );
      }
      return serverErr(c, e);
    }
  })
  .get(
    "/intelligence",
    validate("query", walletIntelligenceQuerySchema),
    async (c) => {
      const { address } = c.req.valid("query");

      try {
        const intelligence = await composeWalletIntelligence(address);
        return c.json(intelligence, statusCode.Ok);
      } catch (e) {
        if (e instanceof WalletIdentityServiceError) {
          const mapped = mapWalletIdentityError(e);
          return c.json({ error: mapped.error, code: e.code }, mapped.status);
        }
        return serverErr(c, e);
      }
    },
  )
  .get(
    "/day-activity",
    validate("query", walletDayActivityQuerySchema),
    async (c) => {
      const { address, dayMs } = c.req.valid("query");

      try {
        const summary = await getWalletDayActivitySummary(address, dayMs);
        return c.json(summary, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )
  .get(
    "/tx-detail",
    validate("query", walletTxDetailQuerySchema),
    async (c) => {
      const { address, signature } = c.req.valid("query");

      try {
        const detail = await getWalletTxDetail(address, signature);
        return c.json(detail, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )
  .get(
    "/tx-instructions",
    validate("query", walletTxInstructionsQuerySchema),
    async (c) => {
      const { address, signature } = c.req.valid("query");

      try {
        const detail = await getWalletTxInstructionDetail(address, signature);
        return c.json(detail, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )
  .get(
    "/token-price-chart",
    validate("query", walletTokenPriceChartQuerySchema),
    async (c) => {
      const { address, dayMs } = c.req.valid("query");

      try {
        const items = await getTokenPriceChartForDay(address, dayMs);
        return c.json({ items: items ?? [] }, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )
  .get("/first-funds/:address", validate("param", addressSchema), async (c) => {
    const { address } = c.req.valid("param");

    try {
      const firstFunds = await getWalletFirstFund(address);
      if (firstFunds == null) {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }

      return c.json(firstFunds, statusCode.Ok);
    } catch (e) {
        return serverErr(c, e);
    }
  })
  .get("/:address/tokens", validate("param", addressSchema), async (c) => {
    const { address } = c.req.valid("param");

    try {
      const tokenDetails = await getTokenDetails(address);
      if (tokenDetails == null) {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }

      return c.json(tokenDetails, statusCode.Ok);
    } catch (e) {
        return serverErr(c, e);
    }
  })
  /**
   * AI Wallet Forensic Audit.
   *
   * Returns a Gemini-generated behavioural classification (persona, trust
   * score, summary, observations) for the wallet. Result is cached in
   * `wallet_audit_cache` for 24 hours; pass `?force=1` to bypass the cache.
   */
  .get(
    "/:address/audit",
    validate("param", addressSchema),
    validate("query", walletAuditQuerySchema),
    async (c) => {
      const { address } = c.req.valid("param");
      const { force } = c.req.valid("query");

      const shouldForce = force == "1" || force == "true";

      try {
        const audit = await getWalletAudit(address, { force: shouldForce });
        return c.json(audit, statusCode.Ok);
      } catch (e) {
        if (e instanceof WalletAuditServiceError) {
          const statusByCode: Record<
            WalletAuditServiceError["code"],
            400 | 404 | 502 | 503
          > = {
            missing_api_key: 503,
            no_transactions: 404,
            model_error: 502,
            invalid_model_response: 502,
          };
          return c.json(
            { error: e.message, code: e.code },
            statusByCode[e.code],
          );
        }

        console.error("Failed to generate wallet audit", e);
        return serverErr(c, e);
      }
    },
  );

export default app;

export type WalletsAppType = typeof app;
