import classNames from "classnames";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Copy, Checkmark } from "@carbon/icons-react";
import { useLocalization } from "@/contexts/LocalizationContext";
import type {
  ActionSpec,
  ChatMessageItem,
  ChatSource,
  WalletChatSection,
  WalletSectionKind,
} from "./types";
import { ChartRenderer, TableRenderer } from "./WalletChatChartRenderer";
import styles from "./WalletChat.module.scss";

interface Props {
  message: ChatMessageItem;
  onAction?: (href: string) => void;
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
  /([+-]\d+(?:\.\d+)?%|\$\s?\d[\d,]*(?:\.\d+)?\s?(?:K|M|B|T)?|\b\d[\d,]*(?:\.\d+)?\s?(?:million|billion|trillion)?|\b(?:bearish|decline|declines|declined|drop|drops|dropped|selling|pressure|risk|risks|outflow|outflows|loss|losses)\b|\b(?:bullish|growth|increase|increases|increased|inflow|inflows|support|liquidity|adoption|profitable|win)\b|\b(?:warning|unavailable|missing|cannot verify|not available|limited data)\b)/gi;

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
  const normalized = value.toLowerCase();

  if (/^\+\d/.test(value) && value.includes("%")) return "metricPositive";
  if (/^-\d/.test(value) && value.includes("%")) return "metricNegative";
  if (value.trim().startsWith("$")) return "metricMoney";
  if (/\b(warning|unavailable|missing|cannot verify|not available|limited data)\b/.test(normalized)) return "warningText";
  if (/\b(bearish|decline|declines|declined|drop|drops|dropped|selling|pressure|risk|risks|outflow|outflows|loss|losses)\b/.test(normalized)) return "riskText";
  if (/\b(bullish|growth|increase|increases|increased|inflow|inflows|support|liquidity|adoption|profitable|win)\b/.test(normalized)) return "bullishText";
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

const SECTION_KIND_META: Record<WalletSectionKind, { label: string; icon: string; className: string }> = {
  market_snapshot:  { label: "Market Snapshot",  icon: "M", className: "kindMarket" },
  key_findings:     { label: "Key Findings",     icon: "K", className: "kindDrivers" },
  pnl_summary:      { label: "PnL Summary",      icon: "P", className: "kindBullish" },
  trading_activity: { label: "Trading Activity", icon: "T", className: "kindNews" },
  top_holdings:     { label: "Top Holdings",     icon: "H", className: "kindDeepDive" },
  risk_factors:     { label: "Risk Factors",     icon: "!", className: "kindRisk" },
  what_to_watch:    { label: "What To Watch",    icon: "?", className: "kindWatch" },
  conclusion:       { label: "Conclusion",       icon: "\u2713", className: "kindConclusion" },
  custom:           { label: "Analysis",         icon: "A", className: "kindSimple" },
};

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
    <div className={classNames(styles.sectionBlock, styles[meta.className])}>
      <button
        type="button"
        className={classNames(styles.sectionCopyBtn, { [styles.sectionCopyBtnVisible]: isCopied })}
        onClick={() => onCopySection?.(sectionId, sectionCopyText)}
        title={tr("chat.copySection")}
      >
        {isCopied ? <Checkmark size={12} /> : <Copy size={12} />}
        {isCopied ? tr("chat.copied") : tr("chat.copy")}
      </button>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">{meta.icon}</span>
        <div className={styles.sectionHeaderInner}>
          <span className={styles.sectionKind}>{meta.label}</span>
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

function buildPillLabel(ids: string[], allSources: ChatSource[]): string {
  const maxVisible = 2;
  const visible = ids.slice(0, maxVisible);
  const remainder = ids.length - maxVisible;
  const nums = visible.join(", ");
  return remainder > 0 ? `sources: ${nums}, +${remainder}` : `sources: ${nums}`;
}

function CitedTextBlock({
  ids,
  content,
  sources,
  activePanelKey,
  hoveredCiteIds,
  onOpenPanel,
  onHoverIds,
  onLeaveIds,
}: {
  ids: string[];
  content: string;
  sources: ChatSource[];
  activePanelKey: string | null;
  hoveredCiteIds: number[];
  onOpenPanel: (key: string, ids: string[]) => void;
  onHoverIds: (ids: string[]) => void;
  onLeaveIds: () => void;
}) {
  const numIds = ids.map(Number);
  const matchesHover = hoveredCiteIds.some((h) => numIds.includes(h));
  const isActive = activePanelKey === ids.join(",");

  return (
    <span
      className={classNames(styles.citeBlock, {
        [styles.citeBlockHighlighted]: matchesHover || isActive,
      })}
      onMouseEnter={() => onHoverIds(ids)}
      onMouseLeave={onLeaveIds}
    >
      <WalletRichText text={content} inline />
      <button
        type="button"
        className={styles.citePill}
        onClick={() => onOpenPanel(ids.join(","), ids)}
      >
        📎 {buildPillLabel(ids, sources)}
      </button>
    </span>
  );
}

function SourceCard({
  source,
  idx,
  isHighlighted,
  onHover,
  onLeave,
}: {
  source: ChatSource;
  idx: number;
  isHighlighted: boolean;
  onHover: (num: number) => void;
  onLeave: () => void;
}) {
  return (
    <div
      className={classNames(styles.sourceCard, { [styles.sourceCardHighlighted]: isHighlighted })}
      onMouseEnter={() => onHover(idx)}
      onMouseLeave={onLeave}
    >
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.sourceCardTitle}
      >
        {source.title}
      </a>
      <span className={styles.sourceCardDomain}>{source.source}</span>
      {source.snippet && <p className={styles.sourceCardSnippet}>{source.snippet}</p>}
      <div className={styles.sourceCardFooter}>
        {source.publishedAt && (
          <span className={styles.sourceCardDate}>{formatDate(source.publishedAt)}</span>
        )}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sourceCardOpen}
        >
          Open ↗
        </a>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function SourcePanel({
  ids,
  sources,
  hoveredCiteIds,
  onHoverSource,
  onLeaveSource,
  onClose,
}: {
  ids: string[];
  sources: ChatSource[];
  hoveredCiteIds: number[];
  onHoverSource: (num: number) => void;
  onLeaveSource: () => void;
  onClose: () => void;
}) {
  const { tr } = useLocalization();
  const matched = ids
    .map((id) => ({ idx: parseInt(id, 10), source: sources[parseInt(id, 10) - 1] }))
    .filter((item) => item.source);

  if (matched.length === 0) return null;

  return (
    <div className={styles.sourcePanel}>
      <div className={styles.sourcePanelHeader}>
        <span className={styles.sourcePanelTitle}>{tr("chat.sources")}</span>
        <button type="button" className={styles.sourcePanelClose} onClick={onClose}>✕</button>
      </div>
      {matched.map(({ idx, source }) => (
        <SourceCard
          key={idx}
          source={source}
          idx={idx}
          isHighlighted={hoveredCiteIds.includes(idx)}
          onHover={onHoverSource}
          onLeave={onLeaveSource}
        />
      ))}
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

export function WalletChatMessage({ message, onAction }: Props) {
  const navigate = useNavigate();
  const { tr } = useLocalization();
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const [activePanelKey, setActivePanelKey] = useState<string | null>(null);
  const [activePanelIds, setActivePanelIds] = useState<string[]>([]);
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

  const handleOpenPanel = useCallback((key: string, ids: string[]) => {
    setActivePanelKey((prev) => (prev === key ? null : key));
    setActivePanelIds(ids);
  }, []);

  const handleClosePanel = useCallback(() => {
    setActivePanelKey(null);
    setActivePanelIds([]);
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
    return (
      <div className={styles.userBubbleRow}>
        <div className={styles.userBubble}>{message.content}</div>
        <div className={styles.bubbleActions}>
          <button
            type="button"
            className={classNames(styles.copyBtn, { [styles.copyBtnCopied]: isUserCopied })}
            onClick={() => handleCopySection(userCopyId, message.content)}
          >
            {isUserCopied ? <Checkmark size={12} /> : <Copy size={12} />}
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
      <div key="tldr" className={styles.sectionCopyWrapper}>
        <button
          type="button"
          className={classNames(styles.sectionCopyBtn, { [styles.sectionCopyBtnVisible]: tldrCopied })}
          onClick={() => handleCopySection(tldrId, tldrCopyText)}
        >
          {tldrCopied ? <Checkmark size={12} /> : <Copy size={12} />}
          {tldrCopied ? tr("chat.copied") : tr("chat.copy")}
        </button>
        <div className={styles.tldr}>
          <div className={styles.tldrHeader}>
            <span className={styles.tldrIcon}>AI</span>
            <h3>{tr("chat.tldr")}</h3>
          </div>
          <ol>
            {message.tldr.map((item, idx) => (
              <li key={idx}>
                <span className={styles.tldrNumber}>{idx + 1}</span>
                <WalletRichText text={item} inline />
              </li>
            ))}
          </ol>
        </div>
      </div>,
    );
  }

  // Confidence
  if (message.confidence) {
    elements.push(
      <span
        key="confidence"
        className={classNames(styles.confidenceBadge, styles[`confidence${message.confidence}`])}
      >
        {message.confidence} {tr("chat.confidence")}
      </span>,
    );
  }

  // Parsed content parts (text, cite, charts, tables, actions)
  for (const part of parsed) {
    if (part.type === "text" && part.content.trim()) {
      elements.push(
        <div key={`t-${elements.length}`} className={styles.textPart}>
          <WalletRichText text={part.content} />
        </div>,
      );
    }

    if (part.type === "cite") {
      elements.push(
        <CitedTextBlock
          key={`cite-${elements.length}`}
          ids={part.ids}
          content={part.content}
          sources={sources}
          activePanelKey={activePanelKey}
          hoveredCiteIds={hoveredCiteIds}
          onOpenPanel={handleOpenPanel}
          onHoverIds={handleHoverCiteIds}
          onLeaveIds={handleLeaveCiteIds}
        />,
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

  // Source panel (active cite block)
  if (activePanelKey && activePanelIds.length > 0) {
    elements.push(
      <SourcePanel
        key="source-panel"
        ids={activePanelIds}
        sources={sources}
        hoveredCiteIds={hoveredCiteIds}
        onHoverSource={handleHoverSource}
        onLeaveSource={handleLeaveSource}
        onClose={handleClosePanel}
      />,
    );
  }

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
      <div key="warnings" className={styles.sectionCopyWrapper}>
        <button
          type="button"
          className={classNames(styles.sectionCopyBtn, { [styles.sectionCopyBtnVisible]: warnCopied })}
          onClick={() => handleCopySection(warnId, warnCopyText)}
        >
          {warnCopied ? <Checkmark size={12} /> : <Copy size={12} />}
          {warnCopied ? tr("chat.copied") : tr("chat.copy")}
        </button>
        <div className={styles.warnings}>
          <div className={styles.warnHeader}>
            <span className={styles.warnIcon}>!</span>
            <h3>{tr("chat.warnings")}</h3>
          </div>
          <ul>
            {message.warnings.map((w, i) => (
              <li key={i} className={styles[`warn${w.severity === "error" ? "Error" : w.severity === "warning" ? "Warning" : "Info"}`]}>
                <WalletRichText text={w.text} inline />
              </li>
            ))}
          </ul>
        </div>
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
          {evCopied ? <Checkmark size={12} /> : <Copy size={12} />}
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

  // Suggested question chips
  const askChips = endActions.filter((a) => a.href.startsWith("#ask:"));
  if (askChips.length > 0) {
    elements.push(
      <div key="chips" className={styles.chips}>
        {askChips.map((a, i) => (
          <button key={i} type="button" className={styles.chip} onClick={() => onAction?.(a.href.slice(5))}>
            {a.label}
          </button>
        ))}
      </div>,
    );
  }

  // End actions (non-ask)
  const nonAskEndActions = endActions.filter((a) => !a.href.startsWith("#ask:"));
  if (nonAskEndActions.length > 0) {
    elements.push(actionButtonGroup(nonAskEndActions, navigate, onAction));
  }

  if (elements.length === 0) {
    elements.push(
      <div key="empty" className={styles.emptyPart}>{tr("common.noData")}</div>,
    );
  }

  return (
    <div className={styles.assistantBubbleRow}>
      <div className={styles.assistantBubble}>{elements}</div>
    </div>
  );
}
