import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Local development can use server/.env. Render supplies environment variables
// directly, so do not fail when this file is absent during deploys.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./postgresdb/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_DB_URL!,
  },
});
