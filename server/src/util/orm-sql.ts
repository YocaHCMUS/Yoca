// Add quality of life functions for Drizzle SQL-like query

import { getTableColumns, SQL, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

// Wraps a column reference in the PostgreSQL `excluded.` prefix, used in
// ON CONFLICT DO UPDATE to refer to the value that was attempted to be inserted.
export function excluded<T extends PgColumn>(column: T): SQL<T["_"]["data"]> {
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
  if (targets.length == 0) {
    return {};
  }
  const columns = getTableColumns(table);
  return Object.fromEntries(
    Object.keys(columns)
      .filter((colName) => !targets.includes(columns[colName]))
      .map((colName) => [colName, excluded(columns[colName])]),
  );
}

// Constructs an object mapping column names to their `excluded` values,
// excluding the specified target columns from the mapping.
// This is useful for insert/update operations where you want to ignore
// certain columns (such as auto-generated or optional fields) that may
// otherwise be included with null values, preventing unintended overwrites.
export function excludedAutoFromInsert<
  Table extends PgTable,
  TableInsert extends Table["$inferInsert"] | Array<Table["$inferInsert"]>,
>(
  table: Table,
  targetColumns: PgColumn | PgColumn[],
  values: TableInsert | TableInsert[],
) {
  const targets = Array.isArray(targetColumns)
    ? targetColumns
    : [targetColumns];
  if (targets.length == 0) {
    return {};
  }
  const valueArray = Array.isArray(values) ? values : [values];
  if (valueArray.length == 0) {
    return {};
  }

  const columns = getTableColumns(table);
  return Object.fromEntries(
    Object.keys(valueArray[0])
      .filter(
        (colName) => columns[colName] && !targets.includes(columns[colName]),
      )
      .map((colName) => [colName, excluded(columns[colName])]),
  );
}

export function excludedAutoNonNullFromInsert<
  Table extends PgTable,
  TableInsert extends Table["$inferInsert"] | Array<Table["$inferInsert"]>,
>(
  table: Table,
  targetColumns: PgColumn | PgColumn[],
  values: TableInsert | TableInsert[],
) {
  const targets = Array.isArray(targetColumns)
    ? targetColumns
    : [targetColumns];
  if (targets.length == 0) {
    return {};
  }
  const valueArray = Array.isArray(values) ? values : [values];
  if (valueArray.length == 0) {
    return {};
  }

  const columns = getTableColumns(table);
  return Object.fromEntries(
    Object.keys(valueArray[0])
      .filter(
        (colName) => columns[colName] && !targets.includes(columns[colName]),
      )
      .map((colName) => [
        colName,
        sql`COALESCE(${excluded(columns[colName])}, ${columns[colName]})`,
      ]),
  );
}

export function sum<T extends PgColumn>(column: T): SQL<T["_"]["data"]> {
  return sql.raw(`SUM(${column.name})`);
}

export function coalesce<T>(...values: (SQL<T> | T)[]): SQL<T> {
  const joined = values.join(",");
  return sql.raw(`COALESCE(${joined})`) as SQL<T>;
}
