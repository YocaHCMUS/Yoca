/**
 * wash-trading.route.ts  (CẬP NHẬT)
 *
 * Thêm endpoint mới:
 *   POST /api/v1/wash-trading/ai-analyze
 *
 * Đặt file tại: server/src/routes/wash-trading.route.ts
 * (Thay thế toàn bộ file cũ)
 */

import { Hono } from "hono";
import { z } from "zod";
import { washTradingService } from "../services/wash-trading.service";
import { analyzeWashTradingWithAI } from "../services/wash-trading-ai.service";

// ─── Schema validation ────────────────────────────────────────────────────────

const tokenQuerySchema = z.object({
  mint: z.string().trim().min(1, "Token mint address required"),
});

const aiAnalyzeSchema = z.object({
  mint: z.string().trim().min(32, "Invalid Solana mint address"),
  symbol: z.string().trim().optional().default("TOKEN"),
  limit: z.number().int().min(50).max(500).optional().default(200),
});

export type WashTradingAppType = typeof app;

const app = new Hono()

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/v1/wash-trading/ai-analyze
  // ★ ENDPOINT CHÍNH — Hướng 2: Thuật toán + Gemini AI
  //
  // Body: { mint: string, symbol?: string, limit?: number }
  // Returns: WashTradingAIResult (full analysis + AI commentary)
  // ─────────────────────────────────────────────────────────────────────────────
  .post("/ai-analyze", async (c) => {
    try {
      const body = await c.req.json();
      const parsed = aiAnalyzeSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: "Invalid request body",
            details: parsed.error.flatten(),
          },
          400
        );
      }

      const { mint, symbol, limit } = parsed.data;
      console.log(`[WashTradingAI] Starting AI analysis for ${symbol} (${mint})`);

      const result = await analyzeWashTradingWithAI({ mint, symbol, limit });

      return c.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[WashTradingAI] AI analyze error:", err);
      return c.json(
        {
          success: false,
          error: "AI analysis failed",
          message: err instanceof Error ? err.message : "Unknown error",
        },
        500
      );
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/wash-trading/analyze (legacy endpoint, giữ để không break)
  // ─────────────────────────────────────────────────────────────────────────────
  .get("/analyze", async (c) => {
    try {
      const mint = c.req.query("mint");
      if (!mint) {
        return c.json({ success: false, error: "Token mint address required" }, 400);
      }

      const analysis = await washTradingService.analyzeWashTrading(mint);
      return c.json({ success: true, data: analysis, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("[WashTrading] Analysis error:", err);
      return c.json({ success: false, error: "Analysis failed" }, 500);
    }
  })

  .get("/circular-trades", async (c) => {
    const mint = c.req.query("mint");
    if (!mint) return c.json({ success: false, error: "mint required" }, 400);
    const timeWindow = parseInt(c.req.query("timeWindow") ?? "3600000");
    const data = await washTradingService.detectCircularTrades(mint, timeWindow);
    return c.json({ success: true, data, count: data.length });
  })

  .get("/star-topology", async (c) => {
    const mint = c.req.query("mint");
    if (!mint) return c.json({ success: false, error: "mint required" }, 400);
    const data = await washTradingService.detectStarTopology(mint);
    return c.json({ success: true, data, count: data.length });
  })

  .get("/volume-anomalies", async (c) => {
    const mint = c.req.query("mint");
    if (!mint) return c.json({ success: false, error: "mint required" }, 400);
    const data = await washTradingService.detectVolumeAnomalies(mint);
    return c.json({ success: true, data, count: data.length });
  });

export default app;