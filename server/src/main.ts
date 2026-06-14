import env from "@sv/util/load-env.js";
import "@sv/util/date.js";
import { serve } from "@hono/node-server";
import { clientDomains } from "@sv/config/security.js";
import { requestContextMiddleware } from "@sv/middlewares/request-context.js";
import users, { type UsersAppType } from "@sv/routes/users.js";
import auth, { type AuthAppType } from "@sv/routes/auth.js";
import tokens, { type TokenAppType } from "@sv/routes/tokens.js";
import balances, { type BalancesAppType } from "@sv/routes/balances.js";
import alerts, { type AlertsRouteAppType } from "@sv/routes/alerts.route.js";
import alertsHp, { type AlertsAppType } from "@sv/routes/alerts.js";
import chartRoutes, { type ChartRouteAppType } from "@sv/routes/chart.route.js";
import misc, { type MiscAppType } from "@sv/routes/misc.js";
import news, { type NewsAppType } from "@sv/routes/news.js";
import tokenNews, { type TokenNewsAppType } from "@sv/routes/token-news.js";
import tokenChartNewsEvents, {
  type TokenChartNewsEventsAppType,
} from "@sv/routes/token-chart-news-events.js";
import tokenVolatility, {
  type TokenVolatilityAppType,
} from "@sv/routes/token-volatility.js";
import tokenVolatilityNews, {
  type TokenVolatilityNewsAppType,
} from "@sv/routes/token-volatility-news.js";
import tokenAiChat, {
  type TokenAiChatAppType,
} from "@sv/routes/token-ai-chat.js";
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
import walletAnalysis, {
  type WalletAnalysisAppType,
} from "@sv/modules/wallet-analysis/routes/walletAnalysis.routes.js";
import webhook, { type WebhookAppType } from "@sv/routes/webhook.js";
import chat, { type ChatAppType } from "@sv/routes/chat.route.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import payment, { PaymentAppType } from "./routes/payment.route.js";
import washTradingRoutes, { type WashTradingAppType } from './routes/wash-trading.route.js';

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
    port: env.SERVER_PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);

// Define here first
export type AppRoutes = {
  "/api/users": UsersAppType;
  "/api/auth": AuthAppType;
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
  "/api/wallet-analysis": WalletAnalysisAppType;
  "/api/alerts": AlertsRouteAppType;
  "/api/trades": TradesAppType;
  "/api/alertsHp": AlertsAppType;
  "/api/news": NewsAppType;
  "/api/token-news": TokenNewsAppType;
  "/api/token-chart-news-events": TokenChartNewsEventsAppType;
  "/api/token-volatility": TokenVolatilityAppType;
  "/api/token-volatility-news": TokenVolatilityNewsAppType;
  "/api/token-ai-chat": TokenAiChatAppType;
  "/webhook": WebhookAppType;
  "/api/payment": PaymentAppType;
  "/api/chat": ChatAppType;
  "/api/v1/wash-trading": WashTradingAppType;
};

// Then here
const routes: AppRoutes = {
  "/api/users": users,
  "/api/auth": auth,
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
  "/api/wallet-analysis": walletAnalysis,
  "/api/alerts": alerts,
  "/api/trades": trades,
  "/api/alertsHp": alertsHp,
  "/api/news": news,
  "/api/token-news": tokenNews,
  "/api/token-chart-news-events": tokenChartNewsEvents,
  "/api/token-volatility": tokenVolatility,
  "/api/token-volatility-news": tokenVolatilityNews,
  "/api/token-ai-chat": tokenAiChat,
  "/api/payment": payment,
  "/api/chat": chat,
  "/webhook": webhook,
  "/api/v1/wash-trading": washTradingRoutes,
};

Object.entries(routes).forEach(([path, route]) => {
  app.route(path, route);
});

export type { Hono as HonoAppType } from "hono";
export type AppRouteOf<T extends keyof AppRoutes> = AppRoutes[T];
export type { ErrCode } from "@sv/config/errors.js";
