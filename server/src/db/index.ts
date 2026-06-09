// import { Storage } from "@sv/services/storage.js";
// import { DefaultLogger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dbSchema from "./schema";

const client = postgres(process.env.POSTGRES_DB_URL!, {
  max: 10,            // Tối đa 10 connections (dưới pool_size: 15 của Supabase session mode)
  idle_timeout: 30,   // Đóng connection nhàn rỗi sau 30s
  connect_timeout: 10, // Timeout nếu không kết nối được sau 10s
  max_lifetime: 1800, // Tái sử dụng connection tối đa 30 phút
});
export const db = drizzle({
  client,
  schema: dbSchema,
  // logger: isSqlLoggingEnabled() ? logger : undefined,
});
