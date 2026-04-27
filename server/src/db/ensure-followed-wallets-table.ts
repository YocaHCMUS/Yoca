/**
 * One-shot: recreate followed_wallets with userId FK and add discord_webhook_url to users.
 * Run: npm run db:ensure-followed-wallets
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

async function main() {
  await sql.unsafe(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "discord_webhook_url" text;
  `);
  console.log('Column "discord_webhook_url" ensured on "users".');

  await sql.unsafe(`DROP TABLE IF EXISTS "followed_wallets" CASCADE;`);

  await sql.unsafe(`
    CREATE TABLE "followed_wallets" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "address" text NOT NULL,
      "label" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "followed_wallets_user_id_address_unique" UNIQUE("user_id", "address")
    );
  `);
  console.log('Table "followed_wallets" recreated with user_id FK and composite unique.');

  await sql.end();
}

main();
