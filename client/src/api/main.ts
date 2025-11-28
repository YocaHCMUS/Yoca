import { hc } from "hono/client";
import type { AppType } from "@server/main.js";

const apiDomain: string = import.meta.env.CLIENT_API_DOMAIN;
export const api = hc<AppType>(apiDomain).api;
