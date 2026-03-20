import { Storage } from "@sv/services/storage.js";
import { DefaultLogger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { dirname, join } from "path";
import postgres from "postgres";
import { fileURLToPath } from "url";
import * as dbSchema from "./schema.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

const logger = new DefaultLogger({
  writer: {
    write(message: string): void {
      Storage.saveText(
        join(currentDir, `../logs/sql/${Storage.generateTimestamp()}.txt`),
        message,
      );
    },
  },
});

function isSqlLoggingEnabled(): boolean {
  const raw = String(process.env.ENABLE_SQL_LOG ?? "").trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") {
    return true;
  }

  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

const client = postgres(process.env.POSTGRES_DB_URL!);
export const db = drizzle({
  client,
  schema: dbSchema,
  logger: isSqlLoggingEnabled() ? logger : undefined,
});
