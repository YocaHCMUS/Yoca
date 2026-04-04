import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import type { InferResponseType } from "hono/client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

export const HoverContext = React.createContext<{
  hoveredToken: string | null;
  setHoveredToken: React.Dispatch<React.SetStateAction<string | null>>;
}>({ hoveredToken: null, setHoveredToken: () => {} });
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  useEdgesState,
  useNodesState,
} from "reactflow";
import type { Edge, Node } from "reactflow";
import "reactflow/dist/style.css";
import { CurvedEdge } from "./edges/CurvedEdge";
import { WalletNode } from "./nodes/WalletNode";

type TransactionResponse = InferResponseType<
  (typeof client.api.transactions)[":transactions"]["$get"],
  200
>;

function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

/** Layout: Signer always on the far left, everyone else fans out on the right */
function computeLayout(allTransfers: any[], signer: string) {
  const allWallets = Array.from(new Set([
    ...allTransfers.map(t => t.fromWallet),
    ...allTransfers.map(t => t.toWallet)
  ]));

  const left: string[] = [];
  const middle: string[] = []; // Empty middle column creates a wide gap for beautiful layout
  const right: string[] = [];

  const others = allWallets.filter(w => w !== signer);

  if (allWallets.includes(signer)) {
    left.push(signer);
  } else if (others.length > 0) {
    // Fallback if signer is not in transfers
    left.push(others.shift()!);
  }

  // Everyone else goes to the right!
  right.push(...others);

  return { left, middle, right };
}

function columnPositions(
  addrs: string[],
  x: number,
  canvasH: number
): { addr: string; x: number; y: number }[] {
  if (addrs.length === 0) return [];
  // Vast spacing: Guarantee at least 150px vertical gap between nodes
  const FIXED_SPACING = 150;
  // Center the block of nodes gracefully around y=300
  const totalHeight = (addrs.length - 1) * FIXED_SPACING;
  const startY = 300 - totalHeight / 2;

  return addrs.map((addr, i) => ({ addr, x, y: startY + i * FIXED_SPACING }));
}

const nodeTypes = { wallet: WalletNode };
const edgeTypes = { curved: CurvedEdge };

const CANVAS_H = 600; // Not strictly used for spacing anymore, just a base reference
const COL_X = { left: 50, middle: 400, right: 850 }; // Spread horizontally even wider (850 instead of 750)

export function TransactionGraphDemo() {
  const { txHash } = useParams<{ txHash: string }>();
  const { fmt } = useLocalization();

  const transactionDetails = useGet(
    client.api.transactions[":transactions"],
    200,
    { param: { transactions: txHash || "" } },
    { enabled: !!txHash, select: (txDetails) => txDetails[0] }
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const initializedHash = useRef<string | null>(null);

  useEffect(() => {
    if (!transactionDetails.data || !txHash) {
      setNodes([]);
      setEdges([]);
      initializedHash.current = null;
      return;
    }
    
    // Only initialize once per transaction to avoid overriding map drags
    if (initializedHash.current === txHash) {
      return;
    }
    const tx = transactionDetails.data;

    const allTransfers = [...tx.tokenTransfers, ...tx.nativeTransfers];
    if (allTransfers.length === 0) {
      setNodes([]);
      setEdges([]);
      initializedHash.current = txHash;
      return;
    }

    const signer = tx.info.feePayer ?? "";
    const { left, middle, right } = computeLayout(allTransfers, signer);

    const positions = [
      ...columnPositions(left, COL_X.left, CANVAS_H),
      ...columnPositions(middle, COL_X.middle, CANVAS_H),
      ...columnPositions(right, COL_X.right, CANVAS_H),
    ];
    
    const xPosMap: Record<string, number> = {};
    positions.forEach(p => xPosMap[p.addr] = p.x);

    const walletTokens: Record<string, Set<string>> = {};
    positions.forEach(p => walletTokens[p.addr] = new Set<string>());
    
    allTransfers.forEach(t => {
      const tokenId = t.tokenAddress || "SOL";
      if (walletTokens[t.fromWallet]) walletTokens[t.fromWallet].add(tokenId);
      if (walletTokens[t.toWallet]) walletTokens[t.toWallet].add(tokenId);
    });

    const nodesData: Node[] = positions.map(({ addr, x, y }) => {
      const isSigner = addr === signer;
      return {
        id: addr,
        type: "wallet",
        position: { x, y: y - 26 },
        data: {
          address: addr,
          shortAddress: shortAddress(addr),
          isSigner,
          activeTokens: Array.from(walletTokens[addr]),
        },
      };
    });

    const pairCount = new Map<string, number>();
    function nextLabelOffset(src: string, dst: string): number {
      const key = `${src}→${dst}`;
      const n = pairCount.get(key) ?? 0;
      pairCount.set(key, n + 1);
      
      if (n === 0) return 0.5; 
      if (n === 1) return 0.35; 
      if (n === 2) return 0.65; 
      if (n === 3) return 0.2;
      if (n === 4) return 0.8;
      return 0.5 + (n * 0.05); 
    }

    const transferSet = new Set<string>();
    allTransfers.forEach(t => transferSet.add(`${t.fromWallet}→${t.toWallet}`));

    const tokenLinks: Edge[] = tx.tokenTransfers.map((t, i) => {
      const tokenSymbol =
        t.tokenAddress === "So11111111111111111111111111111111111111112"
          ? "WSOL"
          : fmt.text.address(t.tokenAddress, { maxLength: 4 });

      const isSourceLeft = (xPosMap[t.fromWallet] || 0) <= (xPosMap[t.toWallet] || 0);

      return {
        id: `token-${i}`,
        source: t.fromWallet,
        target: t.toWallet,
        sourceHandle: isSourceLeft ? "source-right" : "source-left",
        targetHandle: isSourceLeft ? "target-left" : "target-right",
        type: "curved",
        data: {
          amountText: fmt.num.unit(t.amount, tokenSymbol),
          tokenAddress: t.tokenAddress,
          color: "#f97316",
          labelOffset: nextLabelOffset(t.fromWallet, t.toWallet),
          parallelOffset: (transferSet.has(`${t.toWallet}→${t.fromWallet}`) && t.fromWallet > t.toWallet) ? 10 : 0,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#f97316",
        },
      };
    });

    const nativeLinks: Edge[] = tx.nativeTransfers.map((t, i) => {
      const isSourceLeft = (xPosMap[t.fromWallet] || 0) <= (xPosMap[t.toWallet] || 0);
      return {
        id: `native-${i}`,
        source: t.fromWallet,
        target: t.toWallet,
        sourceHandle: isSourceLeft ? "source-right" : "source-left",
        targetHandle: isSourceLeft ? "target-left" : "target-right",
        type: "curved",
        data: {
          amountText: fmt.num.unit(t.amount / 1e9, "SOL"),
          tokenAddress: "SOL",
          color: "#94a3b8",
          labelOffset: nextLabelOffset(t.fromWallet, t.toWallet),
          parallelOffset: (transferSet.has(`${t.toWallet}→${t.fromWallet}`) && t.fromWallet > t.toWallet) ? 10 : 0,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#94a3b8",
        },
      };
    });

    setNodes(nodesData);
    setEdges([...tokenLinks, ...nativeLinks]);
    initializedHash.current = txHash;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionDetails.data, txHash]);

  if (!txHash) {
    return <div style={styles.state}>Missing transaction hash in URL.</div>;
  }

  if (transactionDetails.isLoading) {
    return <div style={styles.state}>Loading transaction graph…</div>;
  }

  if (transactionDetails.error) {
    return <div style={styles.state}>Failed to load transaction data.</div>;
  }

  if (nodes.length === 0) {
    return (
      <div style={styles.state}>
        No transfer data found for this transaction.
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>Transaction Flow</span>
        <span style={styles.headerHash}>{shortAddress(txHash)}</span>
      </div>

      <div style={styles.chartWrap}>
        <HoverContext.Provider value={{ hoveredToken, setHoveredToken }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.5}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#cbd5e1" gap={24} size={2} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </HoverContext.Provider>
      </div>

      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#f97316" }} />
          Token transfer
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: "#94a3b8" }} />
          SOL transfer
        </span>
        <span style={styles.legendItem}>
          <span
            style={{
              ...styles.legendDot,
              background: "#fff7ed",
              border: "2px solid #f97316",
            }}
          />
          Signer
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#f8fafc",
    fontFamily: "Inter, ui-sans-serif, sans-serif",
    overflow: "hidden",
  },
  header: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 24px 12px",
    borderBottom: "1px solid #e2e8f0",
    background: "rgba(248,250,252,0.85)",
    backdropFilter: "blur(8px)",
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },
  headerHash: {
    fontSize: 13,
    fontWeight: 500,
    color: "#0f172a",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    padding: "2px 10px",
  },
  chartWrap: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    minHeight: 0,
  },
  legend: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    gap: 20,
    padding: "10px 24px",
    borderTop: "1px solid #e2e8f0",
    background: "rgba(248,250,252,0.85)",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#64748b",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  },
  state: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    fontSize: 14,
    color: "#64748b",
    background: "#f8fafc",
    fontFamily: "Inter, ui-sans-serif, sans-serif",
  },
};
