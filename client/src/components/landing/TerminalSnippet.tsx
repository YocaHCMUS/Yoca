import type { CSSProperties } from "react";
import { CARD_RADIUS } from "./tokens";

const pre: CSSProperties = {
  margin: 0,
  padding: 32,
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  fontSize: "0.8125rem",
  lineHeight: 1.75,
  backgroundColor: "#07070c",
  overflowX: "auto",
};

const kw = { color: "#c792ea" } as const;
const flag = { color: "#14f195" } as const;
const str = { color: "#ecc48d" } as const;
const url = { color: "#82aaff" } as const;
const muted = { color: "#546e7a" } as const;
const jsonKey = { color: "#7fdbca" } as const;
const jsonNum = { color: "#f78c6c" } as const;
const jsonPunct = { color: "#89ddff" } as const;

export function TerminalSnippet() {
  return (
    <div
      style={{
        borderRadius: CARD_RADIUS,
        overflow: "hidden",
        border: "1px solid rgba(153,69,255,0.45)",
        boxShadow:
          "0 0 48px -16px rgba(153,69,255,0.38), 0 0 24px rgba(20,241,149,0.2)",
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{
          padding: "12px 20px",
          backgroundColor: "#111118",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex gap-2" aria-hidden>
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: "#ff5f57" }}
          />
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: "#febc2e" }}
          />
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: "#28c840" }}
          />
        </div>
        <span
          className="flex-1 text-center text-[11px] font-medium tracking-wide text-[#64748b]"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          yoca-cli — behavioral graph query
        </span>
        <div className="w-[52px]" aria-hidden />
      </div>

      <pre style={pre}>
        <div>
          <span style={{ color: "#64748b" }}># Fetching AI-classified wallet behavior</span>
        </div>
        <div>
          <span style={kw}>yoca</span> <span style={flag}>--analyze</span>{" "}
          <span style={str}>wallet</span> <span style={url}>8xK...vS2</span>{" "}
          <span style={flag}>--graph</span> <span style={flag}>--behavioral-tag</span>
        </div>
        <div style={muted}>&nbsp;</div>
        <div style={{ color: "#64748b" }}># Output:</div>
        <div>
          <span style={jsonPunct}>{"{"}</span>{" "}
          <span style={jsonKey}>&quot;identity&quot;</span>
          <span style={jsonPunct}>:</span>{" "}
          <span style={str}>&quot;Whale / LP Provider&quot;</span>
          <span style={jsonPunct}>,</span>{" "}
          <span style={jsonKey}>&quot;reliability_score&quot;</span>
          <span style={jsonPunct}>:</span>{" "}
          <span style={jsonNum}>0.98</span>
          <span style={jsonPunct}>,</span>
        </div>
        <div>
          <span style={jsonKey}>&quot;top_interactions&quot;</span>
          <span style={jsonPunct}>:</span>{" "}
          <span style={jsonPunct}>[</span>
          <span style={str}>&quot;Raydium&quot;</span>
          <span style={jsonPunct}>,</span>{" "}
          <span style={str}>&quot;Jupiter&quot;</span>
          <span style={jsonPunct}>,</span>{" "}
          <span style={str}>&quot;Orca&quot;</span>
          <span style={jsonPunct}>]</span>
          <span style={jsonPunct}>,</span>{" "}
          <span style={jsonKey}>&quot;last_24h_volume&quot;</span>
          <span style={jsonPunct}>:</span>{" "}
          <span style={str}>&quot;12,450 SOL&quot;</span>
        </div>
        <div>
          <span style={jsonPunct}>{"}"}</span>
        </div>
      </pre>
    </div>
  );
}
