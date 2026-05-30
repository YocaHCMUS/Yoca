import postgres from 'postgres';
import { config } from 'dotenv';
config();

const sql = postgres(process.env.POSTGRES_DB_URL, { max: 1 });

async function run() {
  await sql`
    CREATE TABLE IF NOT EXISTS "user_wallet_labels" (
      "user_id" uuid NOT NULL,
      "wallet_address" character varying(44) NOT NULL,
      "label" character varying(255) NOT NULL,
      CONSTRAINT "user_wallet_labels_pkey" PRIMARY KEY ("user_id", "wallet_address"),
      CONSTRAINT "user_wallet_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
    );
  `;
  console.log("Migration done");
}

run().catch(console.error).finally(() => sql.end());
