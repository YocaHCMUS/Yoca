import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";
import type { ActionSpec, ChatMessageItem } from "./types";
import { ChartRenderer, TableRenderer } from "./WalletChatChartRenderer";

interface Props {
  message: ChatMessageItem;
  onAction?: (href: string) => void;
}

const MARKER_RE = /<(chart|table|action)\s+id="([^"]+)"\s*\/>/g;

function normalizeMarkers(text: string): string {
  return text.replace(/<(chart|table)>id="([^"]+)"<\/\1>/g, '<$1 id="$2" />');
}

type PartType =
  | { type: "text"; content: string }
  | { type: "chart"; id: string }
  | { type: "table"; id: string }
  | { type: "action"; id: string };

function parseMarkers(text: string): PartType[] {
  const normalized = normalizeMarkers(text);
  const parts: PartType[] = [];
  let lastIndex = 0;
  const combined: Array<{ index: number; type: "chart" | "table" | "action"; match: RegExpExecArray }> = [];

  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(normalized)) !== null) {
    combined.push({ index: m.index, type: m[1] as "chart" | "table" | "action", match: [...m] as unknown as RegExpExecArray });
  }
  combined.sort((a, b) => a.index - b.index);

  for (const item of combined) {
    if (item.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, item.index) });
    }
    if (item.type === "action") {
      parts.push({ type: "action", id: item.match[2] });
    } else {
      parts.push({ type: item.type as "chart" | "table", id: item.match[2] });
    }
    lastIndex = item.index + item.match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
}

function actionButtonGroup(actions: ActionSpec[], navigate: ReturnType<typeof useNavigate>, onAction?: (href: string) => void): ReactNode {
  return (
    <div key={`actg-${actions[0]?.index ?? "end"}`} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4, marginBottom: 4 }}>
      {actions.map((a, i) => (
        <button
          key={`act-${a.index ?? "end"}-${i}`}
          type="button"
          style={{
            background: "transparent",
            border: "1px solid #2a6df4",
            color: "#2a6df4",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          onClick={() => {
            if (a.href.startsWith("#ask:") && onAction) {
              onAction(a.href.slice(5));
            } else {
              navigate(a.href);
            }
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export function WalletChatMessage({ message, onAction }: Props) {
  const navigate = useNavigate();
  const parsed = useMemo(() => parseMarkers(message.content), [message.content]);

  const { inlineByIndex, endActions } = useMemo(() => {
    const inline: Record<string, ActionSpec[]> = {};
    const end: ActionSpec[] = [];
    if (message.actions) {
      for (const a of message.actions) {
        if (a.index != null) {
          const key = String(a.index);
          if (!inline[key]) inline[key] = [];
          inline[key].push(a);
        } else {
          end.push(a);
        }
      }
    }
    return { inlineByIndex: inline, endActions: end };
  }, [message.actions]);

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

    if (part.type === "chart" && message.data && part.id) {
      const spec = message.charts?.find((c) => c.id === part.id) ?? {
        id: part.id, type: "line" as const, dataRef: part.id,
      };
      elements.push(
        <ChartRenderer key={`c-${part.id}`} spec={spec} data={message.data} />,
      );
    }

    if (part.type === "table" && message.data && part.id) {
      const spec = message.tables?.find((t) => t.id === part.id) ?? {
        id: part.id, dataRef: part.id, columns: "",
      };
      elements.push(
        <TableRenderer key={`t-${part.id}`} spec={spec} data={message.data} />,
      );
    }

    if (part.type === "action" && part.id) {
      const group = inlineByIndex[part.id];
      if (group?.length) {
        elements.push(actionButtonGroup(group, navigate, onAction));
      }
    }
  }

  if (endActions.length > 0) {
    elements.push(actionButtonGroup(endActions, navigate, onAction));
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
