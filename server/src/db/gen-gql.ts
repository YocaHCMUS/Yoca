import { buildSchema } from "drizzle-graphql";
import { db } from "./index.js";
import { printSchema } from "graphql";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Storage } from "@services/storage.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

const genSchema = buildSchema(db);

export const graphqlSchema = genSchema.schema;

const graphqlSchemaLocation = join(currentDir, "schema.gql");

Storage.saveText(graphqlSchemaLocation, printSchema(graphqlSchema));
