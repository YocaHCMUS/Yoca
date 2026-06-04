import { ChevronDown, ChevronUp, Send } from "@carbon/icons-react";
import { Button, TextArea, Tag } from "@carbon/react";
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
  pool: 4,
  news: 5,
};

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
                <td key={column}>{row[column] ?? "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnswerSection({ section }: { section: TokenAiSection }) {
  return (
    <section className={styles.answerSection}>
      <div className={styles.sectionHeader}>
        <h4>{section.title}</h4>
        <span>{section.kind.replace(/_/g, " ")}</span>
      </div>
      {section.content && <p>{section.content}</p>}
      {section.bullets && section.bullets.length > 0 && (
        <ul>
          {section.bullets.map((bullet, idx) => (
            <li key={idx}>{bullet}</li>
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
        {answer && (
          <Tag
            type={
              answer.confidence === "High"
                ? "green"
                : answer.confidence === "Medium"
                  ? "blue"
                  : "gray"
            }
            size="sm"
          >
            {answer.confidence} confidence
          </Tag>
        )}
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
                <Link to={answer.token.yocaUrl} className={styles.tokenLink}>
                  {getTokenLabel(answer)}
                </Link>
              </h3>
            </div>
            <div className={styles.asOf}>
              As of {formatDateTime(answer.asOf)}, using Yoca market, news,
              volatility, and available on-chain context.
            </div>
          </div>

          <div className={styles.tldr}>
            <h3>TLDR</h3>
            <ul>
              {answer.tldr.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div className={styles.sections}>
            {answer.sections.map((section, idx) => (
              <AnswerSection key={`${section.title}-${idx}`} section={section} />
            ))}
          </div>

          {answer.warnings.length > 0 && (
            <div className={styles.warnings}>
              <h3>Warnings</h3>
              <ul>
                {answer.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
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
                      <span>{item.type}</span>
                      {item.timestamp && <time>{formatDateTime(item.timestamp)}</time>}
                    </div>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.label}
                      </a>
                    ) : (
                      <strong>{item.label}</strong>
                    )}
                    {item.value && <div className={styles.evidenceValue}>{item.value}</div>}
                    {item.detail && <p>{item.detail}</p>}
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
                      <strong>{source.title}</strong>
                      {source.snippet && <p>{source.snippet}</p>}
                    </div>
                    <span>
                      {source.publisher || "Source"}
                      {source.publishedAt
                        ? ` | ${formatDateTime(source.publishedAt)}`
                        : ""}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className={styles.footer}>
            <p>{answer.disclaimer}</p>
            <span>
              Provider: {answer.provider}
              {answer.cache
                ? ` | cache ${answer.cache.hit ? "hit" : "miss"}`
                : ""}
              {answer.fallbackReason
                ? ` | fallback: ${answer.fallbackReason.replace(/_/g, " ")}`
                : ""}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
