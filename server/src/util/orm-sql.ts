// Add quality of life function for Drizzle SQL-like query

import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export function excluded<T extends PgColumn>(column: T): T["_"]["data"] {
  return sql.raw(`excluded.${column.name}`);
}
