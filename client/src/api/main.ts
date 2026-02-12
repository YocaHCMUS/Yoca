import { hc } from "hono/client";
import type { AppType } from "@sv/main.js";
const apiDomain: string = import.meta.env.CLIENT_API_DOMAIN;
const client = hc<AppType>(apiDomain);

export default client;
// client.api.users.signin.$post()