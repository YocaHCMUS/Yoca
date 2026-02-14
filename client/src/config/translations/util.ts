type ParamValue<K extends string> = K extends "count" ? number : string;

type ExtractFmtStrParams<T extends string> =
  T extends `${string}{{${infer Param}}}${infer Rest}`
    ? Param extends `${string}|${string}`
      ? ExtractFmtStrParams<Rest>
      : Param | ExtractFmtStrParams<Rest>
    : never;

export type FmtStrParams<F extends string> =
  ExtractFmtStrParams<F> extends infer Params
    ? [Params] extends [never]
      ? undefined
      : { [K in Params & string]: ParamValue<K> }
    : never;

type ShallowEqual<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

export type SameFmtParams<A extends string, B extends string> = ShallowEqual<
  ExtractFmtStrParams<A>,
  ExtractFmtStrParams<B>
>;

export type LitTransToShape<T> = T extends string
  ? string
  : T extends object
    ? { [K in keyof T]: LitTransToShape<T[K]> }
    : T;

export type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T]: T[K] extends object
    ? T[K] extends string
      ? `${Prefix}${K & string}`
      : DotPaths<T[K], `${Prefix}${K & string}.`>
    : `${Prefix}${K & string}`;
}[keyof T];

export type PathValue<
  T,
  P extends string,
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

export type ValidateTranslation<Base, Target> = Base extends string
  ? Target extends string
    ? SameFmtParams<Base, Target> extends true
      ? Target
      : never
    : never
  : Base extends object
    ? Target extends object
      ? {
          [K in keyof Base]: K extends keyof Target
            ? ValidateTranslation<Base[K], Target[K]>
            : never;
        } & {
          [K in Exclude<keyof Target, keyof Base>]: never;
        }
      : never
    : never;

export type LitToType<LitObj extends object> = {
  [Key in keyof LitObj]: LitObj[Key] extends string
    ? string
    : LitObj[Key] extends object
      ? LitToType<LitObj[Key]>
      : LitObj[Key];
};

export function defineTranslation<Base extends object>() {
  return <T>(t: T & ValidateTranslation<Base, T>): T => t;
}

type IsCorrect = "term | terms" extends `${string}|${string}` ? true : false;
