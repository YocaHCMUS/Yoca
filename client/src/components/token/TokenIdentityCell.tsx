import { TknImg } from "../TknImg";

export type TooltipAlign = "top" | "bottom" | "left" | "right";

export interface TokenIdentityCellProps {
  symbol: string;
  fullName?: string | null;
  imageUrl?: string | null;
  imageSize?: number;
  tooltipAlign?: TooltipAlign;
  emphasizeSymbol?: boolean;
}

export function TokenIdentityCell({
  symbol,
  fullName,
  imageUrl,
  imageSize = 30,
  tooltipAlign = "right",
  emphasizeSymbol = false,
}: TokenIdentityCellProps): React.ReactElement {
  const normalizedSymbol = symbol?.trim().toUpperCase() || "UNKNOWN";
  const tooltipLabel = fullName?.trim() || normalizedSymbol;

  return (
    <span
      title={tooltipLabel}
      data-tooltip-align={tooltipAlign}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, verticalAlign: "middle" }}
    >
      <TknImg src={imageUrl || null} alt={normalizedSymbol} size={imageSize} />
      {emphasizeSymbol ? <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{normalizedSymbol}</strong> : <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{normalizedSymbol}</span>}
    </span>
  );
}

export default TokenIdentityCell;
