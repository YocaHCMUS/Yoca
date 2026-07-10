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
  isCurved?: boolean;
  /** Current replay step (undefined = show all normally) */
  playStep?: number | null;
  /** Total steps (for knowing when replay is done) */
  totalSteps?: number;
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
  const { hoveredToken, setHoveredToken, hoveredPair, hoveredAddress } = useContext(HoverContext);

  const seqNo = parseInt(data?.sequenceText ?? "0", 10);
  const playStep = data?.playStep;
  const isPlayMode = playStep != null;

  // In play mode: hide future steps, animate current step
  const isFutureStep = isPlayMode && seqNo > playStep!;
  const isCurrentStep = isPlayMode && seqNo === playStep!;
  const isPastStep = isPlayMode && seqNo < playStep!;

  if (isFutureStep) return null; // Don't render future edges at all

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  const isCurved = data?.isCurved ?? false;
  const parallelOffset = data?.parallelOffset ?? 0;
  const normalizedShift = Math.max(-0.28, Math.min(0.28, data?.labelShift ?? 0));

  let edgePath: string;
  let labelX: number;
  let labelY: number;
  let arrowX: number;
  let arrowY: number;
  let arrowAngle: number;

  if (isCurved || parallelOffset !== 0) {
    const bowAmount = parallelOffset !== 0 ? parallelOffset * 1.35 : Math.min(length * 0.22, 104);
    const cx = (sourceX + targetX) / 2 + nx * bowAmount;
    const cy = (sourceY + targetY) / 2 + ny * bowAmount;
    edgePath = `M ${sourceX},${sourceY} Q ${cx},${cy} ${targetX},${targetY}`;

    const lt = 0.5 + normalizedShift;
    labelX = (1 - lt) * (1 - lt) * sourceX + 2 * (1 - lt) * lt * cx + lt * lt * targetX;
    labelY = (1 - lt) * (1 - lt) * sourceY + 2 * (1 - lt) * lt * cy + lt * lt * targetY;

    arrowX = targetX;
    arrowY = targetY;
    const tanX = targetX - cx;
    const tanY = targetY - cy;
    arrowAngle = Math.atan2(tanY, tanX) * (180 / Math.PI);
  } else {
    edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
    const lt = 0.45 + normalizedShift * 0.6;
    labelX = sourceX + dx * lt;
    labelY = sourceY + dy * lt;
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

  // Play-mode styling
  let strokeColor: string;
  let opacity: number;
  let strokeWidth: number;
  let arrowSize: number;
  let pathStyle: React.CSSProperties = {};

  if (isCurrentStep) {
    // Active step: bright, thick, animated draw
    strokeColor = baseColor;
    opacity = 1;
    strokeWidth = 2.8;
    arrowSize = 7;
    pathStyle = {
      strokeDasharray: 1000,
      strokeDashoffset: 0,
      animation: "drawEdge 0.55s ease-out forwards",
    };
  } else if (isPastStep) {
    // Already played: show dimmed
    strokeColor = baseColor;
    opacity = 0.35;
    strokeWidth = 1.2;
    arrowSize = 5;
  } else {
    // Normal (no play mode)
    strokeColor = isDimmed ? "#e5e7eb" : baseColor;
    opacity = isDimmed ? 0.35 : 1;
    strokeWidth = isHovered ? 2.5 : 1.2;
    arrowSize = isHovered ? 6 : 5;
  }

  return (
    <>
      {/* Path */}
      <path
        key={isCurrentStep ? `active-${id}` : id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isCurrentStep ? 1000 : (isPlayMode ? "none" : "3 4")}
        strokeLinecap="round"
        opacity={opacity}
        style={{
          transition: isPlayMode ? "none" : "opacity 0.2s, stroke 0.2s, stroke-width 0.2s",
          ...(isCurrentStep ? pathStyle : {}),
        }}
      />

      {/* Arrow head */}
      <g
        transform={`translate(${arrowX},${arrowY}) rotate(${arrowAngle})`}
        opacity={opacity}
      >
        <polygon
          points={`0,0 ${-arrowSize * 2},${-arrowSize} ${-arrowSize * 2},${arrowSize}`}
          fill={strokeColor}
        />
      </g>

      {/* Pill label */}
      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHoveredToken(data?.tokenAddress || null)}
          onMouseLeave={() => setHoveredToken(null)}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: isCurrentStep ? baseColor : "#fff",
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "Inter, ui-sans-serif, sans-serif",
            border: `1.5px solid ${isCurrentStep ? baseColor : (isHovered ? strokeColor : (isDimmed ? "#f3f4f6" : "#e5e7eb"))}`,
            pointerEvents: "all",
            zIndex: isCurrentStep ? 200 : isHovered ? 100 : 0,
            opacity: isPastStep ? 0.4 : (isDimmed ? 0.35 : 1),
            boxShadow: isCurrentStep
              ? `0 0 0 3px ${baseColor}33, 0 4px 12px rgba(0,0,0,0.15)`
              : isHovered ? "0 2px 5px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            gap: 5,
            whiteSpace: "nowrap",
            color: isCurrentStep ? "#fff" : (isDimmed ? "#d0d4da" : baseColor),
            transition: isPlayMode ? "none" : "opacity 0.2s, border-color 0.2s, box-shadow 0.2s",
            animation: isCurrentStep ? "fadeInScale 0.3s ease-out" : "none",
          }}
          className="nodrag nopan"
        >
          <span style={{ fontWeight: 600 }}>{data?.amountText}</span>
          <span style={{ fontWeight: 600 }}>{data?.symbolText}</span>
          <span style={{
            color: isCurrentStep ? "rgba(255,255,255,0.7)" : (isDimmed ? "#e0e0e0" : "#b0b8c4"),
            fontSize: 10, fontWeight: 600,
          }}>
            [{data?.sequenceText}]
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
