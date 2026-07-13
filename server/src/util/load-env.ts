import { envSchema } from "@sv/config/env-schema.js";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../..");
const workspaceRoot = path.resolve(serverRoot, "..");

const candidateEnvPaths = [
  path.join(serverRoot, ".env"),
  path.join(workspaceRoot, ".env"),
  path.resolve(".env"),
];

const envPath = candidateEnvPaths.find((candidatePath) =>
  existsSync(candidatePath),
);

config(envPath ? { path: envPath } : undefined);

const envParseRes = envSchema.safeParse(process.env);

if (!envParseRes.success) {
  console.error("Environment validation failed. Required variables missing:");
  for (const issue of envParseRes.error.issues) {
    console.error("  - %s: %s", issue.path.join("."), issue.message);
  }
  console.error("Server will start but some features may be unavailable.");
  process.exit(1);
}

const env = envParseRes.data;
export default env;
