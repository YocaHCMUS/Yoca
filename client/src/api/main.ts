import { hc } from "hono/client";
import type { AppType, ErrCode } from "@sv/main.js";

const apiDomain: string = import.meta.env.VITE_CLIENT_API_DOMAIN || "";

const client = hc<AppType>(apiDomain, {
  init: { credentials: "include" },
});

export default client;
export type ApiErrCode = ErrCode;
