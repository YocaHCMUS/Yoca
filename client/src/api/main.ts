import type { AppType, ErrCode } from "@sv/main.js";
import { hc } from "hono/client";

const apiDomain = import.meta.env.VITE_CLIENT_API_DOMAIN;
console.log("api do: ", apiDomain);
const client = hc<AppType>(apiDomain, {
  init: {
    // Sending cookies on each request
    credentials: "include",
  },
});

export default client;
export type ApiErrCode = ErrCode;
