import { ErrCode } from "@sv/config/errors";
import type { Context } from "hono";
import { statusCode } from "./responses";

export function setErr<T extends ErrCode>(code: T) {
  return { errorCode: code };
}

export function serverErr(c: Context, e: unknown) {
  console.error(e);
  return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
}
