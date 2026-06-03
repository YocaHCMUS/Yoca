import { useMemo, type ReactNode } from "react";
import type { ChatMessageItem } from "./types";
import { ChartRenderer, TableRenderer } from "./WalletChatChartRenderer";

interface Props {
  message: ChatMessageItem;
}

const CHART_RE = /<chart\s+id="([^"]+)"\s+type="([^"]+)"\s+data-ref="([^"]+)"(?:\s+title="([^"]*)")?\s*\/>/g;
const TABLE_RE = /<table\s+id="([^"]+)"\s+data-ref="([^"]+)"\s+columns="([^"]+)"\s*\/>/g;

function parseMarkers(text: string): Array<{ type: "text" | "chart" | "table"; content: string; match?: RegExpExecArray }> {
  const parts: Array<{ type: "text" | "chart" | "table"; content: string; match?: RegExpExecArray }> = [];
  let lastIndex = 0;
  const combined: Array<{ index: number; type: "chart" | "table"; match: RegExpExecArray }> = [];

  let m: RegExpExecArray | null;
  while ((m = CHART_RE.exec(text)) !== null) {
    combined.push({ index: m.index, type: "chart", match: [...m] as unknown as RegExpExecArray });
  }
  while ((m = TABLE_RE.exec(text)) !== null) {
    combined.push({ index: m.index, type: "table", match: [...m] as unknown as RegExpExecArray });
  }
  combined.sort((a, b) => a.index - b.index);

  for (const item of combined) {
    if (item.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, item.index) });
    }
    parts.push({ type: item.type, content: "", match: item.match });
    lastIndex = item.index + item.match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
}

export function WalletChatMessage({ message }: Props) {
  const parsed = useMemo(() => parseMarkers(message.content), [message.content]);

  const elements: ReactNode[] = [];

  if (message.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div
          style={{
            maxWidth: "80%",
            background: "#2a6df4",
            color: "#fff",
            borderRadius: "12px 12px 4px 12px",
            padding: "8px 14px",
            fontSize: 13,
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  for (const part of parsed) {
    if (part.type === "text" && part.content.trim()) {
      elements.push(
        <div
          key={`t-${elements.length}`}
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "#e0e0e0",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            marginBottom: 4,
          }}
        >
          {part.content}
        </div>,
      );
    }

    if (part.type === "chart" && message.data) {
      const [, id, type, dataRef, title] = part.match as unknown as string[];
      elements.push(
        <ChartRenderer
          key={`c-${id}`}
          spec={{ id, type: type as "line" | "bar" | "area" | "pie", dataRef, title: title || undefined }}
          data={message.data}
        />,
      );
    }

    if (part.type === "table" && message.data) {
      const [, id, dataRef, columns] = part.match as unknown as string[];
      elements.push(
        <TableRenderer
          key={`t-${id}`}
          spec={{ id, dataRef, columns }}
          data={message.data}
        />,
      );
    }
  }

  if (elements.length === 0) {
    elements.push(
      <div key="empty" style={{ fontSize: 13, color: "#888" }}>
        No data available.
      </div>,
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
      <div
        style={{
          maxWidth: "85%",
          background: "#1e1e1e",
          border: "1px solid #2a2a2a",
          borderRadius: "12px 12px 12px 4px",
          padding: "10px 14px",
        }}
      >
        {elements}
      </div>
    </div>
  );
}
