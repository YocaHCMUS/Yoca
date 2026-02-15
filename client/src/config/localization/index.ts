import { en, enNumFmtInfo } from "./en.ts";
import type { DotPaths, LitTransToShape } from "./util/util-translation.ts";
import { vi, viNumFmtInfo } from "./vi.ts";

export const locale = {
  en: {
    translation: en,
    format: {
      num: enNumFmtInfo,
    },
  },
  vi: {
    translation: vi,
    format: {
      num: viNumFmtInfo,
    },
  },
};

export type BaseTranslation = typeof en;
export type TranslationSchema = LitTransToShape<BaseTranslation>;
export type TranslationKeyPath = DotPaths<BaseTranslation>;

export type { NumberFormatInfo } from "./util/util-format.ts";
export type {
  FmtStrParams,
  PathValue,
  WithBase,
} from "./util/util-translation.ts";
