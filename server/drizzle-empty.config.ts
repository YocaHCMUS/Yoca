// This config is just used for cleaning up db
import { defineConfig } from "drizzle-kit";

process.loadEnvFile(".env");

export default defineConfig({
  schema: "./src/db/empty-schema.ts",
  out: "./postgresdb/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_DB_URL!,
  },
});
