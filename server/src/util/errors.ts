import { ErrCode } from "@sv/config/errors";
import type { Context } from "hono";
import { statusCode } from "./responses";

export function setErr<T extends ErrCode>(code: T) {
  return { errorCode: code };
}

export class UpstreamError extends Error {
  readonly provider: string;
  readonly upstreamStatus: number;

  constructor(provider: string, upstreamStatus: number, message?: string) {
    super(message ?? `${provider} upstream request failed`);
    this.name = "UpstreamError";
    this.provider = provider;
    this.upstreamStatus = upstreamStatus;
  }
}

export function serverErr(
  c: Context,
  e: unknown,
  serverMessage: string = "Server error: ",
) {
  console.error(serverMessage, e);
  if (
    e instanceof UpstreamError ||
    (e && typeof e === "object" && (e as Error).name === "UpstreamError")
  ) {
    return c.json(setErr("BAD_GATEWAY"), statusCode.BadGateway);
  }
  return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
}
