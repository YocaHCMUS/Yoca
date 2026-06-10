import { ChevronDown, ChevronUp, Send } from "@carbon/icons-react";
import { Button, TextArea } from "@carbon/react";
import classNames from "classnames";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import {
  askTokenAiChat,
  type TokenAiChatData,
  type TokenAiSection,
  type TokenAiTimeframe,
} from "@/services/tokenAiChat";

import styles from "./TokenAIChat.module.scss";

interface TokenAIChatProps {
  address: string;
  symbol?: string;
  name?: string;
  timeframe?: TokenAiTimeframe;
}

const SUGGESTED_QUESTIONS = [
  "Why is this token moving?",
  "What is the latest news?",
  "What are the bullish and bearish signals?",
  "Is this token risky?",
  "Should I buy this token now?",
  "What should I watch next?",
  "Explain this token simply.",
];

const EVIDENCE_PRIORITY: Record<string, number> = {
  market: 0,
  chart: 1,
  volatility: 2,
  holders: 3,
  security: 4,
  pool: 5,
  news: 6,
};

const SECTION_KIND_META: Record<
  TokenAiSection["kind"],
  { label: string; icon: string; className: string }
> = {
  market_snapshot: {
    label: "Market Snapshot",
    icon: "M",
    className: "kindMarket",
  },
  key_drivers: {
    label: "Key Drivers",
    icon: "K",
    className: "kindDrivers",
  },
  deep_dive: {
    label: "Deep Dive",
    icon: "D",
    className: "kindDeepDive",
  },
  latest_headlines: {
    label: "Latest Headlines",
    icon: "N",
    className: "kindNews",
  },
  why_it_matters: {
    label: "Why It Matters",
    icon: "W",
    className: "kindWatch",
  },
  bullish_signals: {
    label: "Bullish Signals",
    icon: "+",
    className: "kindBullish",
  },
  bearish_signals: {
    label: "Bearish Signals",
    icon: "-",
    className: "kindBearish",
  },
  risk_factors: {
    label: "Risk Factors",
    icon: "!",
    className: "kindRisk",
  },
  what_to_watch: {
    label: "What To Watch",
    icon: "?",
    className: "kindWatch",
  },
  simple_explanation: {
    label: "Simple Explanation",
    icon: "i",
    className: "kindSimple",
  },
  scenario_analysis: {
    label: "Scenario Analysis",
    icon: "S",
    className: "kindScenario",
  },
  practical_framework: {
    label: "Practical Framework",
    icon: "F",
    className: "kindFramework",
  },
  conclusion: {
    label: "Conclusion",
    icon: "OK",
    className: "kindConclusion",
  },
  custom: {
    label: "Analysis",
    icon: "A",
    className: "kindSimple",
  },
};

const EVIDENCE_TYPE_META: Record<
  string,
  { label: string; className: string }
> = {
  market: { label: "Market", className: "evidenceTypeMarket" },
  chart: { label: "Chart", className: "evidenceTypeChart" },
  news: { label: "News", className: "evidenceTypeNews" },
  volatility: { label: "Volatility", className: "evidenceTypeVolatility" },
  holders: { label: "Holders", className: "evidenceTypeHolders" },
  pool: { label: "Pool", className: "evidenceTypePool" },
  trades: { label: "Trades", className: "evidenceTypeTrades" },
  security: { label: "Security", className: "evidenceTypeSecurity" },
  metadata: { label: "Metadata", className: "evidenceTypeMetadata" },
  internal: { label: "Internal", className: "evidenceTypeInternal" },
};

const METRIC_OR_SIGNAL_PATTERN =
  /([+-]\d+(?:\.\d+)?%|\$\s?\d[\d,]*(?:\.\d+)?\s?(?:K|M|B|T|million|billion|trillion)?|\b\d[\d,]*(?:\.\d+)?\s?(?:million|billion|trillion|holders?|buys?|sells?|trades?|transactions?|txns?|volume|market cap)\b|\b(?:bearish|decline|declines|declined|drop|drops|dropped|selling pressure|risk|risks|outflow|outflows|loss|losses)\b|\b(?:bullish|growth|increase|increases|increased|inflow|inflows|support|liquidity|adoption)\b|\b(?:warning|warnings|unavailable|missing|cannot verify|not available|limited data)\b)/gi;

const WEAK_WARNING_PATTERNS = [
  /\b(?:market cap|market capitalization|fdv)?\s*rank\b.*\bunavailable\b/i,
  /\brank unavailable\b/i,
  /\bcreator\b.*\bunavailable\b/i,
  /\bdeployer\b.*\bunavailable\b/i,
  /\bhoneypot\b.*\bunavailable\b/i,
  /\bsecurity flags?\b.*\bunavailable\b/i,
  /\bmint authority\b.*\bfreeze authority\b.*\b(?:deployer|creator|honeypot)\b/i,
  /\bsecurity (?:fields?|information)\b.*\b(?:unavailable|missing|not available)\b/i,
] as const;

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTokenLabel(data: TokenAiChatData) {
  const symbol = data.token.symbol ? data.token.symbol.toUpperCase() : null;
  if (data.token.name && symbol) return `${data.token.name} (${symbol})`;
  return data.token.name || symbol || data.token.address;
}

function sortEvidenceByUsefulness(data: TokenAiChatData) {
  return [...data.evidence].sort((a, b) => {
    const left = EVIDENCE_PRIORITY[a.type] ?? 99;
    const right = EVIDENCE_PRIORITY[b.type] ?? 99;
    if (left !== right) return left - right;
    return a.label.localeCompare(b.label);
  });
}

function warningKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWeakUnavailableWarning(value: string) {
  return WEAK_WARNING_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeVisibleWarnings(warnings: string[]) {
  const seen = new Set<string>();
  const visible: string[] = [];

  for (const warning of warnings) {
    const trimmed = warning.trim();
    if (!trimmed || isWeakUnavailableWarning(trimmed)) continue;
    const key = warningKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    visible.push(trimmed);
    if (visible.length >= 3) break;
  }

  return visible;
}

function hasSecurityLimitationWarning(warnings: string[]) {
  return warnings.some((warning) =>
    /\b(contract|security|mint\/freeze|mint authority|freeze authority|bảo mật)\b/i.test(
      warning,
    ),
  );
}

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
      segments.push({
        text: stripMarkdownArtifacts(value.slice(lastIndex, index)),
        bold: false,
      });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({
      text: stripMarkdownArtifacts(value.slice(lastIndex)),
      bold: false,
    });
  }

  return segments.length > 0
    ? segments.filter((segment) => segment.text.length > 0)
    : [{ text: stripMarkdownArtifacts(value), bold: false }];
}

function getMetricClass(value: string) {
  const normalized = value.toLowerCase();

  if (/^\+\d/.test(value) && value.includes("%")) return "metricPositive";
  if (/^-\d/.test(value) && value.includes("%")) return "metricNegative";
  if (value.trim().startsWith("$")) return "metricMoney";
  if (
    /\b(warning|warnings|unavailable|missing|cannot verify|not available|limited data)\b/.test(
      normalized,
    )
  ) {
    return "warningText";
  }
  if (
    /\b(bearish|decline|declines|declined|drop|drops|dropped|selling pressure|risk|risks|outflow|outflows|loss|losses)\b/.test(
      normalized,
    )
  ) {
    return "riskText";
  }
  if (
    /\b(bullish|growth|increase|increases|increased|inflow|inflows|support|liquidity|adoption)\b/.test(
      normalized,
    )
  ) {
    return "bullishText";
  }
  return "metricNeutral";
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
    const metricClass = getMetricClass(text);
    nodes.push(
      <span
        key={`${keyPrefix}-${index}`}
        className={classNames(styles.metricToken, styles[metricClass])}
      >
        {text}
      </span>,
    );
    lastIndex = index + text.length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
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

function TokenAiRichText({
  text,
  inline = false,
}: {
  text?: string | number | null;
  inline?: boolean;
}) {
  const value = String(text ?? "").trim();
  if (!value) return null;

  if (inline) return <>{renderInlineRichText(value)}</>;

  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <>
      {blocks.map((block, blockIdx) => {
        const lines = block
          .split(/\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length > 0 && lines.every(isBulletLikeLine)) {
          return (
            <ul key={blockIdx} className={styles.richList}>
              {lines.map((line, lineIdx) => (
                <li key={lineIdx}>
                  {renderInlineRichText(
                    cleanBulletLine(line),
                    `rich-${blockIdx}-${lineIdx}`,
                  )}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <div key={blockIdx} className={styles.richParagraphGroup}>
            {lines.map((line, lineIdx) =>
              isBulletLikeLine(line) ? (
                <div
                  key={lineIdx}
                  className={styles.richBulletLine}
                >
                  <span aria-hidden="true" />
                  <span>
                    {renderInlineRichText(
                      cleanBulletLine(line),
                      `rich-${blockIdx}-${lineIdx}`,
                    )}
                  </span>
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

function getEvidenceTypeMeta(type: string) {
  return (
    EVIDENCE_TYPE_META[type] ?? {
      label: type.replace(/_/g, " "),
      className: "evidenceTypeInternal",
    }
  );
}

function getSourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getProviderLabel(provider: TokenAiChatData["provider"]) {
  switch (provider) {
    case "gemini":
      return "Gemini";
    case "gemini_model_fallback":
      return "Gemini fallback model";
    case "cached_gemini":
      return "Recent Gemini analysis";
    case "analyst_fallback":
      return "Yoca Analyst Fallback";
    case "deterministic":
    default:
      return "Deterministic";
  }
}

function getCacheLabel(cache: TokenAiChatData["cache"]) {
  if (!cache) return "Cache unknown";
  return cache.hit ? "Cache hit" : "Cache miss";
}

function getModelModeLabel(answer: TokenAiChatData) {
  const used = answer.modelModeUsed ?? answer.modelModeRequested;
  if (!used) return null;
  return `${used.charAt(0).toUpperCase()}${used.slice(1)} mode`;
}

function formatFallbackReason(reason: string) {
  return reason.replace(/_/g, " ");
}

function getConfidenceClass(confidence: TokenAiChatData["confidence"]) {
  if (confidence === "High") return styles.confidenceHigh;
  if (confidence === "Medium") return styles.confidenceMedium;
  return styles.confidenceLow;
}

function SectionTable({
  table,
}: {
  table: Array<Record<string, string | number | null>>;
}) {
  const columns = useMemo(() => {
    const keys = new Set<string>();
    table.forEach((row) => {
      Object.keys(row).forEach((key) => keys.add(key));
    });
    return [...keys].slice(0, 6);
  }, [table]);

  if (columns.length === 0) return null;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.sectionTable}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, idx) => (
            <tr key={idx}>
              {columns.map((column) => (
                <td key={column}>
                  <TokenAiRichText text={row[column] ?? "-"} inline />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnswerSection({ section }: { section: TokenAiSection }) {
  const meta = SECTION_KIND_META[section.kind] ?? SECTION_KIND_META.custom;

  return (
    <section
      className={classNames(styles.answerSection, styles[meta.className])}
    >
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <span className={styles.sectionIcon} aria-hidden="true">
            {meta.icon}
          </span>
          <h4>
            <TokenAiRichText text={section.title} inline />
          </h4>
        </div>
        <span className={styles.sectionKind}>{meta.label}</span>
      </div>
      {section.content && (
        <div className={styles.sectionContent}>
          <TokenAiRichText text={section.content} />
        </div>
      )}
      {section.bullets && section.bullets.length > 0 && (
        <ul className={styles.sectionBulletList}>
          {section.bullets.map((bullet, idx) => (
            <li key={idx}>
              <TokenAiRichText text={bullet} inline />
            </li>
          ))}
        </ul>
      )}
      {section.table && section.table.length > 0 && (
        <SectionTable table={section.table} />
      )}
    </section>
  );
}

export function TokenAIChat({
  address,
  symbol,
  name,
  timeframe = "24h",
}: TokenAIChatProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<TokenAiChatData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);

  const trimmedQuestion = question.trim();
  const validationError =
    trimmedQuestion.length === 0
      ? "Enter a question about this token."
      : trimmedQuestion.length > 500
        ? "Question must be 500 characters or fewer."
        : null;
  const sortedEvidence = useMemo(
    () => (answer ? sortEvidenceByUsefulness(answer) : []),
    [answer],
  );
  const visibleWarnings = useMemo(
    () => (answer ? normalizeVisibleWarnings(answer.warnings) : []),
    [answer],
  );
  const visibleEvidence = showAllEvidence
    ? sortedEvidence
    : sortedEvidence.slice(0, 6);
  const visibleSources = showAllSources
    ? answer?.sources ?? []
    : answer?.sources.slice(0, 5) ?? [];

  const submitQuestion = async (nextQuestion = trimmedQuestion) => {
    const finalQuestion = nextQuestion.trim();
    if (!finalQuestion || finalQuestion.length > 500 || isLoading) return;

    setQuestion(finalQuestion);
    setIsLoading(true);
    setError(null);

    try {
      const data = await askTokenAiChat({
        address,
        symbol,
        name,
        question: finalQuestion,
        timeframe,
        includeNews: true,
        includeVolatility: true,
      });
      setAnswer(data);
      setShowAllEvidence(false);
      setShowAllSources(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token AI chat failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>Ask Yoca AI</h2>
          <p>
            Ask about this token using Yoca market, news, volatility, and
            on-chain context.
          </p>
        </div>
      </div>

      <div className={styles.chips}>
        {SUGGESTED_QUESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className={styles.chip}
            onClick={() => submitQuestion(suggestion)}
            disabled={isLoading}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className={styles.inputRow}>
        <TextArea
          labelText=""
          hideLabel
          value={question}
          maxLength={500}
          placeholder="Ask about price moves, news, risk, signals, or what to watch."
          rows={3}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitQuestion();
            }
          }}
          disabled={isLoading}
          invalid={trimmedQuestion.length > 500}
          invalidText="Question must be 500 characters or fewer."
        />
        <Button
          kind="primary"
          size="md"
          renderIcon={Send}
          onClick={() => submitQuestion()}
          disabled={isLoading || Boolean(validationError)}
        >
          Send
        </Button>
      </div>

      <div className={styles.inputMeta}>
        <span>{trimmedQuestion.length}/500</span>
        {trimmedQuestion.length > 0 && validationError && (
          <span className={styles.validation}>{validationError}</span>
        )}
      </div>

      {isLoading && (
        <div className={styles.loading} aria-live="polite">
          Analyzing token evidence...
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {answer && !isLoading && (
        <div className={styles.answer}>
          <div className={styles.answerHeader}>
            <div>
              <div className={styles.answerEyebrow}>
                {answer.intent.replace(/_/g, " ")}
              </div>
              <h3 className={styles.answerTitle}>
                Yoca AI answer for{" "}
                {answer.token.yocaUrl ? (
                  <Link to={answer.token.yocaUrl} className={styles.tokenLink}>
                    {getTokenLabel(answer)}
                  </Link>
                ) : (
                  <span>{getTokenLabel(answer)}</span>
                )}
              </h3>
              <div className={styles.answerMode}>
                <span>{getModelModeLabel(answer) ?? "Deep Analysis"}</span>
                <span>{getProviderLabel(answer.provider)}</span>
                {answer.modelUsed && <span>{answer.modelUsed}</span>}
                {answer.stale && <span>Stale</span>}
                <span>{getCacheLabel(answer.cache)}</span>
              </div>
            </div>
            <div className={styles.answerStatus}>
              <span
                className={classNames(
                  styles.confidenceBadge,
                  getConfidenceClass(answer.confidence),
                )}
              >
                {answer.confidence} confidence
              </span>
              <div className={styles.asOf}>
                As of {formatDateTime(answer.asOf)}, using Yoca market, news,
                volatility, and available on-chain context.
              </div>
            </div>
          </div>

          <div className={styles.tldr}>
            <div className={styles.tldrHeader}>
              <span className={styles.tldrIcon} aria-hidden="true">
                AI
              </span>
              <h3>TLDR</h3>
            </div>
            <ol>
              {answer.tldr.map((item, idx) => (
                <li key={idx}>
                  <span className={styles.tldrNumber}>{idx + 1}</span>
                  <span>
                    <TokenAiRichText text={item} inline />
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.sections}>
            {answer.sections.map((section, idx) => (
              <AnswerSection key={`${section.title}-${idx}`} section={section} />
            ))}
          </div>

          {visibleWarnings.length > 0 && (
            <div className={styles.warnings}>
              <div className={styles.warningHeader}>
                <span className={styles.warningIcon} aria-hidden="true">
                  !
                </span>
                <h3>
                  {hasSecurityLimitationWarning(visibleWarnings)
                    ? "Data Limitations"
                    : "Warnings / Data Limitations"}
                </h3>
              </div>
              <ul>
                {visibleWarnings.map((warning, idx) => (
                  <li key={idx}>
                    <TokenAiRichText text={warning} inline />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sortedEvidence.length > 0 && (
            <div className={styles.referenceBlock}>
              <div className={styles.referenceHeader}>
                <div>
                  <h3>Key Evidence</h3>
                  <p>
                    Showing {visibleEvidence.length} of {sortedEvidence.length}
                  </p>
                </div>
                {sortedEvidence.length > 6 && (
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={showAllEvidence ? ChevronUp : ChevronDown}
                    onClick={() => setShowAllEvidence((current) => !current)}
                  >
                    {showAllEvidence ? "Show key evidence" : "Show all evidence"}
                  </Button>
                )}
              </div>
              <div className={styles.evidenceGrid}>
                {visibleEvidence.map((item, idx) => (
                  <div key={`${item.label}-${idx}`} className={styles.evidenceCard}>
                    <div className={styles.evidenceTop}>
                      {(() => {
                        const meta = getEvidenceTypeMeta(item.type);
                        return (
                          <span
                            className={classNames(
                              styles.evidenceTypeBadge,
                              styles[meta.className],
                            )}
                          >
                            {meta.label}
                          </span>
                        );
                      })()}
                      {item.timestamp && <time>{formatDateTime(item.timestamp)}</time>}
                    </div>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <TokenAiRichText text={item.label} inline />
                      </a>
                    ) : (
                      <strong>
                        <TokenAiRichText text={item.label} inline />
                      </strong>
                    )}
                    {item.value && (
                      <div className={styles.evidenceValue}>
                        <TokenAiRichText text={item.value} inline />
                      </div>
                    )}
                    {item.detail && (
                      <div className={styles.evidenceDetail}>
                        <TokenAiRichText text={item.detail} />
                      </div>
                    )}
                    {item.source && <div className={styles.sourceLine}>{item.source}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {answer.sources.length > 0 && (
            <div className={styles.referenceBlock}>
              <div className={styles.referenceHeader}>
                <div>
                  <h3>Sources</h3>
                  <p>
                    Showing {visibleSources.length} of {answer.sources.length}
                  </p>
                </div>
                {answer.sources.length > 5 && (
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={showAllSources ? ChevronUp : ChevronDown}
                    onClick={() => setShowAllSources((current) => !current)}
                  >
                    {showAllSources ? "Show top sources" : "Show all sources"}
                  </Button>
                )}
              </div>
              <div className={styles.sourcesList}>
                {visibleSources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.sourceItem}
                  >
                    <div>
                      <strong>
                        <TokenAiRichText text={source.title} inline />
                      </strong>
                      {source.snippet && (
                        <div className={styles.sourceSnippet}>
                          <TokenAiRichText text={source.snippet} />
                        </div>
                      )}
                    </div>
                    <span className={styles.sourceMeta}>
                      <span>
                        {source.publisher || getSourceDomain(source.url) || "Source"}
                      </span>
                      {source.publishedAt && (
                        <span>{formatDateTime(source.publishedAt)}</span>
                      )}
                      <span className={styles.externalCue}>Open</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className={styles.footer}>
            <div className={styles.disclaimer}>
              <TokenAiRichText text={answer.disclaimer} />
            </div>
            <span className={styles.footerMeta}>
              Provider: {getProviderLabel(answer.provider)}
              {answer.cache
                ? ` | cache ${answer.cache.hit ? "hit" : "miss"}`
                : ""}
              {answer.fallbackReason
                ? ` | fallback: ${formatFallbackReason(answer.fallbackReason)}`
                : ""}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
