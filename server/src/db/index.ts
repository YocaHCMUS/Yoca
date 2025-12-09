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

const client = postgres(process.env.POSTGRES_DB_URL!);
export const db = drizzle({
  client,
  schema: dbSchema,
  logger,
});
