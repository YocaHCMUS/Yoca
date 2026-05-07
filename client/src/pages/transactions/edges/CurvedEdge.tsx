import { useContext } from "react";
import type { EdgeProps } from "reactflow";
import { EdgeLabelRenderer } from "reactflow";
import { HoverContext } from "../shared/HoverContext";

export type CurvedEdgeData = {
  sequenceText: string;
  amountText: string;
  symbolText: string;
  color: string;
  parallelOffset: number;
  labelShift?: number;
  tokenAddress: string;
  pairKey: string;
  isCurved?: boolean; // true = arc, false = straight
};

export function CurvedEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<CurvedEdgeData>) {
  const { hoveredToken, setHoveredToken, hoveredPair, setHoveredPair, hoveredAddress } = useContext(HoverContext);

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  const isCurved = data?.isCurved ?? false;
  const parallelOffset = data?.parallelOffset ?? 0;
  const normalizedShift = Math.max(-0.28, Math.min(0.28, data?.labelShift ?? 0));

  // Build the path
  let edgePath: string;
  let labelX: number;
  let labelY: number;
  let arrowX: number;
  let arrowY: number;
  let arrowAngle: number;

  if (isCurved || parallelOffset !== 0) {
    // Curved: use quadratic Bézier
    const bowAmount = parallelOffset !== 0 ? parallelOffset * 1.35 : Math.min(length * 0.22, 104);
    const cx = (sourceX + targetX) / 2 + nx * bowAmount;
    const cy = (sourceY + targetY) / 2 + ny * bowAmount;
    edgePath = `M ${sourceX},${sourceY} Q ${cx},${cy} ${targetX},${targetY}`;

    // Label at the middle of the curve
    const lt = 0.5 + normalizedShift;
    labelX = (1 - lt) * (1 - lt) * sourceX + 2 * (1 - lt) * lt * cx + lt * lt * targetX;
    labelY = (1 - lt) * (1 - lt) * sourceY + 2 * (1 - lt) * lt * cy + lt * lt * targetY;

    // Arrow exactly at the end of the curve (t=1.0)
    arrowX = targetX;
    arrowY = targetY;
    const tanX = targetX - cx;
    const tanY = targetY - cy;
    arrowAngle = Math.atan2(tanY, tanX) * (180 / Math.PI);
  } else {
    // Straight line
    edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;

    // Label in the middle
    const lt = 0.45 + normalizedShift * 0.6;
    labelX = sourceX + dx * lt;
    labelY = sourceY + dy * lt;

    // Arrow exactly at the end
    arrowX = targetX;
    arrowY = targetY;
    arrowAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  }

  const isHoveredToken = hoveredToken && hoveredToken === data?.tokenAddress;
  const isHoveredPair = hoveredPair && hoveredPair === data?.pairKey;
  const isHoveredAddress = hoveredAddress && (source === hoveredAddress || target === hoveredAddress);
  const isHovered = isHoveredToken || isHoveredPair || isHoveredAddress;
  const isDimmed = (hoveredToken || hoveredPair || hoveredAddress) && !isHovered;
  const baseColor = data?.color ?? "#94a3b8";

  const strokeColor = isDimmed ? "#e5e7eb" : baseColor;
  // Never default to 0.5 opacity. If dimmed, make it slightly transparent, else full opacity.
  const opacity = isDimmed ? 0.35 : 1;
  const strokeWidth = isHovered ? 2.5 : 1.2;
  const arrowSize = isHovered ? 6 : 5;

  return (
    <>
      {/* Path */}
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isHovered ? "none" : "3 4"}
        strokeLinecap="round"
        opacity={opacity}
        style={{ transition: "opacity 0.2s, stroke 0.2s, stroke-width 0.2s" }}
      />

      {/* Arrow head at end */}
      <g
        transform={`translate(${arrowX},${arrowY}) rotate(${arrowAngle})`}
        opacity={opacity}
        style={{ transition: "opacity 0.2s" }}
      >
        <polygon
          points={`0,0 ${-arrowSize * 2},${-arrowSize} ${-arrowSize * 2},${arrowSize}`}
          fill={strokeColor}
        />
      </g>

      {/* Pill label near source */}
      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHoveredToken(data?.tokenAddress || null)}
          onMouseLeave={() => setHoveredToken(null)}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: "#fff",
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "Inter, ui-sans-serif, sans-serif",
            border: `1.5px solid ${isHovered ? strokeColor : (isDimmed ? "#f3f4f6" : "#e5e7eb")}`,
            pointerEvents: "all",
            zIndex: isHovered ? 100 : 0,
            opacity: isDimmed ? 0.35 : 1,
            boxShadow: isHovered ? "0 2px 5px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            gap: 5,
            whiteSpace: "nowrap",
            color: isDimmed ? "#d0d4da" : baseColor,
            transition: "opacity 0.2s, border-color 0.2s, box-shadow 0.2s",
          }}
          className="nodrag nopan"
        >
          <span style={{ fontWeight: 600 }}>{data?.amountText}</span>
          <span style={{ fontWeight: 600 }}>{data?.symbolText}</span>
          <span style={{
            color: isDimmed ? "#e0e0e0" : "#b0b8c4",
            fontSize: 10, fontWeight: 600,
          }}>
            [{data?.sequenceText}]
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
