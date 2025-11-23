import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dbSchema from "./schema.js";
import "@util/load-env.js";
import "./gen-gql.js";

const client = postgres(process.env.POSTGRES_DB_URL!);
export const db = drizzle({ client, schema: dbSchema });
