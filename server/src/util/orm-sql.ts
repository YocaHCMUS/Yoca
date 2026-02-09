// Add quality of life functions for Drizzle SQL-like query

import { sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

export function excluded<T extends PgColumn>(column: T): T["_"]["data"] {
  return sql.raw(`excluded.${column.name}`);
}

export function excludedAuto<
  Table extends PgTable,
  Insert = Table["$inferInsert"],
  Field = keyof Insert,
>(table: Table, targetColumns: PgColumn | PgColumn[]) {
  targetColumns = Array.isArray(targetColumns)
    ? targetColumns
    : [targetColumns];
  return Object.fromEntries(
    (Object.keys(table.$inferInsert) as Field[])
      .filter((field) => targetColumns.includes((table as any)[field]))
      .map((field) => [field, excluded((table as any)[field])]),
  );
}
