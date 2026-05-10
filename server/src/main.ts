import env from "@sv/util/load-env.js";
import { serve } from "@hono/node-server";
import { clientDomains } from "@sv/config/security.js";
import { requestContextMiddleware } from "@sv/middlewares/request-context.js";
import users, { type UsersAppType } from "@sv/routes/users.js";
import tokens, { type TokenAppType } from "@sv/routes/tokens.js";
import balances, { type BalancesAppType } from "@sv/routes/balances.js";
import alerts, { type AlertsRouteAppType } from "@sv/routes/alerts.route.js";
import alertsToken, { type AlertsAppType } from "@sv/routes/alerts.js";
import chartRoutes, { type ChartRouteAppType } from "@sv/routes/chart.route.js";
import misc, { type MiscAppType } from "@sv/routes/misc.js";
import news, { type NewsAppType } from "@sv/routes/news.js";
import profile, { type ProfileAppType } from "@sv/routes/profile.js";
import search, { type SearchAppType } from "@sv/routes/search.js";
import trades, { type TradesAppType } from "@sv/routes/trades.js";
import transactions, {
  type TransactionsAppType,
} from "@sv/routes/transactions.js";
import transfers, { type TransfersAppType } from "@sv/routes/transfers.js";
import wallets, { type WalletsAppType } from "@sv/routes/wallets.route.js";
import walletTags, {
  type WalletTagsAppType,
} from "@sv/routes/walletTags.route.js";
import webhook, { type WebhookAppType } from "@sv/routes/webhook.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";

const app = new Hono()
  .use("*", logger())
  .use("*", requestContextMiddleware)
  .use(
    "/api/*",
    cors({ origin: clientDomains, credentials: true }),
    ...(env.NODE_ENV == "development" ? [csrf({ origin: clientDomains })] : []),
  )
  .get("/", (c) => c.redirect("/api"))
  .get("/api", (c) => c.json({ status: "ok" }));

// startTokenPolling();

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

// Define here first
export type AppRoutes = {
  "/api/users": UsersAppType;
  "/api/tokens": TokenAppType;
  "/api/misc": MiscAppType;
  "/api/search": SearchAppType;
  "/api/transactions": TransactionsAppType;
  "/api/balances": BalancesAppType;
  "/api/transfers": TransfersAppType;
  "/api/charts": ChartRouteAppType;
  "/api/profile": ProfileAppType;
  "/api/wallets": WalletsAppType;
  "/api/walletTags": WalletTagsAppType;
  "/api/alerts": AlertsRouteAppType;
  "/api/trades": TradesAppType;
  "/api/alertsToken": AlertsAppType;
  "/api/news": NewsAppType;
  "/webhook": WebhookAppType;
};

// Then here
const routes: AppRoutes = {
  "/api/users": users,
  "/api/tokens": tokens,
  "/api/misc": misc,
  "/api/search": search,
  "/api/transactions": transactions,
  "/api/balances": balances,
  "/api/transfers": transfers,
  "/api/charts": chartRoutes,
  "/api/profile": profile,
  "/api/wallets": wallets,
  "/api/walletTags": walletTags,
  "/api/alerts": alerts,
  "/api/trades": trades,
  "/api/alertsToken": alertsToken,
  "/api/news": news,
  "/webhook": webhook,
};

Object.entries(routes).forEach(([path, route]) => {
  app.route(path, route);
});

export type { Hono as HonoAppType } from "hono";
export type AppRouteOf<T extends keyof AppRoutes> = AppRoutes[T];
