import React from "react";
import { BaseEdge, EdgeLabelRenderer } from "reactflow";
import type { EdgeProps } from "reactflow";

export type CurvedEdgeData = {
  amountText: string;
  color: string;
  labelOffset: number;
  parallelOffset: number;
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

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke: data?.color, strokeDasharray: "5 5", strokeWidth: 1.5, transition: "none" }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: "rgba(255, 255, 255, 0.92)",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 10,
            color: "#64748b",
            fontWeight: 500,
            fontFamily: "Inter, ui-sans-serif, sans-serif",
            border: "1px solid #e2e8f0",
            pointerEvents: "all",
            transition: "none"
          }}
          className="nodrag nopan"
        >
          {data?.amountText}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
