import { envSchema } from "@sv/middlewares/validation.js";
import { config } from "dotenv";
import z from "zod";

config({ path: "./.env" });

const envParseRes = envSchema.safeParse(process.env);

if (!envParseRes.success) {
  console.error("Environment validation failed:");
  console.error(z.treeifyError(envParseRes.error));
  process.exit(1);
}

const env = envParseRes.data;
export default env;
