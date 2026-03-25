// import { Storage } from "@sv/services/storage.js";
// import { DefaultLogger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { dirname, join } from "path";
import postgres from "postgres";
import { fileURLToPath } from "url";
import * as dbSchema from "./schema.js";

const client = postgres(process.env.POSTGRES_DB_URL!);
export const db = drizzle({
  client,
  schema: dbSchema,
  // logger: isSqlLoggingEnabled() ? logger : undefined,
});
