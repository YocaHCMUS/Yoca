import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { ActionSpec, ChatMessageItem } from "./types";
import { ChartRenderer, TableRenderer } from "./WalletChatChartRenderer";
import styles from "./WalletChat.module.scss";

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
    <div key={`actg-${actions[0]?.index ?? "end"}`} className={styles.actionGroup}>
      {actions.map((a, i) => (
        <button
          key={`act-${a.index ?? "end"}-${i}`}
          type="button"
          className={styles.actionBtn}
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
  const { tr } = useLocalization();
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
      <div className={styles.userBubbleRow}>
        <div className={styles.userBubble}>
          {message.content}
        </div>
      </div>
    );
  }

  for (const part of parsed) {
    if (part.type === "text" && part.content.trim()) {
      elements.push(
        <div key={`t-${elements.length}`} className={styles.textPart}>
          {part.content}
        </div>,
      );
    }

    if (part.type === "chart" && message.data && part.id) {
      const spec = message.charts?.find((c) => c.id === part.id) ?? {
        id: part.id, type: "line" as const, dataRef: part.id,
      };
      elements.push(
        <ChartRenderer key={`c-${part.id}`} spec={spec} data={message.data} onAction={onAction} />,
      );
    }

    if (part.type === "table" && message.data && part.id) {
      const spec = message.tables?.find((t) => t.id === part.id) ?? {
        id: part.id, dataRef: part.id, columns: "",
      };
      elements.push(
        <TableRenderer key={`t-${part.id}`} spec={spec} data={message.data} onAction={onAction} />,
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
      <div key="empty" className={styles.emptyPart}>
        {tr("common.noData")}
      </div>,
    );
  }

  return (
    <div className={styles.assistantBubbleRow}>
      <div className={styles.assistantBubble}>
        {elements}
      </div>
    </div>
  );
}
