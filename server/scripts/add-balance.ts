import "dotenv/config";
import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    ALTER TABLE "top_token_holders" ADD COLUMN IF NOT EXISTS "balance" numeric;
  `);

  console.log("Column 'balance' added successfully");
  process.exit(0);
}

main().catch(console.error);
