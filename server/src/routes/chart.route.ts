import { Hono } from "hono";
import chartAverageRollingAnnualReturn from "@sv/routes/charts/average-rolling-annual-return.route.js";
import chartBalance from "@sv/routes/charts/balance.route.js";
import chartCounterparties from "@sv/routes/charts/counterparties.route.js";
import chartDailyTradingVolume from "@sv/routes/charts/daily-trading-volume.route.js";
import chartDistribution from "@sv/routes/charts/distribution.route.js";
import chartDrawdown from "@sv/routes/charts/drawdown.route.js";
import chartExchanges from "@sv/routes/charts/exchanges.route.js";
import chartHoldings from "@sv/routes/charts/holdings.route.js";
import chartPnL from "@sv/routes/charts/pnl.route.js";
import chartPriceHistory from "@sv/routes/charts/price-history.route.js";
import chartRollingAnnualReturn from "@sv/routes/charts/rolling-annual-return.route.js";
import chartStablecoinRatio from "@sv/routes/charts/stablecoin-ratio.route.js";
import chartTotalTradingVolume from "@sv/routes/charts/total-trading-volume.route.js";
import chartTradingVolumeDistribution from "@sv/routes/charts/trading-volume-distribution.route.js";
import chartTradingVolumePerTransaction from "@sv/routes/charts/trading-volume-per-transaction.route.js";
import chartTransactions from "@sv/routes/charts/transactions.route.js";
import chartVolume from "@sv/routes/charts/volume.route.js";
import chartWinrate from "@sv/routes/charts/winrate.route.js";

const app = new Hono();

const routes = app
    .route("/balance", chartBalance)
    .route("/distribution", chartDistribution)
    .route("/pnl", chartPnL)
    .route("/exchanges", chartExchanges)
    .route("/counterparties", chartCounterparties)
    .route("/volume", chartVolume)
    .route("/transactions", chartTransactions)
    .route("/holdings", chartHoldings)
    .route("/price-history", chartPriceHistory)
    .route("/dailyTradingVolume", chartDailyTradingVolume)
    .route("/tradingVolumeDistribution", chartTradingVolumeDistribution)
    .route("/tradingVolumePerTransaction", chartTradingVolumePerTransaction)
    .route("/rollingAnnualReturn", chartRollingAnnualReturn)
    .route("/averageRollingAnnualReturn", chartAverageRollingAnnualReturn)
    .route("/winrate", chartWinrate)
    .route("/drawdown", chartDrawdown)
    .route("/totalTradingVolume", chartTotalTradingVolume)
    .route("/stablecoinRatio", chartStablecoinRatio);

export default routes;
