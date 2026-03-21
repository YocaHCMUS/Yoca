import * as cg from "@sv/util/util-coingecko.js";
import { Hono } from "hono";

type ExchangeRateEntry = {
  name: string;
  unit: string;
  value: number;
  type: "crypto" | "fiat" | "commodity";
};

export type ExchangeRatesResponse = {
  rates: Record<string, ExchangeRateEntry>;
};

let cachedRates: ExchangeRatesResponse | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (CG updates every 5 min)

const app = new Hono().get("/exchange-rates", async (c) => {
  const now = Date.now();

  if (cachedRates && now - cachedAt < CACHE_TTL_MS) {
    return c.json(cachedRates);
  }

  try {
    const endpoint = cg.getEndpoint("/exchange_rates");
    const req = new Request(endpoint, {
      method: "GET",
      headers: cg.getRequiredHeaders(),
    });

    const resp = await fetch(req);
    if (!resp.ok) {
      if (cachedRates) return c.json(cachedRates); // serve stale on error
      return c.json({ error: "Failed to fetch exchange rates" }, 502);
    }

    cachedRates = (await resp.json()) as ExchangeRatesResponse;
    cachedAt = now;
    return c.json(cachedRates);
  } catch (err) {
    console.error(err);
    if (cachedRates) return c.json(cachedRates);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
