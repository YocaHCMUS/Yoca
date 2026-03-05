// Add quality of life functions for Drizzle SQL-like query

import { getTableColumns, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

// Wraps a column reference in the PostgreSQL `excluded.` prefix, used in
// ON CONFLICT DO UPDATE to refer to the value that was attempted to be inserted.
export function excluded<T extends PgColumn>(column: T): T["_"]["data"] {
  return sql.raw(`excluded.${column.name}`);
}

// Builds the `set` object for ON CONFLICT DO UPDATE by mapping every column in
// the table (except the conflict target columns) to its `excluded.*` value,
// so you don't have to list each field manually.
export function excludedAuto<Table extends PgTable>(
  table: Table,
  targetColumns: PgColumn | PgColumn[],
) {
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
