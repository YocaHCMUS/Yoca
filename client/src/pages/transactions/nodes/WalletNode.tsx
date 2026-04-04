import React from "react";
import { Handle, Position } from "reactflow";

export type WalletNodeData = {
  address: string;
  shortAddress: string;
  isSigner: boolean;
};

export function WalletNode({ data }: { data: WalletNodeData }) {
  const { isSigner, shortAddress } = data;

  return (
    <div
      style={{
        width: 160,
        backgroundColor: isSigner ? "#fff7ed" : "#ffffff",
        border: `1px solid ${isSigner ? "#f97316" : "#cbd5e1"}`,
        borderWidth: isSigner ? 2 : 1,
        borderRadius: 10,
        boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
        padding: isSigner ? "12px 0" : "15px 0",
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
