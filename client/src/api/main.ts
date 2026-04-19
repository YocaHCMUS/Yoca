import type { AppType, ErrCode } from "@sv/main.js";
import { hc } from "hono/client";

// Prefer explicit API domain, otherwise use same-origin (works well with Vite proxy + ngrok).
const apiDomain = import.meta.env.VITE_CLIENT_API_DOMAIN || window.location.origin;
const client = hc<AppType>(apiDomain, {
  init: {
    // Sending cookies on each request
    credentials: "include",
  },
});

export default client;
export type ApiErrCode = ErrCode;
