import { cds } from "@/util/carbon-theme";

type TxtSize = "sm" | "md" | "lg" | "xl" | "2xl";
type TxtProps = {
  size?: TxtSize;
  block?: boolean;
  secondary?: boolean;
  bold?: boolean;
  uppercase?: boolean;
  ellipsis?: boolean;
  width?: string | number;
};

const sizeFontSize: Record<TxtSize, number> = {
  sm: 0.5,
  md: 1,
  lg: 2,
  xl: 3,
  "2xl": 4,
};

export function Txt({
  bold,
  block,
  secondary,
  uppercase,
  ellipsis,
  width,
  children,
  size = "md",
}: React.PropsWithChildren<TxtProps>) {
  return (
    <span
      style={{
        textTransform: uppercase ? "uppercase" : undefined,
        fontWeight: bold ? "bold" : undefined,
        fontSize: `${sizeFontSize[size]}rem`,
        display: block ? "block" : undefined,
        color: secondary ? cds.textSecondary : cds.textPrimary,
        width,
        ...(ellipsis && {
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }),
      }}
    >
      {children}
    </span>
  );
}
