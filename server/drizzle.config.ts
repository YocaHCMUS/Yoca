import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from the server's .env and override any existing values,
// so POSTGRES_DB_URL from this file is always used (even if set in the shell).
dotenv.config({ path: ".env", override: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./postgresdb/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_DB_URL!,
  },
});
