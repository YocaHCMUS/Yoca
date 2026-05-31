import "dotenv/config";
import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "user_wallet_labels" (
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "wallet_address" varchar(44) NOT NULL,
      "label" varchar(255) NOT NULL,
      PRIMARY KEY ("user_id", "wallet_address")
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "wallet_balance_history" (
      "address" varchar(66) NOT NULL,
      "timestamp_ms" bigint NOT NULL,
      "usd_value" numeric NOT NULL,
      "updated_at" timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY ("address", "timestamp_ms")
    );
  `);

  console.log("Tables created successfully");
  process.exit(0);
}

main().catch(console.error);
