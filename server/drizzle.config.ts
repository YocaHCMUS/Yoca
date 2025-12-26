import { defineConfig } from "drizzle-kit";

process.loadEnvFile(".env");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_DB_URL!,
  },
});
