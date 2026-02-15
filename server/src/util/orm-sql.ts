// Add quality of life functions for Drizzle SQL-like query

import { getTableColumns, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

export function excluded<T extends PgColumn>(column: T): T["_"]["data"] {
  return sql.raw(`excluded.${column.name}`);
}

export function excludedAuto<
  Table extends PgTable,
>(table: Table, targetColumns: PgColumn | PgColumn[]) {
  const targets = Array.isArray(targetColumns)
    ? targetColumns
    : [targetColumns];
  const columns = getTableColumns(table);
  return Object.fromEntries(
    Object.keys(columns)
      .filter((field) => !targets.includes((table as any)[field]))
      .map((field) => [field, excluded((table as any)[field])]),
  );
}
