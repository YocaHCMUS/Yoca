import "@sv/util/load-env.js";

import { serve } from "@hono/node-server";
import traders from "@sv/routes/traders.js";
import trades from "@sv/routes/trades.js";
import wallets from "@sv/routes/wallets.route.js";
import walletTags from "@sv/routes/walletTags.route.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import puppeteer from "puppeteer";
import { clientDomains } from "./config/security.js";
import balances from "./routes/balances.js";
import chartAverageRollingAnnualReturn from "./routes/charts/average-rolling-annual-return.route.js";
import chartBalance from "./routes/charts/balance.route.js";
import chartCounterparties from "./routes/charts/counterparties.route.js";
import chartDailyTradingVolume from "./routes/charts/daily-trading-volume.route.js";
import chartDistribution from "./routes/charts/distribution.route.js";
import chartDrawdown from "./routes/charts/drawdown.route.js";
import chartExchanges from "./routes/charts/exchanges.route.js";
import chartHoldings from "./routes/charts/holdings.route.js";
import chartPnL from "./routes/charts/pnl.route.js";
import chartPriceHistory from "./routes/charts/price-history.route.js";
import chartRollingAnnualReturn from "./routes/charts/rolling-annual-return.route.js";
import chartStablecoinRatio from "./routes/charts/stablecoin-ratio.route.js";
import chartTotalTradingVolume from "./routes/charts/total-trading-volume.route.js";
import chartTradingVolumeDistribution from "./routes/charts/trading-volume-distribution.route.js";
import chartTradingVolumePerTransaction from "./routes/charts/trading-volume-per-transaction.route.js";
import chartTransactions from "./routes/charts/transactions.route.js";
import chartVolume from "./routes/charts/volume.route.js";
import chartWinrate from "./routes/charts/winrate.route.js";
import misc from "./routes/misc.js";
import search from "./routes/search.js";
import tokens from "./routes/tokens.js";
import transfers from "./routes/transfers.js";
import users from "./routes/users.js";

function sanitizeExportFilename(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
  return sanitized.length > 0 ? sanitized : "chart";
}

// Routes
const app = new Hono()
  .use("*", logger())
  .use(
    "/api/*",
    cors({ origin: clientDomains, credentials: true }),
    csrf({ origin: clientDomains }),
  )
  .get("/", (c) => c.redirect("/api"))
  .get("/api", (c) => c.json({ status: "ok" }))
  .route("/api/users", users)
  .route("/api/tokens", tokens)
  .route("/api/misc", misc)
  .route("/api/search", search)
  .route("/api/balances", balances)
  .route("/api/transfers", transfers)
  .route("/api/charts/balance", chartBalance)
  .route("/api/charts/distribution", chartDistribution)
  .route("/api/charts/pnl", chartPnL)
  .route("/api/charts/exchanges", chartExchanges)
  .route("/api/charts/counterparties", chartCounterparties)
  .route("/api/charts/volume", chartVolume)
  .route("/api/charts/transactions", chartTransactions)
  .route("/api/charts/holdings", chartHoldings)
  .route("/api/charts/price-history", chartPriceHistory)
  .route("/api/charts/dailyTradingVolume", chartDailyTradingVolume)
  .route(
    "/api/charts/tradingVolumeDistribution",
    chartTradingVolumeDistribution,
  )
  .route(
    "/api/charts/tradingVolumePerTransaction",
    chartTradingVolumePerTransaction,
  )
  .post("/api/charts/export/pdf", async (c) => {
    try {
      const body = await c.req.json<{
        title?: string;
        html?: string;
        svg?: string;
        width?: number;
        height?: number;
      }>();

      const htmlInput = typeof body.html === "string" ? body.html.trim() : "";
      const svg = typeof body.svg === "string" ? body.svg.trim() : "";
      if (!htmlInput && !svg) {
        return c.json({ error: "HTML or SVG content is required" }, 400);
      }

      const width = Number.isFinite(body.width)
        ? Math.min(3000, Math.max(600, Math.round(body.width!)))
        : 1200;
      const height = Number.isFinite(body.height)
        ? Math.min(14000, Math.max(400, Math.round(body.height!)))
        : 640;
      const isHtmlExport = htmlInput.length > 0;

      const safeTitle = sanitizeExportFilename(body.title ?? "chart");
      const html = htmlInput || `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: ${width}px;
        height: ${height}px;
        background: #ffffff;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .chart {
        width: ${width}px;
        height: ${height}px;
      }
      .chart > svg {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div class="chart">${svg}</div>
  </body>
</html>`;

      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      try {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(120000);
        page.setDefaultTimeout(120000);
        await page.setViewport({ width, height, deviceScaleFactor: 2 });
        await page.setContent(html, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });
        await page.emulateMediaType("screen");
        await page.evaluate(async () => {
          if ("fonts" in document) {
            try {
              await document.fonts.ready;
            } catch {
              // Ignore font readiness failures in export context.
            }
          }
        });

        const pdf = isHtmlExport
          ? await (async () => {
              const screenshot = await page.screenshot({
                type: "png",
                fullPage: true,
                captureBeyondViewport: true,
              });
              const screenshotBase64 = Buffer.from(screenshot).toString("base64");

              await page.setContent(
                `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      img {
        display: block;
        width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <img alt="page-export" src="data:image/png;base64,${screenshotBase64}" />
  </body>
</html>`,
                {
                  waitUntil: "domcontentloaded",
                  timeout: 120000,
                },
              );

              return page.pdf({
                printBackground: true,
                width: `${width}px`,
                height: `${height}px`,
                preferCSSPageSize: false,
                margin: {
                  top: "0",
                  right: "0",
                  bottom: "0",
                  left: "0",
                },
              });
            })()
          : await page.pdf({
              printBackground: true,
              width: `${width}px`,
              height: `${height}px`,
              preferCSSPageSize: false,
              margin: {
                top: "0",
                right: "0",
                bottom: "0",
                left: "0",
              },
            });

        const pdfBuffer = Buffer.from(pdf);

        return c.newResponse(pdfBuffer, 200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
        });
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error("[charts.export.pdf] Failed to export PDF:", error);
      return c.json(
        {
          error: "Failed to export PDF",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  })
  .route("/api/charts/rollingAnnualReturn", chartRollingAnnualReturn)
  .route(
    "/api/charts/averageRollingAnnualReturn",
    chartAverageRollingAnnualReturn,
  )
  .route("/api/charts/winrate", chartWinrate)
  .route("/api/charts/drawdown", chartDrawdown)
  .route("/api/charts/totalTradingVolume", chartTotalTradingVolume)
  .route("/api/charts/stablecoinRatio", chartStablecoinRatio)
  .route("/api/wallets", wallets)
  .route("/api/walletTags", walletTags)
  .route("/api/traders", traders)
  .route("/api/trades", trades);

// Server
serve(
  {
    // Redirect Node's requests to Hono
    fetch: app.fetch,
    port: Number(process.env.SERVER_PORT!) || 4000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
// RPC for client
export type AppType = typeof app;
export type { ErrCode } from "@sv/config/errors.js";
