import client from "@/api/main";
import { useCallback, useEffect } from "react";
import { useParams } from "react-router";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "reactflow";

import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import "reactflow/dist/style.css";

type GraphNodeData = {
  label: string;
  address: string;
};

type TransactionGraphData = {
  info: { txHash: string };
  tokenTransfers: Array<{
    amount: number;
    tokenAddress: string;
    fromWallet: string;
    toWallet: string;
  }>;
  nativeTransfers: Array<{
    amount: number;
    fromWallet: string;
    toWallet: string;
  }>;
};

function CustomNode({ data }: { data: GraphNodeData }) {
  const shortAddress =
    data.address.length > 16
      ? `${data.address.slice(0, 6)}...${data.address.slice(-6)}`
      : data.address;

  return (
    <div
      style={{
        padding: 10,
        border: "1px solid #ccc",
        borderRadius: 8,
        background: "#fff",
        minWidth: 150,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontSize: "small", fontWeight: "bold" }}>{data.label}</div>
      <div style={{ fontSize: "10px", color: "#666", marginTop: 4 }}>
        {shortAddress}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

const initialNodes: Node<GraphNodeData>[] = [];

// Component
export function TransactionGraphDemo() {
  const { txHash } = useParams<{ txHash: string }>();
  const { fmt } = useLocalization();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // This is mainly how to interact with the API
  const transactionDetails = useGet(
    client.api.transactions[":transactions"],
    200,
    {
      param: {
        transactions: txHash || "",
      },
    },
    {
      enabled: !!txHash,
      select: (txDetails) => txDetails[0],
    },
  );

  // Update graph when transaction details are loaded
  useEffect(() => {
    if (transactionDetails.data) {
      const transaction = transactionDetails.data;
      const addressSet = new Set<string>();
      const edgeMap = new Map<string, { label: string[]; amount: number }>();

      // Collect all addresses
      for (const transfer of transaction.tokenTransfers) {
        const fromWallet = transfer.fromWallet;
        const toWallet = transfer.toWallet;

        addressSet.add(fromWallet);
        addressSet.add(toWallet);
      }
      for (const transfer of transaction.nativeTransfers) {
        const fromWallet = transfer.fromWallet;
        const toWallet = transfer.toWallet;

        addressSet.add(fromWallet);
        addressSet.add(toWallet);
      }

      // Create nodes
      const addresses = Array.from(addressSet);
      const newNodes: Node<GraphNodeData>[] = addresses.map(
        (address, index) => ({
          id: address,
          type: "custom",
          position: {
            x: (index % 4) * 300,
            y: Math.floor(index / 4) * 200,
          },
          data: { label: address, address },
        }),
      );

      // Create edges from token transfers
      for (const transfer of transaction.tokenTransfers) {
        if (!transfer.fromWallet || !transfer.toWallet) continue;
        const edgeKey = `${transfer.fromWallet}-${transfer.toWallet}`;
        const tokenSymbol = fmt.text.address(transfer.tokenAddress);
        const label = fmt.num.unit(transfer.amount, tokenSymbol);

        if (!edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, { label: [label], amount: transfer.amount });
        } else {
          const existing = edgeMap.get(edgeKey)!;
          existing.label.push(label);
          existing.amount += transfer.amount;
        }
      }

      // Create edges from native transfers
      for (const transfer of transaction.nativeTransfers) {
        const edgeKey = `${transfer.fromWallet}-${transfer.toWallet}`;
        const label = fmt.num.unit(transfer.amount, "SOL");

        if (!edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, { label: [label], amount: transfer.amount });
        } else {
          const existing = edgeMap.get(edgeKey)!;
          existing.label.push(label);
          existing.amount += transfer.amount;
        }
      }

      const newEdges: Edge[] = Array.from(edgeMap.entries()).map(
        ([edgeKey, { label }]) => {
          const [source, target] = edgeKey.split("-");
          return {
            id: edgeKey,
            source,
            target,
            label: label.join(" + "),
            type: "bezier",
            style: { stroke: "#000" },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#000",
            },
          };
        },
      );

      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [transactionDetails.data, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Edge | Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, type: "bezier", style: { stroke: "#000" } }, eds),
      ),
    [setEdges],
  );

  if (transactionDetails.isLoading) {
    return (
      <div>
        <div style={{ padding: 20 }}>Loading transaction graph...</div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <div style={{ padding: 10, fontSize: "14px", color: "#666" }}>
          Transaction Graph - {txHash}
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
