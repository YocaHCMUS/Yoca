import React, { useContext } from "react";
import { Handle, Position } from "reactflow";
import { HoverContext } from "../TransactionGraphDemo";

export type WalletNodeData = {
  address: string;
  shortAddress: string;
  isSigner: boolean;
  activeTokens: string[];
};

export function WalletNode({ data }: { data: WalletNodeData }) {
  const { isSigner, shortAddress, activeTokens } = data;
  
  // Note: HoverContext provides hoveredToken
  const hoverContext = useContext(HoverContext);
  const hoveredToken = hoverContext?.hoveredToken;

  const isHighlighted = hoveredToken && activeTokens?.includes(hoveredToken);

  return (
    <div
      style={{
        position: "relative",
        width: 160,
        backgroundColor: isSigner ? "#fff7ed" : "#ffffff",
        border: `1px solid ${isHighlighted ? "#3b82f6" : (isSigner ? "#f97316" : "#cbd5e1")}`,
        borderRadius: 8,
        boxShadow: isHighlighted ? "0 0 0 1px #3b82f6, 0 4px 12px rgba(59, 130, 246, 0.15)" : "0 3px 8px rgba(0,0,0,0.06)",
        padding: "14px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#1e293b",
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "Inter, ui-sans-serif, sans-serif",
      }}
    >
      <Handle type="target" position={Position.Left} id="target-left" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="source-left" style={{ opacity: 0 }} />
      
      {isSigner && (
        <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 11, color: '#f97316' }}>
          <span style={{ fontSize: 8, marginRight: 4, verticalAlign: "middle" }}>●</span>
          Signer
        </div>
      )}
      
      <div>{shortAddress}</div>

      <Handle type="target" position={Position.Right} id="target-right" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="source-right" style={{ opacity: 0 }} />
    </div>
  );
}
