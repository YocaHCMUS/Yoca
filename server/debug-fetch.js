import * as cg from "./src/util/util-coingecko.js";
import { trackedFetch } from "./src/services/tracking/apiCallTracker.service.js";
import dotenv from "dotenv";
dotenv.config();

async function testFetchPool(poolAddress) {
  const cgEndpoint = cg.getOnchainEndpoint(
    `/networks/solana/pools/${poolAddress}`,
  );

  cgEndpoint.search = new URLSearchParams({
    include: "base_token,quote_token,dex",
    include_volume_breakdown: "true",
    include_composition: "true",
  }).toString();

  console.log("Fetching URL:", cgEndpoint.toString());

  const resp = await fetch(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  console.log("Status:", resp.status);
  const data = await resp.json();
  console.log("Data:", JSON.stringify(data).slice(0, 500));
}

const poolAddress = "un65AdfW7gf3LVgYEgK6LpGHFZFW57r7anSpgv5cmiS";
testFetchPool(poolAddress);
