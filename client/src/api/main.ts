import type { AppType } from "@sv/main.js";
import { hc } from "hono/client";
const apiDomain: string = import.meta.env.CLIENT_API_DOMAIN;
export const client = hc<AppType>(apiDomain);
