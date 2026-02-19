import * as en from "./en.ts";
import type { DotPaths, LitTransToShape } from "./util/util-translation.ts";
import * as vi from "./vi.ts";

export const locale = {
  en,
  vi,
};

export type LangKeys = keyof typeof locale;
export type BaseTranslation = typeof en.translation;
export type TranslationSchema = LitTransToShape<BaseTranslation>;
export type TranslationKeyPath = DotPaths<BaseTranslation>;

export type {
  FmtStrParams,
  PathValue,
  WithBase,
} from "./util/util-translation.ts";
