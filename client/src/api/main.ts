import type { AppType } from "@sv/main.js";
import { hc } from "hono/client";
const apiDomain: string = import.meta.env.CLIENT_API_DOMAIN;
const client = hc<AppType>(apiDomain, {
  init: {
    // Sending cookies on each request
    credentials: "include",
  },
});

export default client;
