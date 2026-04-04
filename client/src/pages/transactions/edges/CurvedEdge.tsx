import React, { useContext } from "react";
import { BaseEdge, EdgeLabelRenderer } from "reactflow";
import type { EdgeProps } from "reactflow";
import { HoverContext } from "../TransactionGraphDemo";

export type CurvedEdgeData = {
  amountText: string;
  color: string;
  labelOffset: number;
  parallelOffset: number;
  tokenAddress: string;
};

export function CurvedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps<CurvedEdgeData>) {
  const { hoveredToken, setHoveredToken } = useContext(HoverContext);
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  const bowOutOffset = data?.parallelOffset ? 40 : 0; // 40px control point = 20px actual visual bow out at center
  
  let edgePath = "";
  let labelX = 0;
  let labelY = 0;

  if (bowOutOffset === 0) {
    // Perfectly straight line
    edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
    const offset = data?.labelOffset ?? 0.5;
    labelX = sourceX + (targetX - sourceX) * offset;
    labelY = sourceY + (targetY - sourceY) * offset;
  } else {
    // Sleek curved path for separating A->B and B->A uniquely
    const cx = (sourceX + targetX) / 2 + nx * bowOutOffset;
    const cy = (sourceY + targetY) / 2 + ny * bowOutOffset;
    edgePath = `M ${sourceX},${sourceY} Q ${cx},${cy} ${targetX},${targetY}`;
    // Center label on the quadratic curve
    labelX = 0.25 * sourceX + 0.5 * cx + 0.25 * targetX;
    labelY = 0.25 * sourceY + 0.5 * cy + 0.25 * targetY;
  }

  const isHovered = hoveredToken && hoveredToken === data?.tokenAddress;
  const isDimmed = hoveredToken && hoveredToken !== data?.tokenAddress;

  const strokeColor = isHovered ? "#16a34a" : (isDimmed ? "#e2e8f0" : data?.color);
  const strokeWidth = isHovered ? 1.8 : 1.5;
  const strokeDasharray = isHovered ? "none" : "5 5";

  // Rebuild the custom marker so it turns solid green on hover
  const markerUrl = `url(#arrow-${id}-${isHovered ? "active" : "dim"})`;

  return (
    <>
      <defs>
        <marker
          id={`arrow-${id}-${isHovered ? "active" : "dim"}`}
          markerWidth="16"
          markerHeight="16"
          viewBox="-10 -10 20 20"
          orient="auto-start-reverse"
          refX="0"
          refY="0"
        >
          <polygon points="-5,-4 1,0 -5,4" fill={strokeColor} />
        </marker>
      </defs>
      
      <BaseEdge
        path={edgePath}
        markerEnd={markerUrl}
        style={{ ...style, stroke: strokeColor, strokeDasharray, strokeWidth, transition: "none" }}
      />
      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHoveredToken(data?.tokenAddress || null)}
          onMouseLeave={() => setHoveredToken(null)}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: "rgba(255, 255, 255, 0.95)",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 10,
            color: isHovered ? "#1e293b" : (isDimmed ? "#94a3b8" : "#64748b"),
            fontWeight: isHovered ? 600 : 500,
            fontFamily: "Inter, ui-sans-serif, sans-serif",
            border: `1px solid ${isHovered ? "#3b82f6" : (isDimmed ? "#f1f5f9" : "#e2e8f0")}`,
            pointerEvents: "all",
            transition: "none",
            zIndex: isHovered ? 100 : 0,
            boxShadow: isHovered ? "0 0 0 1px #3b82f6, 0 4px 12px rgba(59, 130, 246, 0.15)" : "0 1px 3px rgba(0,0,0,0.05)",
          }}
          className="nodrag nopan"
        >
          {data?.amountText}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
