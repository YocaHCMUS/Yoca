import { Hono } from "hono";
import alertsToken from "./alerts/alerts-token";
import alertsTrading from "./alerts/alerts-trading";

const app = new Hono()
  .route("/tokens", alertsToken)
  .route("/trading", alertsTrading);

export default app;

export type AlertsAppType = typeof app;
