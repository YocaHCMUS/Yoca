import { Hono } from "hono";
import { z } from "zod";
import { getWinrateData } from "@sv/services/charts/winrate.service.js";
import { solanaBase58Schema, validate } from "@sv/middlewares/validation";
import { serverErr } from "@sv/util/errors";
import { statusCode } from "@sv/util/responses";

const winrateRequestSchema = z.object({
  period: z.enum(["24H", "7D", "30D", "90D"]).optional().default("30D"),
  wallets: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : []))
    .pipe(solanaBase58Schema.array()),
});

const app = new Hono().get(
  "/",
  validate("query", winrateRequestSchema),
  async (c) => {
    try {
      const { wallets, period } = c.req.valid("query");

      const data = await getWinrateData(wallets, period);

      return c.json(data, statusCode.Ok);
    } catch (e) {
      return serverErr(c, e);
    }
  },
);

export default app;
