import { Hono } from "hono";
import { z } from "zod";
import { getHistoricalPnLData } from "@sv/services/charts/pnlChart.service.js";

const MAX_CHART_WALLETS = 5;

const pnlRequestSchema = z.object({
    period: z.literal("7D").optional().default("7D"),
    wallets: z.string().optional(),
    aggregation: z.literal("daily").optional().default("daily"),
});

const app = new Hono().get("/", async (c) => {
    try {
        const query = c.req.query();
        const params = pnlRequestSchema.parse(query);

        const wallets = params.wallets
            ? params.wallets
                .split(",")
                .map((wallet) => wallet.trim())
                .filter((wallet) => wallet.length > 0)
            : [];

        if (wallets.length > MAX_CHART_WALLETS) {
            return c.json(
                {
                    error: "Validation error",
                    message: `wallets exceeds max allowed (${MAX_CHART_WALLETS})`,
                },
                400,
            );
        }

        const data = await getHistoricalPnLData(wallets, params.period, params.aggregation);
        return c.json(data, 200);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json(
                {
                    error: "Validation error",
                    details: error.issues,
                },
                400,
            );
        }

        console.error("Error fetching P&L data:", error);
        return c.json(
            {
                error: "Failed to fetch P&L data",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            500,
        );
    }
});

export default app;
