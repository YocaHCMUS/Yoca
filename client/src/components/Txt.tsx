import { cds } from "@/util/carbon-theme";
import classNames from "classnames";
import { type CSSProperties, type PropsWithChildren } from "react";

type TxtSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type TxtTone = "primary" | "secondary";
type TxtWeight = "regular" | "medium" | "semibold" | "bold";
type TxtProps = {
  size?: TxtSize;
  block?: boolean;
  stretch?: boolean;
  secondary?: boolean;
  bold?: boolean;
  tone?: TxtTone;
  weight?: TxtWeight;
  align?: TxtAlign;
  uppercase?: boolean;
  ellipsis?: boolean;
  mono?: boolean;
  width?: string | number;
  className?: string;
  style?: CSSProperties;
};

const sizeFontSize: Record<TxtSize, number> = {
  xs: 0.5,
  sm: 0.75,
  md: 1,
  lg: 2,
  xl: 3,
  "2xl": 4,
};

type TxtAlign = "start" | "center" | "end";

const weightValue: Record<TxtWeight, CSSProperties["fontWeight"]> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export function Txt({
  bold,
  block,
  stretch,
  secondary,
  tone,
  weight,
  uppercase,
  ellipsis,
  mono,
  width,
  children,
  align,
  className,
  style,
  size = "md",
}: PropsWithChildren<TxtProps>) {
  const resolvedWeight = bold ? "bold" : weight;
  const resolvedTone: TxtTone = tone || (secondary ? "secondary" : "primary");

  return (
    <span
      className={classNames(className)}
      style={{
        textTransform: uppercase ? "uppercase" : undefined,
        fontWeight: resolvedWeight ? weightValue[resolvedWeight] : undefined,
        fontSize: `${sizeFontSize[size]}rem`,
        display: block ? "block" : stretch ? "inline-block" : undefined,
        color:
          resolvedTone == "secondary" ? cds.textSecondary : cds.textPrimary,
        width: stretch ? "100%" : width,
        fontFamily: mono ? "monospace" : undefined,
        ...(ellipsis && {
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }),
        textAlign: align,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
