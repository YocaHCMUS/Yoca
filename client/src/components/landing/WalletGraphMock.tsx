import { LANDING_ACCENT, LANDING_ACCENT_2, CARD_RADIUS } from "./tokens";

type NodeDef = {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
};

const nodes: NodeDef[] = [
  { id: "n1", x: 58, y: 52, r: 8, label: "[WHALE-0x...vS2]" },
  { id: "n2", x: 148, y: 84, r: 6, label: "[BOT-0x...8xK]" },
  { id: "n3", x: 236, y: 62, r: 7, label: "[JUPITER-DEX]" },
  { id: "n4", x: 318, y: 110, r: 6, label: "[NEW-USER]" },
  { id: "n5", x: 404, y: 72, r: 8, label: "[RAYDIUM-POOL]" },
  { id: "n6", x: 500, y: 128, r: 6, label: "[LP-0x...2Ne]" },
  { id: "n7", x: 96, y: 188, r: 6, label: "[ORCA-DEX]" },
  { id: "n8", x: 188, y: 214, r: 8, label: "[SMART-MONEY]" },
  { id: "n9", x: 286, y: 176, r: 6, label: "[ARBITRAGE-BOT]" },
  { id: "n10", x: 360, y: 228, r: 7, label: "[SWAP-ROUTER]" },
  { id: "n11", x: 456, y: 202, r: 6, label: "[MM-0x...5vL]" },
  { id: "n12", x: 540, y: 246, r: 7, label: "[TREASURY]" },
];

const edges: Array<[string, string]> = [
  ["n1", "n2"],
  ["n2", "n3"],
  ["n3", "n4"],
  ["n3", "n9"],
  ["n4", "n5"],
  ["n5", "n6"],
  ["n2", "n7"],
  ["n7", "n8"],
  ["n8", "n9"],
  ["n9", "n10"],
  ["n10", "n11"],
  ["n11", "n12"],
  ["n5", "n11"],
  ["n1", "n8"],
];

export function WalletGraphMock() {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div
      style={{
        borderRadius: CARD_RADIUS,
        padding: 20,
        background:
          "linear-gradient(rgba(10,10,15,0.72), rgba(10,10,15,0.72)) padding-box, linear-gradient(130deg, rgba(153,69,255,0.6), rgba(20,241,149,0.6)) border-box",
        border: "1px solid transparent",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow:
          "0 0 32px -18px rgba(153,69,255,0.9), 0 0 24px -16px rgba(20,241,149,0.7)",
      }}
    >
      <svg viewBox="0 0 600 290" className="w-full h-auto">
        <defs>
          <linearGradient id="nodeStroke" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={LANDING_ACCENT} />
            <stop offset="100%" stopColor={LANDING_ACCENT_2} />
          </linearGradient>
          <linearGradient id="edgeStroke" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor={LANDING_ACCENT} />
            <stop offset="100%" stopColor={LANDING_ACCENT_2} />
          </linearGradient>
        </defs>

        {edges.map(([from, to], i) => {
          const a = byId.get(from);
          const b = byId.get(to);
          if (!a || !b) return null;
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="url(#edgeStroke)"
              strokeWidth={1.5}
              opacity={0.75}
              className="landing-edge-pulse"
              style={{ animationDelay: `${i * 140}ms` }}
            />
          );
        })}

        {nodes.map((n, i) => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r + 2}
              fill="none"
              stroke="url(#nodeStroke)"
              strokeOpacity={0.45}
              strokeWidth={2}
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="rgba(12,16,26,0.85)"
              stroke="url(#nodeStroke)"
              strokeWidth={1.4}
              className="landing-node-pulse"
              style={{ animationDelay: `${i * 90}ms` }}
            />
            <text
              x={n.x + 12}
              y={n.y - 8}
              fill="rgba(209, 250, 229, 0.85)"
              fontSize="8.2"
              fontFamily='"JetBrains Mono", monospace'
              letterSpacing="0.25px"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

