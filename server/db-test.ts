import "dotenv/config";
import { fetchBirdeyeJson } from "./src/services/wallet/fetchers/walletDataFetcher.service.js";

async function main() {
  const json = await fetchBirdeyeJson(
    "/v1/wallet/portfolio/history",
    "GET",
    {
      searchParams: {
        wallet: "JD38n7ynKYcgPpF7k1BhXEeREu1KqptU93fVGy3S624k",
        period: "1M"
      },
    },
  );
  
  const items = json?.data?.items || [];
  console.log(`History length: ${items.length}`);
  if (items.length > 0) {
    console.log("First item:", JSON.stringify(items[0]));
    console.log("Last item:", JSON.stringify(items[items.length - 1]));
  }
}

main().catch(console.error);
