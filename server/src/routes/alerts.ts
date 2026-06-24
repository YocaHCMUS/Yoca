import { Hono } from "hono";
import alertsToken from "./alerts/alerts-token";
import alertsTrading from "./alerts/alerts-trading";
import alertsTradingEvents from "./alerts/alerts-trading-events";

const app = new Hono()
  .route("/tokens", alertsToken)
  .route("/trading", alertsTrading)
  .route("/trading-events", alertsTradingEvents);

export default app;

export type AlertsAppType = typeof app;
