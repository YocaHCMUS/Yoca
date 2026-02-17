import { serve } from "@hono/node-server";
import "@sv/util/load-env.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { clientDomains } from "./config/security.js";
import balances from "./routes/balances.js";
import chartBalance from "./routes/charts/balance.route.js";
import chartCounterparties from "./routes/charts/counterparties.route.js";
import chartDistribution from "./routes/charts/distribution.route.js";
import chartExchanges from "./routes/charts/exchanges.route.js";
import chartHoldings from "./routes/charts/holdings.route.js";
import chartPnL from "./routes/charts/pnl.route.js";
import chartPriceHistory from "./routes/charts/price-history.route.js";
import chartTransactions from "./routes/charts/transactions.route.js";
import chartVolume from "./routes/charts/volume.route.js";
import tokens from "./routes/tokens.js";
import transfers from "./routes/transfers.js";
import users from "./routes/users.js";

process.loadEnvFile("./.env");

// Routes
const app = new Hono()
  .use("*", logger())
  .use(
    "/api/*",
    cors({
      origin: clientDomains,
      credentials: true,
    }),
    csrf({
      origin: clientDomains,
    }),
  )
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
  .route("/api/charts/price-history", chartPriceHistory);
const port = Number(process.env.SERVER_PORT) || 4000;

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
