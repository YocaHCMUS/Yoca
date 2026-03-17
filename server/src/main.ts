import "@sv/util/load-env.js";

import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { Scalar } from '@scalar/hono-api-reference'
import { OpenAPIHono } from "@hono/zod-openapi";
import traders from "@sv/routes/traders.js";
import trades from "@sv/routes/trades.js";
import wallets from "@sv/routes/wallets.route.js";
import walletTags from "@sv/routes/walletTags.route.js";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { clientDomains } from "./config/security.js";
import { registerOpenApiRoutes } from "./config/openapi.js";
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

// Routes
const app: any = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid request" }, 400);
    }
  },
})
  .use("*", logger())
  .use(
    "/api/*",
    cors({ origin: clientDomains, credentials: true }),
    csrf({ origin: clientDomains }),
  )
  .get("/", (c) => c.redirect("/api"))
  .get("/api", (c) => c.json({ status: "ok" }))
  .get("/api/docs", swaggerUI({ url: "/api/docs/openapi.json" }))
  .get("/api/docs/scalar", Scalar({ url: "/api/docs/openapi.json" }))
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

registerOpenApiRoutes(app);

app.doc("/api/docs/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "YOCA BACKEND API",
    version: "1.0.0",
    description: "API documentation for YOCA backend",
  },
  tags: [
    {
      name: "Charts",
      description: "Chart analytics endpoints",
    },
    {
      name: "Wallets",
      description: "Wallet analytics and intelligence endpoints",
    },
    {
      name: "Wallet Tags",
      description: "Authenticated wallet tag management endpoints",
    },
  ],
});

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
