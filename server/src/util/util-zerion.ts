import { getTrackedApiResult } from "@sv/middlewares/validation";
import env from "./load-env";
import { zrn_WalletBalanceChartSchema } from "@sv/services/_types/wallet-raw-responses";
import Bottleneck from "bottleneck";

// For when u want a quick api test:
// delete this when you want to be proffesional
// apiKeyTransformed: "emtfMWZiYjg0MTNiZDgzNDJmNWE0MGY0YTE0N2I5ZWQyNmE6"
//   curl --request GET \
// --url 'https://api.zerion.io/v1/wallets/3nMNd89AxwHUa1AFvQGqohRkxFEQsTsgiEyEyqXFHyyH/charts/day?currency=usd&filter[positions]=only_simple&filter[chain_ids]=solana&filter[fungible_ids]=solana' \
// --header 'Authorization: Basic emtfMWZiYjg0MTNiZDgzNDJmNWE0MGY0YTE0N2I5ZWQyNmE6'

const apiKey = env.ZERION_API_KEY;
const apiKeyTransformed = btoa(apiKey + ":");

export function getEndpoint(path: string): URL {
  return new URL(`${env.ZERION_API_BASE_URL}${path}`);
}

export function getRequiredHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    Authorization: `Basic ${apiKeyTransformed}`,
  };

  return headers;
}

async function testZerion(walletAddress: string) {
  const zEndpoint = getEndpoint(`/wallets/${walletAddress}/charts/day`);
  const req = new URL(zEndpoint);
  req.search = new URLSearchParams({
    currency: "usd",
  }).toString();

  const resp = await fetch(req, {
    method: "GET",
    headers: getRequiredHeaders(),
  });

  const res = await getTrackedApiResult(zrn_WalletBalanceChartSchema, resp);
  if (!res) {
    return;
  }
}

export const limiter = new Bottleneck({
  reservoir: 300, // 300 requests per day
  reservoirRefreshAmount: 300,
  reservoirRefreshInterval: 24 * 60 * 60 * 1000, // 24 hours (86400000 ms)
  maxConcurrent: 1, // only one request at a time
  minTime: 1000, // at least 1 second between requests
});

export type ZRN_ChartPeriod =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "3months"
  | "6months"
  | "year"
  | "5years"
  | "max";
