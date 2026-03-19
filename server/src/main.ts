import "@sv/util/load-env.js";

import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { Scalar } from '@scalar/hono-api-reference'
import { OpenAPIHono } from "@hono/zod-openapi";
import traders from "@sv/routes/traders.js";
import trades from "@sv/routes/trades.js";
import wallets from "@sv/routes/wallets.route.js";
import walletTags from "@sv/routes/walletTags.route.js";
import chartRoutes from "@sv/routes/chart.route.js";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { clientDomains } from "@sv/config/security.js";
import { registerOpenApiRoutes } from "@sv/config/openapi.js";
import balances from "@sv/routes/balances.js";
import misc from "@sv/routes/misc.js";
import search from "@sv/routes/search.js";
import tokens from "@sv/routes/tokens.js";
import transfers from "@sv/routes/transfers.js";
import users from "@sv/routes/users.js";

// intialize OpenAPIHono with default error handling
const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid request" }, 400);
    }
  },
});

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
  .get("/api/docs", swaggerUI({ url: "/api/docs/openapi.json" }))
  .get("/api/docs/scalar", Scalar({ url: "/api/docs/openapi.json" }))
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
export type AppType = typeof routes;
export type { ErrCode } from "@sv/config/errors.js";
