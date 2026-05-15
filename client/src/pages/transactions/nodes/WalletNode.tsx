import React, { useContext, useState } from "react";
import { useNavigate } from "react-router";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { HoverContext } from "../shared/HoverContext";

type WalletNodeData = {
  address: string;
  shortAddress: string;
  isSigner: boolean;
  activeTokens: string[];
  label?: string | null;
  labelColor?: string;
  labelIcon?: string;
};

export function WalletNode({ data }: NodeProps<WalletNodeData>) {
  const { hoveredToken, hoveredPair, hoveredAddress, setHoveredAddress } = useContext(HoverContext);
  const navigate = useNavigate();
  const [showCopied, setShowCopied] = useState(false);

  const isActiveToken = hoveredToken && data.activeTokens.includes(hoveredToken);
  const isActivePair = hoveredPair && hoveredPair.includes(data.address);
  const isActiveSelf = hoveredAddress === data.address;
  const isActive = isActiveToken || isActivePair || isActiveSelf;
  const isDimmed = (hoveredToken || hoveredPair || hoveredAddress) && !isActive;

  const borderColor = isActive
    ? "#3b82f6"
    : data.isSigner
    ? "#10b981"
    : isDimmed
    ? "#f1f5f9"
    : "#e5e7eb";

  const bgColor = isDimmed ? "#fafbfc" : "#ffffff";
  const labelTextColor = isDimmed ? "#d1d5db" : "#6b7280";

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(data.address);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 1200);
  };

  return (
    <>
      {/* Left handles */}
      <Handle type="source" id="source-left" position={Position.Left} style={handleStyle} />
      <Handle type="target" id="target-left" position={Position.Left} style={handleStyle} />
      <Handle type="source" id="source-top" position={Position.Top} style={handleStyle} />
      <Handle type="target" id="target-top" position={Position.Top} style={handleStyle} />

      {/* Container with fixed card height; top labels are absolute to keep nodes aligned */}
      <div style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        opacity: isDimmed ? 0.4 : 1,
        transition: "opacity 0.15s",
      }}>
        {/* Floating label above (absolute, doesn't change node bbox/handle center) */}
        {data.isSigner && (
          <div style={{
            position: "absolute",
            top: -18,
            left: 2,
            display: "flex",
            alignItems: "center",
            gap: 4,
            pointerEvents: "none",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#10b981", display: "inline-block",
            }} />
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: "#10b981",
            }}>
              Signer
            </span>
          </div>
        )}
        {data.label && !data.isSigner && (
          <div style={{
            position: "absolute",
            top: -18,
            left: 2,
            display: "flex",
            alignItems: "center",
            gap: 4,
            pointerEvents: "none",
          }}>
            {data.labelIcon && (
              <span style={{ fontSize: 12 }}>{data.labelIcon}</span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: data.labelColor || "#f59e0b",
            }}>
              {data.label}
            </span>
          </div>
        )}

        {/* Node card */}
        <div
          onClick={() => navigate(`/wallets/${data.address}`)}
          onMouseEnter={() => setHoveredAddress(data.address)}
          onMouseLeave={() => setHoveredAddress(null)}
          title={data.address}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            borderRadius: 8,
            border: `1.5px solid ${borderColor}`,
            background: bgColor,
            cursor: "pointer",
            boxShadow: isActive
              ? "0 0 0 3px rgba(59,130,246,0.25)"
              : "0 1px 3px rgba(0,0,0,0.04)",
            transition: "box-shadow 0.15s, border-color 0.15s",
          }}
        >
          {/* Wallet icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke={data.isSigner ? "#10b981" : "#9ca3af"}
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               style={{ flexShrink: 0 }}>
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
            <path d="M16 14h.01" />
          </svg>

          <code style={{
            fontSize: 11,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            color: isDimmed ? "#c0c4cc" : "#374151",
            fontWeight: 400,
            letterSpacing: "0.01em",
          }}>
            {data.shortAddress}
          </code>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            title="Copy address"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              opacity: 0.4,
            }}
          >
            {showCopied ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Right handles */}
      <Handle type="source" id="source-right" position={Position.Right} style={handleStyle} />
      <Handle type="target" id="target-right" position={Position.Right} style={handleStyle} />
      <Handle type="source" id="source-bottom" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" id="target-bottom" position={Position.Bottom} style={handleStyle} />
    </>
  );
}

const handleStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  background: "transparent",
  border: "none",
};
