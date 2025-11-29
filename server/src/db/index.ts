import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dbSchema from "./schema.js";
import { DefaultLogger } from "drizzle-orm";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Storage } from "@services/storage.js";
import "@util/load-env.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

const logger = new DefaultLogger({
  writer: {
    write(message: string): void {
      Storage.saveText(
        join(currentDir, `../logs/sql/${Storage.generateTimestamp()}.sql`),
        message,
      );
    },
  },
});

const client = postgres(process.env.POSTGRES_DB_URL!);
export const db = drizzle({
  client,
  schema: dbSchema,
  logger,
});
