const PREFIX = "[chat]";

function log(level: "info" | "warn" | "error" | "debug", msg: string, meta?: unknown): void {
  const ts = new Date().toISOString();
  const base = `${PREFIX} [${ts}] ${msg}`;
  switch (level) {
    case "error":
      console.error(base, meta ?? "");
      break;
    case "warn":
      console.warn(base, meta ?? "");
      break;
    case "debug":
      console.debug(base, meta ?? "");
      break;
    default:
      console.log(base, meta ?? "");
  }
}

export const chatInfo = (msg: string, meta?: unknown) => log("info", msg, meta);
export const chatWarn = (msg: string, meta?: unknown) => log("warn", msg, meta);
export const chatError = (msg: string, meta?: unknown) => log("error", msg, meta);
export const chatDebug = (msg: string, meta?: unknown) => log("debug", msg, meta);
