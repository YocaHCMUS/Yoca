import "@sv/util/load-env.js";

import { serve } from "@hono/node-server";
import traders from "@sv/routes/traders.js";
import trades from "@sv/routes/trades.js";
import wallets from "@sv/routes/wallets.route.js";
import walletTags from "@sv/routes/walletTags.route.js";
import chartRoutes from "@sv/routes/chart.route.js";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { clientDomains } from "@sv/config/security.js";
import balances from "@sv/routes/balances.js";
import misc from "@sv/routes/misc.js";
import search from "@sv/routes/search.js";
import tokens from "@sv/routes/tokens.js";
import transfers from "@sv/routes/transfers.js";
import users from "@sv/routes/users.js";
import { Hono } from "hono";

// intialize OpenAPIHono with default error handling
const app = new Hono();

function sanitizeExportFilename(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
  return sanitized.length > 0 ? sanitized : "chart";
}

// Routes
const routes = app
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
  .route("/api/charts", chartRoutes)
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
export type AppType = typeof routes;
export type { ErrCode } from "@sv/config/errors.js";
