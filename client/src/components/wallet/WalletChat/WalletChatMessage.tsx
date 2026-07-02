import classNames from "classnames";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router";
import { Copy, Check, RefreshCw, Pencil } from "lucide-react";
import { ID_MODAL_ROOT } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { TranslationKeyPath } from "@/config/localization";
import type {
  ActionSpec,
  ChatMessageItem,
  ChatSource,
  WalletChatSection,
  WalletSectionKind,
  WalletConfidence,
} from "./types";
import { GeckoTerminalChart } from "@/components/charts/GeckoTerminalChart";
import { ChartRenderer, TableRenderer } from "./WalletChatChartRenderer";
import { SourcePanel } from "./WalletChatSourcePanel";
import styles from "./WalletChat.module.scss";

interface Props {
  message: ChatMessageItem;
  index: number;
  onAction?: (href: string) => void;
  onRedo?: (index: number, content: string) => void;
  onRevert?: (index: number, content: string) => void;
}

const MARKER_RE = /<(chart|table|action)\s+id="([^"]+)"\s*\/>/g;
const CITE_RE = /<cite\s+ids="([^"]+)"\s*>((?:(?!<\/cite>)[\s\S])*?)<\/cite>/g;

function normalizeMarkers(text: string): string {
  return text.replace(/<(chart|table)>id="([^"]+)"<\/\1>/g, '<$1 id="$2" />');
}

type PartType =
  | { type: "text"; content: string }
  | { type: "chart"; id: string }
  | { type: "table"; id: string }
  | { type: "action"; id: string }
  | { type: "cite"; ids: string[]; content: string };

function parseMarkers(text: string): PartType[] {
  const normalized = normalizeMarkers(text);
  const parts: PartType[] = [];

  // Collect all marker positions (cite + self-closing)
  type Marker = { index: number; endIndex: number; type: PartType["type"] } & (
    | { type: "cite"; ids: string[]; content: string }
    | { type: "chart" | "table" | "action"; id: string }
  );

  const markers: Marker[] = [];

  let m: RegExpExecArray | null;
  while ((m = CITE_RE.exec(normalized)) !== null) {
    const ids = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    markers.push({
      index: m.index,
      endIndex: m.index + m[0].length,
      type: "cite",
      ids,
      content: m[2],
    });
  }

  while ((m = MARKER_RE.exec(normalized)) !== null) {
    markers.push({
      index: m.index,
      endIndex: m.index + m[0].length,
      type: m[1] as "chart" | "table" | "action",
      id: m[2],
    });
  }

  markers.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const marker of markers) {
    if (marker.index > lastIndex) {
      parts.push({ type: "text", content: normalized.slice(lastIndex, marker.index) });
    }
    if (marker.type === "cite") {
      parts.push({ type: "cite", ids: marker.ids, content: marker.content });
    } else if (marker.type === "action") {
      parts.push({ type: "action", id: marker.id });
    } else {
      parts.push({ type: marker.type as "chart" | "table", id: marker.id });
    }
    lastIndex = marker.endIndex;
  }
  if (lastIndex < normalized.length) {
    parts.push({ type: "text", content: normalized.slice(lastIndex) });
  }

  return parts;
}

// ─── Rich Text Helpers ──────────────────────────────────────────────────

const METRIC_OR_SIGNAL_PATTERN =
  /([+-]\d+(?:\.\d+)?%|[$€£¥₿]\s?\d[\d,]*(?:\.\d+)?)/gi;

function stripMarkdownArtifacts(value: string) {
  return value.replace(/\*\*/g, "");
}

function splitBoldSegments(value: string) {
  const segments: Array<{ text: string; bold: boolean }> = [];
  const boldPattern = /\*\*([^*]+?)\*\*/g;
  let lastIndex = 0;

  for (const match of value.matchAll(boldPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ text: stripMarkdownArtifacts(value.slice(lastIndex, index)), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({ text: stripMarkdownArtifacts(value.slice(lastIndex)), bold: false });
  }

  return segments.length > 0
    ? segments.filter((s) => s.text.length > 0)
    : [{ text: stripMarkdownArtifacts(value), bold: false }];
}

function getMetricClass(value: string) {
  if (/^\+\d/.test(value) && value.includes("%")) return "metricPositive";
  if (/^-\d/.test(value) && value.includes("%")) return "metricNegative";
  if (/^[$€£¥₿]/.test(value.trim())) return "metricMoney";
  return "metricNeutral";
}

function isNumericPartOfIdentifier(fullText: string, matchIndex: number, matchedText: string): boolean {
  if (!/^\d[\d,.]*$/.test(matchedText)) return false;
  const charBefore = fullText[matchIndex - 1];
  const charAfter = fullText[matchIndex + matchedText.length];
  if (charBefore && /[a-zA-Z]/.test(charBefore)) return true;
  if (charAfter && /[a-zA-Z]/.test(charAfter)) return true;
  return false;
}

function renderMetricTokens(value: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(METRIC_OR_SIGNAL_PATTERN)) {
    const index = match.index ?? 0;
    const text = match[0];
    if (index > lastIndex) {
      nodes.push(value.slice(lastIndex, index));
    }
    if (isNumericPartOfIdentifier(value, index, text)) {
      nodes.push(text);
    } else if (isInsideCitationBrackets(value, index, text)) {
      nodes.push(text);
    } else {
      const metricClass = getMetricClass(text);
      nodes.push(
        <span key={`${keyPrefix}-${index}`} className={classNames(styles.metricToken, styles[metricClass])}>
          {text}
        </span>,
      );
    }
    lastIndex = index + text.length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
}

function isInsideCitationBrackets(fullText: string, matchIndex: number, matchedText: string): boolean {
  return fullText[matchIndex - 1] === "[" && fullText[matchIndex + matchedText.length] === "]";
}

function renderInlineRichText(value: string, keyPrefix = "rich") {
  return splitBoldSegments(value).map((segment, idx) => {
    const content = renderMetricTokens(segment.text, `${keyPrefix}-${idx}`);
    if (!segment.bold) return <span key={`${keyPrefix}-${idx}`}>{content}</span>;
    return (
      <strong key={`${keyPrefix}-${idx}`} className={styles.richStrong}>
        {content}
      </strong>
    );
  });
}

function parseStructuredQuery(text: string): Record<string, string> | null {
  const t = text.trim();
  if (!t.startsWith("{") || !t.endsWith("}") || !t.includes(": ")) return null;
  const inner = t.slice(1, -1);
  const pairs: Record<string, string> = {};
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      const sep = current.indexOf(": ");
      if (sep > 0) { pairs[current.slice(0, sep).trim()] = current.slice(sep + 2).trim(); }
      current = "";
    } else { current += ch; }
  }
  if (current.trim()) {
    const sep = current.indexOf(": ");
    if (sep > 0) { pairs[current.slice(0, sep).trim()] = current.slice(sep + 2).trim(); }
  }
  return Object.keys(pairs).length > 0 ? pairs : null;
}

function isBulletLikeLine(value: string) {
  return /^\s*(?:[-*\u2022]\s+|\d+[.)]\s+)/.test(value);
}

function cleanBulletLine(value: string) {
  return value.replace(/^\s*(?:[-*\u2022]\s+|\d+[.)]\s+)/, "").trim();
}

function WalletRichText({ text, inline = false }: { text?: string | number | null; inline?: boolean }) {
  const value = String(text ?? "").trim();
  if (!value) return null;

  if (inline) return <>{renderInlineRichText(value)}</>;

  const blocks = value.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <>
      {blocks.map((block, blockIdx) => {
        const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);

        if (lines.length > 0 && lines.every(isBulletLikeLine)) {
          return (
            <ul key={blockIdx} className={styles.richList}>
              {lines.map((line, lineIdx) => (
                <li key={lineIdx}>
                  {renderInlineRichText(cleanBulletLine(line), `rich-${blockIdx}-${lineIdx}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <div key={blockIdx} className={styles.richParagraphGroup}>
            {lines.map((line, lineIdx) =>
              isBulletLikeLine(line) ? (
                <div key={lineIdx} className={styles.richBulletLine}>
                  <span aria-hidden="true" />
                  <span>{renderInlineRichText(cleanBulletLine(line), `rich-${blockIdx}-${lineIdx}`)}</span>
                </div>
              ) : (
                <p key={lineIdx} className={styles.richParagraph}>
                  {renderInlineRichText(line, `rich-${blockIdx}-${lineIdx}`)}
                </p>
              ),
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Section Table ──────────────────────────────────────────────────────

function SectionTable({ table }: { table: Array<Record<string, string | number | null>> }) {
  const columns = useMemo(() => {
    const keys = new Set<string>();
    table.forEach((row) => Object.keys(row).forEach((k) => keys.add(k)));
    return [...keys].slice(0, 6);
  }, [table]);

  if (columns.length === 0) return null;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.sectionTable}>
        <thead>
          <tr>
            {columns.map((col) => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col}>
                  <WalletRichText text={row[col] ?? "-"} inline />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Section Kind → Meta ────────────────────────────────────────────────

const CONFIDENCE_LEVEL_KEYS = {
  High: "chat.confidenceHigh",
  Medium: "chat.confidenceMedium",
  Low: "chat.confidenceLow",
} as const satisfies Record<WalletConfidence, TranslationKeyPath>;

const SECTION_KIND_META = {
  market_snapshot: { labelKey: "chat.section.market_snapshot" },
  key_findings: { labelKey: "chat.section.key_findings" },
  pnl_summary: { labelKey: "chat.section.pnl_summary" },
  trading_activity: { labelKey: "chat.section.trading_activity" },
  top_holdings: { labelKey: "chat.section.top_holdings" },
  risk_factors: { labelKey: "chat.section.risk_factors" },
  what_to_watch: { labelKey: "chat.section.what_to_watch" },
  conclusion: { labelKey: "chat.section.conclusion" },
  custom: { labelKey: "chat.section.custom" },
} as const satisfies Record<WalletSectionKind, { labelKey: TranslationKeyPath }>;

// ─── Section Renderer ───────────────────────────────────────────────────

function WalletChatSectionRenderer({ section, onBulletClick, onCopySection, copiedSectionId: copiedId }: {
  section: WalletChatSection;
  onBulletClick?: (text: string) => void;
  onCopySection?: (id: string, text: string) => void;
  copiedSectionId?: string | null;
}) {
  const { tr } = useLocalization();
  const meta = SECTION_KIND_META[section.kind] ?? SECTION_KIND_META.custom;
  const sectionId = `section-${section.title || section.kind}`;
  const isCopied = copiedId === sectionId;
  const sectionCopyText = [section.content, ...(section.bullets ?? [])].filter(Boolean).join("\n");
  const contentText = section.content;

  return (
    <div className={styles.sectionBlock}>
      <button
        type="button"
        className={classNames(styles.sectionCopyBtn, { [styles.sectionCopyBtnVisible]: isCopied })}
        onClick={() => onCopySection?.(sectionId, sectionCopyText)}
        title={tr("chat.copySection")}
      >
        {isCopied ? <Check size={12} /> : <Copy size={12} />}
        {isCopied ? tr("chat.copied") : tr("chat.copy")}
      </button>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderInner}>
          <span className={styles.sectionKind}>{tr(meta.labelKey)}</span>
          {section.title && <div className={styles.sectionTitle}>{section.title}</div>}
        </div>
      </div>
      {contentText && (
        <div className={styles.clickableContent} onClick={() => onBulletClick?.(contentText)}>
          <div className={styles.sectionContent}>
            <WalletRichText text={contentText} />
          </div>
        </div>
      )}
      {section.bullets && section.bullets.length > 0 && (
        <ul className={styles.sectionBulletList}>
          {section.bullets.map((bullet, idx) => (
            <li key={idx} className={styles.clickableBullet} onClick={() => onBulletClick?.(bullet)}>
              <WalletRichText text={bullet} inline />
            </li>
          ))}
        </ul>
      )}
      {section.table && section.table.length > 0 && (
        <SectionTable table={section.table} />
      )}
    </div>
  );
}

// ─── Action Button Group ────────────────────────────────────────────────

// ─── Cite Block + Source Panel ──────────────────────────────────────────

function CitedTextBlock({
  ids,
  content,
  sources,
  hoveredCiteIds,
  onOpenPanel,
  onHoverIds,
  onLeaveIds,
}: {
  ids: string[];
  content: string;
  sources: ChatSource[];
  hoveredCiteIds: number[];
  onOpenPanel: (key: string, ids: string[], pos: { top: number; left: number }) => void;
  onHoverIds: (ids: string[]) => void;
  onLeaveIds: () => void;
}) {
  const { tr } = useLocalization();
  const numIds = ids.map(Number);
  const matchesHover = hoveredCiteIds.some((h) => numIds.includes(h));
  const pillLabel = tr("chat.sourcePill");

  return (
    <span
      className={classNames(styles.citeBlock, {
        [styles.citeBlockHighlighted]: matchesHover,
      })}
      onMouseEnter={() => onHoverIds(ids)}
      onMouseLeave={onLeaveIds}
    >
      <WalletRichText text={content} inline />
      <button
        type="button"
        className={styles.citePill}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onOpenPanel(ids.join(","), ids, { top: rect.bottom + 4, left: rect.left });
        }}
      >
        📎 {pillLabel}
      </button>
    </span>
  );
}

function InlineFlow({
  parts,
  sources,
  hoveredCiteIds,
  onOpenPanel,
  onHoverIds,
  onLeaveIds,
}: {
  parts: PartType[];
  sources: ChatSource[];
  hoveredCiteIds: number[];
  onOpenPanel: (key: string, ids: string[], pos: { top: number; left: number }) => void;
  onHoverIds: (ids: string[]) => void;
  onLeaveIds: () => void;
}) {
  return (
    <div className={styles.inlineFlow}>
      {parts.map((part, idx) => {
        if (part.type === "text" && part.content.trim()) {
          const next = parts[idx + 1];
          const textContent = next?.type === "cite" ? part.content.replace(/\s+$/, "") : part.content;
          return <WalletRichText key={`f-t-${idx}`} text={textContent} inline />;
        }
        if (part.type === "cite") {
          const prev = parts[idx - 1];
          const needsLeadingSpace = prev?.type === "text" && prev.content.trim().length > 0;
          return (
            <>
              {needsLeadingSpace && ' '}
              <CitedTextBlock
                key={`f-c-${idx}`}
                ids={part.ids}
                content={part.content}
                sources={sources}
                hoveredCiteIds={hoveredCiteIds}
                onOpenPanel={onOpenPanel}
                onHoverIds={onHoverIds}
                onLeaveIds={onLeaveIds}
              />
            </>
          );
        }
        return null;
      })}
    </div>
  );
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

// ─── Main Component ─────────────────────────────────────────────────────

export function WalletChatMessage({ message, index, onAction, onRedo, onRevert }: Props) {
  const navigate = useNavigate();
  const { tr } = useLocalization();
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const [activePanelKey, setActivePanelKey] = useState<string | null>(null);
  const [activePanelIds, setActivePanelIds] = useState<string[]>([]);
  const [activePanelPos, setActivePanelPos] = useState<{ top: number; left: number } | null>(null);
  const [hoveredCiteIds, setHoveredCiteIds] = useState<number[]>([]);

  const handleCopySection = useCallback(async (_id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(_id);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch {
      // clipboard write failed
    }
  }, []);

  const handleBulletClick = useCallback((text: string) => {
    const query = `${tr("chat.tellMeMore")}: ${text}`;
    onAction?.(query);
  }, [tr, onAction]);

  const handleOpenPanel = useCallback((key: string, ids: string[], pos: { top: number; left: number }) => {
    setActivePanelKey((prev) => {
      if (prev === key) {
        setActivePanelPos(null);
        setActivePanelIds([]);
        return null;
      }
      setActivePanelPos(pos);
      setActivePanelIds(ids);
      return key;
    });
  }, []);

  const handleClosePanel = useCallback(() => {
    setActivePanelKey(null);
    setActivePanelIds([]);
    setActivePanelPos(null);
  }, []);

  const handleHoverSource = useCallback((num: number) => {
    setHoveredCiteIds([num]);
  }, []);

  const handleLeaveSource = useCallback(() => {
    setHoveredCiteIds([]);
  }, []);

  const handleHoverCiteIds = useCallback((ids: string[]) => {
    setHoveredCiteIds(ids.map(Number));
  }, []);

  const handleLeaveCiteIds = useCallback(() => {
    setHoveredCiteIds([]);
  }, []);

  const parsed = useMemo(() => parseMarkers(message.content), [message.content]);

  // Collapse adjacent text/cite parts into inline groups for continuous flow
  const inlineGroups = useMemo(() => {
    const groups: PartType[][] = [];
    let buf: PartType[] = [];
    for (const part of parsed) {
      if (part.type === "text" || part.type === "cite") {
        buf.push(part);
      } else {
        if (buf.length) { groups.push(buf); buf = []; }
        groups.push([part]);
      }
    }
    if (buf.length) groups.push(buf);
    return groups;
  }, [parsed]);

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

  if (message.role === "user") {
    const userCopyId = "user-copy";
    const isUserCopied = copiedSectionId === userCopyId;
    const dataPairs = parseStructuredQuery(message.content);
    return (
      <div className={styles.userBubbleRow}>
        <div className={styles.userBubble}>
          {dataPairs ? (
            <div className={styles.userDataPill}>
              {Object.entries(dataPairs).map(([field, value]) => (
                <span key={field} className={styles.userDataPillField}>
                  <span className={styles.userDataPillLabel}>{field}</span>
                  <span className={styles.userDataPillValue}>{value}</span>
                </span>
              ))}
            </div>
          ) : (
            message.content
          )}
        </div>
        <div className={styles.bubbleActions}>
          <button
            type="button"
            className={styles.bubbleActionBtn}
            onClick={() => onRedo?.(index, message.content)}
            title={tr("chat.redo")}
          >
            <RefreshCw size={12} />
            {tr("chat.redo")}
          </button>
          <button
            type="button"
            className={styles.bubbleActionBtn}
            onClick={() => onRevert?.(index, message.content)}
            title={tr("chat.revert")}
          >
            <Pencil size={12} />
            {tr("chat.revert")}
          </button>
          <button
            type="button"
            className={classNames(styles.copyBtn, { [styles.copyBtnCopied]: isUserCopied })}
            onClick={() => handleCopySection(userCopyId, message.content)}
          >
            {isUserCopied ? <Check size={12} /> : <Copy size={12} />}
            {isUserCopied ? tr("chat.copied") : tr("chat.copy")}
          </button>
        </div>
      </div>
    );
  }

  const elements: ReactNode[] = [];
  const sources = message.sources ?? [];

  // TLDR
  if (message.tldr && message.tldr.length > 0) {
    const tldrId = "tldr";
    const tldrCopied = copiedSectionId === tldrId;
    const tldrCopyText = message.tldr.map((item) => item).join("\n");
    elements.push(
      <div key="tldr" className={styles.tldr}>
        <button
          type="button"
          className={classNames(styles.sectionCopyBtn, { [styles.sectionCopyBtnVisible]: tldrCopied })}
          onClick={() => handleCopySection(tldrId, tldrCopyText)}
        >
          {tldrCopied ? <Check size={12} /> : <Copy size={12} />}
          {tldrCopied ? tr("chat.copied") : tr("chat.copy")}
        </button>
        <div className={styles.tldrHeader}>
          <h3>{tr("chat.tldr")}</h3>
        </div>
        <ol>
          {message.tldr.map((item, idx) => (
            <li key={idx}>
              <WalletRichText text={item} inline />
            </li>
          ))}
        </ol>
      </div>,
    );
  }

  // Confidence
  // if (message.confidence) {
  //   elements.push(
  //     <span
  //       key="confidence"
  //       className={classNames(styles.confidenceBadge, styles[`confidence${message.confidence}`])}
  //     >
  //       {tr("chat.confidenceLabel", { level: tr(CONFIDENCE_LEVEL_KEYS[message.confidence]) })}
  //     </span>,
  //   );
  // }

  // Parsed content parts — text+cite groups rendered as inline flow
  for (const group of inlineGroups) {
    const isMixed = group.length > 1 || group.some((p) => p.type === "cite");
    const only = group[0];

    if (isMixed) {
      elements.push(
        <InlineFlow
          key={`flow-${elements.length}`}
          parts={group}
          sources={sources}
          hoveredCiteIds={hoveredCiteIds}
          onOpenPanel={handleOpenPanel}
          onHoverIds={handleHoverCiteIds}
          onLeaveIds={handleLeaveCiteIds}
        />,
      );
    } else if (only.type === "text" && only.content.trim()) {
      elements.push(
        <div key={`t-${elements.length}`} className={styles.textPart}>
          <WalletRichText text={only.content} />
        </div>,
      );
    } else if (only.type === "chart" && only.id) {
      const spec = message.charts?.find((c) => c.id === only.id) ?? {
        id: only.id, type: "line" as const, dataRef: only.id,
      };
      if (spec.type === "geckoterminal" && spec.poolAddress) {
        elements.push(
          <GeckoTerminalChart
            key={`gc-${only.id}`}
            poolAddress={spec.poolAddress}
            height="400"
          />,
        );
      } else if (message.data && spec.type !== "geckoterminal") {
        elements.push(
          <ChartRenderer key={`c-${only.id}`} spec={spec} data={message.data} onAction={onAction} />,
        );
      }
    } else if (only.type === "table" && message.data && only.id) {
      const spec = message.tables?.find((t) => t.id === only.id) ?? {
        id: only.id, dataRef: only.id, columns: "",
      };
      elements.push(
        <TableRenderer key={`t-${only.id}`} spec={spec} data={message.data} onAction={onAction} />,
      );
    } else if (only.type === "action" && only.id) {
      const actGroup = inlineByIndex[only.id];
      if (actGroup?.length) {
        elements.push(actionButtonGroup(actGroup, navigate, onAction));
      }
    }
  }

  // Source panel dropdown (ported to body)
  const showPanel = activePanelKey && activePanelIds.length > 0 && activePanelPos;

  // Sections
  if (message.sections && message.sections.length > 0) {
    elements.push(
      <div key="sections">
        {message.sections.map((section, idx) => (
          <WalletChatSectionRenderer
            key={`s-${idx}`}
            section={section}
            onBulletClick={handleBulletClick}
            onCopySection={handleCopySection}
            copiedSectionId={copiedSectionId}
          />
        ))}
      </div>,
    );
  }

  // Warnings
  if (message.warnings && message.warnings.length > 0) {
    const warnId = "warnings";
    const warnCopied = copiedSectionId === warnId;
    const warnCopyText = message.warnings.map((w) => w.text).join("\n");
    elements.push(
      <div key="warnings" className={styles.warnings}>
        <button
          type="button"
          className={classNames(styles.sectionCopyBtn, { [styles.sectionCopyBtnVisible]: warnCopied })}
          onClick={() => handleCopySection(warnId, warnCopyText)}
        >
          {warnCopied ? <Check size={12} /> : <Copy size={12} />}
          {warnCopied ? tr("chat.copied") : tr("chat.copy")}
        </button>
        <div className={styles.warnHeader}>
          <h3>{tr("chat.warnings")}</h3>
        </div>
        <ul>
          {message.warnings.map((w, i) => (
            <li key={i} className={styles[`warn${w.severity === "error" ? "Error" : w.severity === "warning" ? "Warning" : "Info"}`]}>
              <WalletRichText text={w.text} inline />
            </li>
          ))}
        </ul>
      </div>,
    );
  }

  // Evidence
  const visibleEvidence = showAllEvidence
    ? message.evidence
    : message.evidence?.slice(0, 6);

  if (message.evidence && message.evidence.length > 0) {
    const evId = "evidence";
    const evCopied = copiedSectionId === evId;
    const evCopyText = message.evidence.map((e) => [e.label, e.value, e.detail].filter(Boolean).join(": ")).join("\n");
    elements.push(
      <div key="evidence" className={styles.sectionBlock}>
        <button
          type="button"
          className={classNames(styles.sectionCopyBtn, { [styles.sectionCopyBtnVisible]: evCopied })}
          onClick={() => handleCopySection(evId, evCopyText)}
        >
          {evCopied ? <Check size={12} /> : <Copy size={12} />}
          {evCopied ? tr("chat.copied") : tr("chat.copy")}
        </button>
        <div className={styles.evidenceBlock}>
          <h3>{tr("chat.evidence")}</h3>
          <div className={styles.evidenceGrid}>
            {visibleEvidence?.map((item, idx) => (
              <div key={idx} className={styles.evidenceCard}>
                <span className={classNames(styles.evidenceTypeBadge, styles[`evidenceType${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`])}>
                  {item.type}
                </span>
                <strong><WalletRichText text={item.label} inline /></strong>
                {item.value && <div className={styles.evidenceValue}><WalletRichText text={item.value} inline /></div>}
                {item.detail && <div className={styles.evidenceDetail}><WalletRichText text={item.detail} /></div>}
              </div>
            ))}
          </div>
          {message.evidence.length > 6 && (
            <button type="button" className={styles.evidenceShowBtn} onClick={() => setShowAllEvidence((v) => !v)}>
              {showAllEvidence ? tr("chat.showLess") : tr("chat.showAll", { count: message.evidence.length })}
            </button>
          )}
        </div>
      </div>,
    );
  }

  // End actions
  if (endActions.length > 0) {
    elements.push(actionButtonGroup(endActions, navigate, onAction));
  }

  if (elements.length === 0) {
    elements.push(
      <div key="empty" className={styles.emptyPart}>{tr("common.noData")}</div>,
    );
  }

  const modalRoot = document.getElementById(ID_MODAL_ROOT);

  return (
    <>
      <div className={styles.assistantBubbleRow}>
        <div className={styles.assistantBubble}>{elements}</div>
      </div>
      {showPanel && modalRoot && ReactDOM.createPortal(
        <SourcePanel
          ids={activePanelIds}
          sources={sources}
          hoveredCiteIds={hoveredCiteIds}
          position={activePanelPos!}
          onHoverSource={handleHoverSource}
          onLeaveSource={handleLeaveSource}
          onClose={handleClosePanel}
        />,
        modalRoot,
      )}
    </>
  );
}
