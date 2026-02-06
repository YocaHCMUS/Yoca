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
import chartTransactions from "./routes/charts/transactions.route.js";
import chartVolume from "./routes/charts/volume.route.js";
import tokens from "./routes/tokens.js";
import transfers from "./routes/transfers.js";
import users from "./routes/users.js";

process.loadEnvFile("./.env");

// Routes
const app = new Hono()
  // 1. Cấu hình Middleware (Đặt lên đầu)
app.use("*", logger());
app.use("/api/*", cors({
  // Cho phép tất cả origin trong môi trường phát triển để tránh lỗi CORS
  // Cân nhắc thu hẹp origin khi triển khai production
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// 2. Định nghĩa các Route
app.get("/", (c) => c.redirect("/api"));
app.get("/api", (c) => c.json({ status: "ok" }));

// Gắn các cụm API
app.route("/api/users", users);
app.route("/api/tokens", tokens);
app.route("/api/balances", balances);
app.route("/api/transfers", transfers);
app.route("/api/charts/balance", chartBalance);
app.route("/api/charts/distribution", chartDistribution);
app.route("/api/charts/pnl", chartPnL);
app.route("/api/charts/exchanges", chartExchanges);
app.route("/api/charts/counterparties", chartCounterparties);
app.route("/api/charts/volume", chartVolume);
app.route("/api/charts/transactions", chartTransactions);
app.route("/api/charts/holdings", chartHoldings);
app.route("/api/charts/price-history", chartPriceHistory);
// 3. Khởi chạy Server
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
