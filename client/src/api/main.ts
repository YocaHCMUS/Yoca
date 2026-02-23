import type { AppType } from "@sv/main.js";
import { hc } from "hono/client";
const apiDomain = import.meta.env.VITE_CLIENT_API_DOMAIN!;
console.log("Api domain: ", apiDomain);
const client = hc<AppType>(apiDomain, {
  init: {
    // Sending cookies on each request
    credentials: "include",
  },
});

export default client;
