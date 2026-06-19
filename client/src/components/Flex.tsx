import classNames from "classnames";
import { type CSSProperties, type HTMLAttributes } from "react";

type FlexDir = "row" | "column";
type FlexAlign = "start" | "center" | "end" | "stretch" | "baseline";
type FlexJustify = "start" | "center" | "end" | "between" | "around" | "evenly";
type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";
type Spacing = number | string;

interface FlexProps extends HTMLAttributes<HTMLDivElement> {
  dir?: FlexDir;
  align?: FlexAlign;
  justify?: FlexJustify;
  wrap?: FlexWrap;
  gap?: Spacing;
  rowGap?: Spacing;
  colGap?: Spacing;
  p?: Spacing;
  pBlock?: Spacing;
  pInline?: Spacing;
  px?: Spacing;
  py?: Spacing;
  pBlockStart?: Spacing;
  pBlockEnd?: Spacing;
  pInlineStart?: Spacing;
  pInlineEnd?: Spacing;
  m?: Spacing;
  mBlock?: Spacing;
  mInline?: Spacing;
  mBlockStart?: Spacing;
  mBlockEnd?: Spacing;
  mInlineStart?: Spacing;
  mInlineEnd?: Spacing;
  inlineSize?: CSSProperties["inlineSize"];
  minInlineSize?: CSSProperties["minInlineSize"];
  maxBlockSize?: CSSProperties["maxBlockSize"];
  inline?: boolean;
}

function toSpacingValue(value?: Spacing): string | undefined {
  if (value == null) return undefined;
  return typeof value == "number" ? `${value * 0.125}rem` : value;
}

function mapAlign(value?: FlexAlign): CSSProperties["alignItems"] {
  if (value == "start") return "flex-start";
  if (value == "end") return "flex-end";
  return value;
}

function mapJustify(value?: FlexJustify): CSSProperties["justifyContent"] {
  if (value == "start") return "flex-start";
  if (value == "end") return "flex-end";
  if (value == "between") return "space-between";
  if (value == "around") return "space-around";
  if (value == "evenly") return "space-evenly";
  return value;
}

export function Flex({
  dir = "row",
  align,
  justify,
  wrap,
  gap,
  rowGap,
  colGap,
  p,
  pBlock,
  pInline,
  px,
  py,
  pBlockStart,
  pBlockEnd,
  pInlineStart,
  pInlineEnd,
  m,
  mBlock,
  mInline,
  mBlockStart,
  mBlockEnd,
  mInlineStart,
  mInlineEnd,
  inlineSize,
  minInlineSize,
  maxBlockSize,
  inline = false,
  className,
  style,
  children,
  ...rest
}: FlexProps) {
  const gapValue = toSpacingValue(gap);
  const rowGapValue = toSpacingValue(rowGap);
  const colGapValue = toSpacingValue(colGap);

  const paddingBlockValue = toSpacingValue(py ?? pBlock ?? p);
  const paddingInlineValue = toSpacingValue(px ?? pInline ?? p);
  const paddingBlockStartValue = toSpacingValue(pBlockStart);
  const paddingBlockEndValue = toSpacingValue(pBlockEnd);
  const paddingInlineStartValue = toSpacingValue(pInlineStart);
  const paddingInlineEndValue = toSpacingValue(pInlineEnd);

  const marginBlockValue = toSpacingValue(mBlock ?? m);
  const marginInlineValue = toSpacingValue(mInline ?? m);
  const marginBlockStartValue = toSpacingValue(mBlockStart);
  const marginBlockEndValue = toSpacingValue(mBlockEnd);
  const marginInlineStartValue = toSpacingValue(mInlineStart);
  const marginInlineEndValue = toSpacingValue(mInlineEnd);

  const resolvedStyle: CSSProperties = {
    display: inline ? "inline-flex" : "flex",
    flexDirection: dir,
    alignItems: mapAlign(align),
    justifyContent: mapJustify(justify),
    flexWrap: wrap,
    gap: gapValue,
    rowGap: rowGapValue ?? gapValue,
    columnGap: colGapValue ?? gapValue,
    paddingBlock: paddingBlockValue,
    paddingInline: paddingInlineValue,
    paddingTop: paddingBlockStartValue ?? paddingBlockValue,
    paddingBottom: paddingBlockEndValue ?? paddingBlockValue,
    paddingLeft: paddingInlineStartValue ?? paddingInlineValue,
    paddingRight: paddingInlineEndValue ?? paddingInlineValue,
    paddingBlockStart: paddingBlockStartValue,
    paddingBlockEnd: paddingBlockEndValue,
    paddingInlineStart: paddingInlineStartValue,
    paddingInlineEnd: paddingInlineEndValue,
    marginBlock: marginBlockValue,
    marginInline: marginInlineValue,
    marginTop: marginBlockStartValue ?? marginBlockValue,
    marginBottom: marginBlockEndValue ?? marginBlockValue,
    marginLeft: marginInlineStartValue ?? marginInlineValue,
    marginRight: marginInlineEndValue ?? marginInlineValue,
    marginBlockStart: marginBlockStartValue,
    marginBlockEnd: marginBlockEndValue,
    marginInlineStart: marginInlineStartValue,
    marginInlineEnd: marginInlineEndValue,
    inlineSize,
    minInlineSize,
    maxBlockSize,
    ...style,
  };

  return (
    <div className={classNames(className)} style={resolvedStyle} {...rest}>
      {children}
    </div>
  );
}
