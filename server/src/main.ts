import { serve } from "@hono/node-server";
import "@sv/util/load-env.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import balances from "./routes/balances.js";
import chartBalance from "./routes/charts/balance.route.js";
import chartCounterparties from "./routes/charts/counterparties.route.js";
import chartDistribution from "./routes/charts/distribution.route.js";
import chartExchanges from "./routes/charts/exchanges.route.js";
import chartHoldings from "./routes/charts/holdings.route.js";
import chartPnL from "./routes/charts/pnl.route.js";
import chartPriceHistory from "./routes/charts/price-history.route.js";
import chartTradingVolumeDistribution from "./routes/charts/trading-volume-distribution.route.js";
import chartTradingVolumePerTransaction from "./routes/charts/trading-volume-per-transaction.route.js";
import chartRollingAnnualReturn from "./routes/charts/rolling-annual-return.route.js";
import chartAverageRollingAnnualReturn from "./routes/charts/average-rolling-annual-return.route.js";
import chartTransactions from "./routes/charts/transactions.route.js";
import chartVolume from "./routes/charts/volume.route.js";
import chartWinrate from "./routes/charts/winrate.route.js";
import chartDrawdown from "./routes/charts/drawdown.route.js";
import chartTotalTradingVolume from "./routes/charts/total-trading-volume.route.js";
import chartStablecoinRatio from "./routes/charts/stablecoin-ratio.route.js";
import tokens from "./routes/tokens.js";
import transfers from "./routes/transfers.js";
import users from "./routes/users.js";

process.loadEnvFile("./.env");

// Routes
const app = new Hono()
  .use(cors())
  .use(logger())
  .get("/", (c) => c.redirect("/api"))
  .get("/api", (c) => c.json({ status: "ok" }))
  .route("/api/users", users)
  .route("/api/tokens", tokens)
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
  .route("/api/charts/trading-volume-distribution", chartTradingVolumeDistribution)
  .route("/api/charts/trading-volume-per-transaction", chartTradingVolumePerTransaction)
  .route("/api/charts/rolling-annual-return", chartRollingAnnualReturn)
  .route("/api/charts/average-rolling-annual-return", chartAverageRollingAnnualReturn)
  .route("/api/charts/winrate", chartWinrate)
  .route("/api/charts/drawdown", chartDrawdown)
  .route("/api/charts/total-trading-volume", chartTotalTradingVolume)
  .route("/api/charts/stablecoin-ratio", chartStablecoinRatio);

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
