// import { Storage } from "@sv/services/storage.js";
// import { DefaultLogger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dbSchema from "./schema.js";

const client = postgres(process.env.POSTGRES_DB_URL!);
export const db = drizzle({
  client,
  schema: dbSchema,
  // logger: isSqlLoggingEnabled() ? logger : undefined,
});
