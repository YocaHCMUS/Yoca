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
const flag = { color: "#7fdbca" } as const;
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
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 0 48px -16px rgba(255, 107, 0, 0.25)",
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
          yoca-cli — wallet snapshot
        </span>
        <div className="w-[52px]" aria-hidden />
      </div>

      <pre style={pre}>
        <div>
          <span style={kw}>curl</span> <span style={flag}>-s</span>{" "}
          <span style={url}>https://api.yoca.example/v1/wallets/&hellip;</span>
        </div>
        <div>
          <span style={flag}>-H</span>{" "}
          <span style={str}>
            &quot;Authorization: Bearer $YOCA_TOKEN&quot;
          </span>
        </div>
        <div style={muted}>&nbsp;</div>
        <div>
          <span style={jsonPunct}>{"{"}</span>{" "}
          <span style={jsonKey}>&quot;address&quot;</span>
          <span style={jsonPunct}>:</span>{" "}
          <span style={str}>&quot;&hellip;&quot;</span>
          <span style={jsonPunct}>,</span>{" "}
          <span style={jsonKey}>&quot;pnl_30d&quot;</span>
          <span style={jsonPunct}>:</span>{" "}
          <span style={jsonNum}>-1240.5</span>
          <span style={jsonPunct}>,</span>{" "}
          <span style={jsonKey}>&quot;tokens&quot;</span>
          <span style={jsonPunct}>:</span>{" "}
          <span style={jsonNum}>42</span> <span style={jsonPunct}>{"}"}</span>
        </div>
      </pre>
    </div>
  );
}
