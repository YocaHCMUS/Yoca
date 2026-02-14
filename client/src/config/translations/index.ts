import { en } from "./en.ts";
import type { DotPaths } from "./util.ts";
import { vi } from "./vi.ts";

export const translations = {
  en,
  vi,
};
export type Schema = typeof en;
export type KeyPath = DotPaths<Schema>;
export type { FmtStrParams, PathValue } from "./util.ts";
