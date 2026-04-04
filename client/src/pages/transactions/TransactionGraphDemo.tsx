import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import type { InferResponseType } from "hono/client";
import { useMemo } from "react";
import { useParams } from "react-router";

type TransactionResponse = InferResponseType<
  (typeof client.api.transactions)[":transactions"]["$get"],
  200
>;

function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

/** Split wallets into left (only-from), middle (both from+to), right (only-to) columns */
function computeColumns(fromWallets: string[], toWallets: string[]) {
  const fromSet = new Set(fromWallets);
  const toSet = new Set(toWallets);
  const all = Array.from(new Set([...fromWallets, ...toWallets]));
  const left: string[] = [];
  const middle: string[] = [];
  const right: string[] = [];
  for (const addr of all) {
    const isSrc = fromSet.has(addr);
    const isDst = toSet.has(addr);
    if (isSrc && isDst) middle.push(addr);
    else if (isSrc) left.push(addr);
    else right.push(addr);
  }
  return { left, middle, right };
}

function columnPositions(
  addrs: string[],
  x: number,
  canvasH: number,
): { addr: string; x: number; y: number }[] {
  if (addrs.length === 0) return [];
  const spacing = canvasH / (addrs.length + 1);
  return addrs.map((addr, i) => ({ addr, x, y: spacing * (i + 1) }));
}

const NODE_W = 160;
const NODE_H = 52;
const CANVAS_W = 900;
const CANVAS_H = 400;
const COL_X = { left: 140, middle: CANVAS_W / 2, right: CANVAS_W - 140 };

export function TransactionGraphDemo() {
  const { txHash } = useParams<{ txHash: string }>();
  const { fmt } = useLocalization();

  const transactionDetails = useGet(
    client.api.transactions[":transactions"],
    200,
    { param: { transactions: txHash || "" } },
    { enabled: !!txHash, select: (txDetails) => txDetails[0] },
  );

  const option = useMemo((): EChartsOption => {
    if (!transactionDetails.data || !txHash) return {};
    const tx = transactionDetails.data;

    const allTransfers = [
      ...tx.tokenTransfers,
      ...tx.nativeTransfers,
    ];
    if (allTransfers.length === 0) return {};

    const fromWallets = allTransfers.map((t) => t.fromWallet);
    const toWallets = allTransfers.map((t) => t.toWallet);
    const { left, middle, right } = computeColumns(fromWallets, toWallets);

    const positions = [
      ...columnPositions(left, COL_X.left, CANVAS_H),
      ...columnPositions(middle, COL_X.middle, CANVAS_H),
      ...columnPositions(right, COL_X.right, CANVAS_H),
    ];

    const signer = tx.info.feePayer ?? "";

    const data = positions.map(({ addr, x, y }) => {
      const isSigner = addr === signer;
      return {
        id: addr,
        name: shortAddress(addr),
        value: addr,
        x,
        y,
        symbol: "rect",
        symbolSize: [NODE_W + 16, NODE_H + 16],
        itemStyle: {
          color: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
        },
        label: {
          show: true,
          position: "inside",
          width: NODE_W,
          padding: isSigner ? [8, 0] : [17, 0],
          backgroundColor: isSigner ? "#fff7ed" : "#ffffff",
          borderColor: isSigner ? "#f97316" : "#cbd5e1",
          borderWidth: isSigner ? 2 : 1,
          borderRadius: 10,
          shadowBlur: 12,
          shadowColor: "rgba(0,0,0,0.08)",
          shadowOffsetY: 3,
          color: "#1e293b",
          fontSize: 11,
          fontWeight: 500,
          fontFamily: "Inter, ui-sans-serif, sans-serif",
          lineHeight: 18,
          align: "center",
          formatter: isSigner
            ? `● Signer\n${shortAddress(addr)}`
            : shortAddress(addr),
        },
      };
    });

    // Track how many edges have been assigned per (src→dst) pair, so each gets unique curveness
    const pairCount = new Map<string, number>();
    function nextCurveness(src: string, dst: string): number {
      const key = `${src}→${dst}`;
      const n = pairCount.get(key) ?? 0;
      pairCount.set(key, n + 1);
      // Spread: +0.2, -0.2, +0.4, -0.4, +0.6, …
      const step = Math.ceil((n + 1) / 2) * 0.2;
      return n % 2 === 0 ? step : -step;
    }

    const tokenLinks = tx.tokenTransfers.map((t) => ({
      source: t.fromWallet,
      target: t.toWallet,
      label: {
        show: true,
        formatter: fmt.num.unit(
          t.amount,
          t.tokenAddress === "So11111111111111111111111111111111111111112"
            ? "WSOL"
            : fmt.text.address(t.tokenAddress, { maxLength: 4 }),
        ),
        fontSize: 10,
        color: "#64748b",
        fontFamily: "Inter, ui-sans-serif, sans-serif",
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 4,
        padding: [2, 6],
      },
      lineStyle: {
        color: "#f97316",
        width: 2,
        type: "dashed" as const,
        opacity: 0.85,
        curveness: nextCurveness(t.fromWallet, t.toWallet),
      },
    }));

    const nativeLinks = tx.nativeTransfers.map((t) => ({
      source: t.fromWallet,
      target: t.toWallet,
      label: {
        show: true,
        formatter: fmt.num.unit(t.amount / 1e9, "SOL"),
        fontSize: 10,
        color: "#64748b",
        fontFamily: "Inter, ui-sans-serif, sans-serif",
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 4,
        padding: [2, 6],
      },
      lineStyle: {
        color: "#94a3b8",
        width: 1.5,
        type: "dashed" as const,
        opacity: 0.8,
        curveness: nextCurveness(t.fromWallet, t.toWallet),
      },
    }));

    return {
      backgroundColor: "transparent",
      animationDurationUpdate: 800,
      animationEasingUpdate: "cubicInOut",
      series: [
        {
          type: "graph" as const,
          layout: "none",
          roam: true,
          draggable: true,
          symbol: "roundRect",
          symbolSize: [NODE_W, NODE_H],
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: [0, 14],
          label: {
            show: true,
            fontSize: 11,
            color: "#1e293b",
            fontFamily: "Inter, ui-sans-serif, sans-serif",
          },
          edgeLabel: {
            show: true,
            fontSize: 10,
            color: "#475569",
            fontFamily: "Inter, ui-sans-serif, sans-serif",
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: 4,
            padding: [2, 6],
            formatter: "{b}",
          },
          data,
          links: [...tokenLinks, ...nativeLinks],
          lineStyle: {
            opacity: 0.8,
            width: 1.5,
            curveness: 0.1,
            color: "#94a3b8",
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: { width: 3 },
          },
        },
      ],
    };
  }, [transactionDetails.data, txHash, fmt]);

  if (!txHash) {
    return (
      <div style={styles.state}>Missing transaction hash in URL.</div>
    );
  }

  if (transactionDetails.isLoading) {
    return <div style={styles.state}>Loading transaction graph…</div>;
  }

  if (transactionDetails.error) {
    return (
      <div style={styles.state}>Failed to load transaction data.</div>
    );
  }

  const hasNoData =
    !transactionDetails.data ||
    (transactionDetails.data.tokenTransfers.length === 0 &&
      transactionDetails.data.nativeTransfers.length === 0);

  if (hasNoData) {
    return (
      <div style={styles.state}>No transfer data found for this transaction.</div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Dot Grid background */}
      <div style={styles.dotGrid} />

      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerLabel}>Transaction Graph</span>
        <span style={styles.headerHash}>{shortAddress(txHash)}</span>
      </div>

      {/* Chart */}
      <div style={styles.chartWrap}>
        <ReactECharts
          option={option}
          style={{ width: "100%", height: "100%" }}
          opts={{ renderer: "canvas" }}
        />
      </div>

      {/* Legend */}
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
  dotGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
    backgroundSize: "24px 24px",
    pointerEvents: "none",
    zIndex: 0,
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
