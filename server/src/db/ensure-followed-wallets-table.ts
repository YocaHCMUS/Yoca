/**
 * One-shot: create followed_wallets if missing (safe; no other schema changes).
 * Run: npx tsx src/db/ensure-followed-wallets-table.ts
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: "./.env" });

const url = process.env.POSTGRES_DB_URL;
if (!url) {
  console.error("POSTGRES_DB_URL is not set");
  process.exit(1);
}

const sql = postgres(url);

await sql.unsafe(`
CREATE TABLE IF NOT EXISTS "followed_wallets" (
  "id" serial PRIMARY KEY NOT NULL,
  "address" text NOT NULL,
  "label" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "followed_wallets_address_unique" UNIQUE("address")
);
`);

await sql.end();
console.log('Table "followed_wallets" is ready.');
