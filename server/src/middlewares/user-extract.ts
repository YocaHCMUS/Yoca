import { setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses";
import { Next, type Context } from "hono";
import { UserPayload, userPayloadSchema } from "./validation";

async function getAuthPayload(c: Context) {
  const rawPayload = c.get("jwtPayload");
  const parsedPayload = userPayloadSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    return null;
  }
  return parsedPayload.data;
}

type UserEnv = {
  Variables: {
    userPayload: UserPayload;
  };
};

async function userExtract<E extends UserEnv>(c: Context<E>, next: Next) {
  const payload = await getAuthPayload(c);
  if (!payload) {
    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
  }
  c.set("userPayload", payload);
  await next();
}

export default userExtract;
