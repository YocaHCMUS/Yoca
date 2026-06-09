import { Hono } from "hono";
import { z } from "zod";
import { analyzeWashTradingWithAI } from "@sv/services/wash-trading-ai.service.js";
import { washTradingService } from "@sv/services/wash-trading.service.js";

const timeframeSchema = z.enum(["1h", "24h", "7d", "30d"]).default("24h");

const aiAnalyzeBodySchema = z.object({
  mint: z.string().trim().min(32, "Invalid Solana token mint address"),
  symbol: z.string().trim().min(1).max(24).optional().default("TOKEN"),
  timeframe: timeframeSchema.optional().default("24h"),
  limit: z.coerce.number().int().min(50).max(500).optional().default(200),
});

const aiAnalyzeQuerySchema = z.object({
  symbol: z.string().trim().min(1).max(24).optional().default("TOKEN"),
  timeframe: timeframeSchema.optional().default("24h"),
  limit: z.coerce.number().int().min(50).max(500).optional().default(200),
});

const app = new Hono()
  .post("/ai-analyze", async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      const parsed = aiAnalyzeBodySchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: "Invalid request body",
            details: parsed.error.flatten(),
          },
          400,
        );
      }

      const result = await analyzeWashTradingWithAI(parsed.data);

      return c.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[WashTrading] POST /ai-analyze failed:", error);
      return c.json(
        {
          success: false,
          error: "AI wash trading analysis failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  })

  // Dùng được khi muốn test nhanh bằng browser/Postman:
  // GET /api/v1/wash-trading/:mint?symbol=BONK&timeframe=24h
  .get("/:mint", async (c) => {
    try {
      const mint = c.req.param("mint")?.trim();
      const parsed = aiAnalyzeQuerySchema.safeParse({
        symbol: c.req.query("symbol") ?? undefined,
        timeframe: c.req.query("timeframe") ?? undefined,
        limit: c.req.query("limit") ?? undefined,
      });

      if (!mint || mint.length < 32) {
        return c.json({ success: false, error: "Invalid Solana token mint address" }, 400);
      }

      if (!parsed.success) {
        return c.json({ success: false, error: "Invalid query", details: parsed.error.flatten() }, 400);
      }

      const result = await analyzeWashTradingWithAI({ mint, ...parsed.data });
      return c.json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("[WashTrading] GET /:mint failed:", error);
      return c.json(
        {
          success: false,
          error: "AI wash trading analysis failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  })

  // Legacy endpoints giữ lại để không phá code cũ.
  .get("/analyze", async (c) => {
    const mint = c.req.query("mint")?.trim();
    if (!mint) return c.json({ success: false, error: "mint is required" }, 400);
    const analysis = await washTradingService.analyzeWashTrading(mint);
    return c.json({ success: true, data: analysis, timestamp: new Date().toISOString() });
  })

  .get("/circular-trades", async (c) => {
    const mint = c.req.query("mint")?.trim();
    if (!mint) return c.json({ success: false, error: "mint is required" }, 400);
    const timeWindow = Number(c.req.query("timeWindow") ?? 3_600_000);
    const data = await washTradingService.detectCircularTrades(mint, timeWindow);
    return c.json({ success: true, data, count: data.length });
  })

  .get("/star-topology", async (c) => {
    const mint = c.req.query("mint")?.trim();
    if (!mint) return c.json({ success: false, error: "mint is required" }, 400);
    const data = await washTradingService.detectStarTopology(mint);
    return c.json({ success: true, data, count: data.length });
  })

  .get("/volume-anomalies", async (c) => {
    const mint = c.req.query("mint")?.trim();
    if (!mint) return c.json({ success: false, error: "mint is required" }, 400);
    const data = await washTradingService.detectVolumeAnomalies(mint);
    return c.json({ success: true, data, count: data.length });
  });

export type WashTradingAppType = typeof app;
export default app;
