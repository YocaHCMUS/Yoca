import "dotenv/config";
import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    TRUNCATE TABLE "top_token_holders";
  `);

  console.log("Table 'top_token_holders' truncated successfully");
  process.exit(0);
}

main().catch(console.error);
