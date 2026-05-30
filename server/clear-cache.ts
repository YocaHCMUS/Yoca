import "dotenv/config";
import { db } from "./src/db/index.js";
import { walletOverviewCache, walletPortfolioCache, walletBalanceHistory } from "./src/db/schema.js";

async function main() {
  await db.delete(walletOverviewCache);
  await db.delete(walletPortfolioCache);
  await db.delete(walletBalanceHistory);
  console.log("Caches cleared!");
}

main().catch(console.error);
