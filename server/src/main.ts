import env from "@sv/util/load-env.js";

import { serve } from "@hono/node-server";
import { clientDomains } from "@sv/config/security.js";
import { requestContextMiddleware } from "@sv/middlewares/request-context.js";
import alertsToken from "@sv/routes/alerts.js";
import alerts from "@sv/routes/alerts.route.js";
import balances from "@sv/routes/balances.js";
import chartRoutes from "@sv/routes/chart.route.js";
import misc from "@sv/routes/misc.js";
import profile from "@sv/routes/profile.js";
import search from "@sv/routes/search.js";
import tokens from "@sv/routes/tokens.js";
import trades from "@sv/routes/trades.js";
import transfers from "@sv/routes/transfers.js";
import users from "@sv/routes/users.js";
import wallets from "@sv/routes/wallets.route.js";
import walletTags from "@sv/routes/walletTags.route.js";
import webhook from "@sv/routes/webhook.js";
import news from "@sv/routes/news.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { startTokenPolling } from "./services/tokens/token-data-polling";

const app = new Hono()
  .use("*", logger())
  .use("*", requestContextMiddleware)
  .use(
    "/api/*",
    cors({ origin: clientDomains, credentials: true }),
    ...(env.NODE_ENV == "development" ? [csrf({ origin: clientDomains })] : []),
  )
  .get("/", (c) => c.redirect("/api"))
  .get("/api", (c) => c.json({ status: "ok" }))
  .route("/api/users", users)
  .route("/api/tokens", tokens)
  .route("/api/misc", misc)
  .route("/api/search", search)
  .route("/api/balances", balances)
  .route("/api/transfers", transfers)
  .route("/api/charts", chartRoutes)
  .route("/api/profile", profile)
  .route("/api/wallets", wallets)
  .route("/api/walletTags", walletTags)
  .route("/api/alerts", alerts)
  .route("/api/trades", trades)
  .route("/api/alerts", alerts)
  .route("/api/alertsToken", alertsToken)
  .route("/api/news", news)
  .route("/webhook", webhook);

startTokenPolling();

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
