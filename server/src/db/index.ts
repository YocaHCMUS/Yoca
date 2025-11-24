import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { relations } from "./relations.js";

const client = postgres(process.env.POSTGRES_DB_URL!);
export const db = drizzle({ client, relations });
