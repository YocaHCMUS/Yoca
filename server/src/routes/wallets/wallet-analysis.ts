import { Hono } from "hono";
import { z } from "zod";
import {
  getPnLData,
  getWinrateData,
} from "@sv/services/wallet/wallet-analysis.js";
import { solanaBase58Schema, validate } from "@sv/middlewares/validation";
import { serverErr } from "@sv/util/errors";
import { statusCode } from "@sv/util/responses";

const MAX_ANALYSIS_WALLETS = 5;

const winrateRequestSchema = z.object({
  period: z.enum(["24H", "7D", "30D", "90D"]).optional().default("30D"),
  wallets: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : []))
    .pipe(solanaBase58Schema.array()),
});

const pnlRequestSchema = z.object({
  period: z.enum(["7D", "30D"]).optional().default("30D"),
  wallets: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : []))
    .pipe(solanaBase58Schema.array()),
});

const app = new Hono()
  .get("/winrate", validate("query", winrateRequestSchema), async (c) => {
    try {
      const { wallets, period } = c.req.valid("query");

      const data = await getWinrateData(wallets, period);

      return c.json(
        {
          wallets: data,
        },
        statusCode.Ok,
      );
    } catch (e) {
      return serverErr(c, e);
    }
  })
  .get("/pnl", validate("query", pnlRequestSchema), async (c) => {
    try {
      const { wallets, period } = c.req.valid("query");

      if (wallets.length > MAX_ANALYSIS_WALLETS) {
        return c.json(
          {
            error: "Validation error",
            message: `wallets exceeds max allowed (${MAX_ANALYSIS_WALLETS})`,
          },
          400,
        );
      }

      const data = await getPnLData(wallets, period);

      return c.json(
        {
          wallets: data.map((wallet) => ({
            walletAddress: wallet.walletAddress,
            walletName: wallet.walletName,
            dailyPnL: wallet.dailyPnL,
            cumulativePnL: wallet.cumulativePnL,
            startBalance: 0,
            endBalance: 0,
            realizedPnL: wallet.realizedPnL,
            totalPnL: wallet.totalPnL,
            unrealizedPnL: wallet.unrealizedPnL,
          })),
        },
        statusCode.Ok,
      );
    } catch (e) {
      return serverErr(c, e);
    }
  });

export default app;
