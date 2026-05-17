import { solanaBase58Schema, validate } from "@sv/middlewares/validation";
import { getWalletBalanceHistory } from "@sv/services/wallet/walletCharts.service";
import { getWalletTokenBalanceHistory } from "@sv/services/wallet/walletTokenBalance.service";
import { serverErr, setErr } from "@sv/util/errors";
import { statusCode } from "@sv/util/responses";
import { Hono } from "hono";
import { z } from "zod";

const balanceHistoryQuerySchema = z.object({
  timePeriod: z.enum(["7D", "30D", "60D", "90D", "1Y", "All"]).optional(),
  wallets: z
    .string()
    .transform((v) => v.split(","))
    .pipe(solanaBase58Schema.array()),
});

const tokenBalanceHistoryQuerySchema = z.object({
  timePeriod: z.enum(["7D", "30D", "60D", "90D", "1Y", "All"]).optional(),
  wallet: solanaBase58Schema,
  tokens: z
    .string()
    .transform((v) => v.split(","))
    .pipe(solanaBase58Schema.array()),
});

const app = new Hono()
  .get("/", validate("query", balanceHistoryQuerySchema), async (c) => {
    try {
      const { wallets, timePeriod } = c.req.valid("query");

      const res: Record<
        string,
        Awaited<ReturnType<typeof getWalletBalanceHistory>>
      > = {};
      // Seq fetch to not exceed rate lim
      for (const walletAddress of wallets) {
        res[walletAddress] = await getWalletBalanceHistory(
          walletAddress,
          timePeriod,
        );
      }

      return c.json(res, statusCode.Ok);
    } catch (e) {
      return serverErr(c, e);
    }
  })
  .get(
    "/tokens",
    validate("query", tokenBalanceHistoryQuerySchema),
    async (c) => {
      try {
        const { wallet, tokens, timePeriod } = c.req.valid("query");

        const res = await getWalletTokenBalanceHistory(
          wallet,
          tokens,
          timePeriod,
        );

        if (!res) {
          return c.json(setErr("BAD_GATEWAY"), statusCode.BadGateway);
        }

        return c.json(res, statusCode.Ok);
      } catch (e) {
        console.log("error getting : ", e);
        return serverErr(c, e);
      }
    },
  );

export default app;
