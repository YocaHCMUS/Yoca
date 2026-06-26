import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import styles from "./WashTradingChat.module.scss";

const API_DOMAIN: string = import.meta.env.VITE_CLIENT_API_DOMAIN || "";
const MAX_INPUT_LENGTH = 500;

type InlineIconProps = {
  size?: number;
  strokeWidth?: number;
};

const InsightOrbitIcon = ({ size = 18, strokeWidth = 1.9 }: InlineIconProps) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="2.35" fill="currentColor" stroke="none" />
    <ellipse cx="12" cy="12" rx="8.7" ry="4.65" stroke="currentColor" strokeWidth={strokeWidth} />
    <path d="M7.5 5.2C4.95 8.15 4.95 15.85 7.5 18.8" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    <path d="M16.5 5.2C19.05 8.15 19.05 15.85 16.5 18.8" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
  </svg>
);

const ResetIcon = ({ size = 16, strokeWidth = 1.9 }: InlineIconProps) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20 11a8 8 0 1 0 2 5.4" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    <path d="M20 4v7h-7" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = ({ size = 17, strokeWidth = 1.9 }: InlineIconProps) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
  </svg>
);

const SendIcon = ({ size = 16, strokeWidth = 1.9 }: InlineIconProps) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M21 3 10.2 13.8M21 3l-6.7 18-4.1-7.2L3 9.7 21 3Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export type WashTradingChatAlgorithm = "GCN" | "GAT" | "GraphSAGE";
export type WashTradingChatTimeframe = "24h" | "7d" | "30d";

export interface WashTradingChatContext {
  mint: string;
  symbol: string;
  timeframe: WashTradingChatTimeframe;
  algorithm: WashTradingChatAlgorithm;
  dataSource?: "helius-rpc-token-accounts" | "helius-enhanced-api" | "demo-fallback";
  analyzedAt?: string;
  riskScore?: number;
  isAnalysisReady: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

interface ChatApiResponse {
  success: boolean;
  data?: {
    answer: string;
    suggestions?: string[];
  };
  error?: string;
  message?: string;
}

interface Props {
  context: WashTradingChatContext;
  disabled?: boolean;
}

const shorten = (value: string) => {
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
};

const getRiskTone = (score?: number) => {
  if (score == null) return "neutral";
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
};

export function WashTradingChat({ context, disabled = false }: Props) {
  const { lang } = useLocalization();
  const { theme } = useUserTheme();
  const isLight = theme === "light";
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scopeKey = `${context.mint}:${context.timeframe}:${context.algorithm}`;

  const quickQuestions = useMemo(
    () =>
      lang === "vi"
        ? [
            "Vì sao token này có điểm rủi ro như hiện tại?",
            "Giải thích các circular trade cluster đã phát hiện.",
            "Ví nào đáng chú ý nhất và vì sao?",
            `Cấu hình ${context.algorithm} chấm điểm như thế nào?`,
          ]
        : [
            "Why does this token have its current risk score?",
            "Explain the detected circular-trade clusters.",
            "Which wallet is most noteworthy and why?",
            `How does the ${context.algorithm} scoring profile work?`,
          ],
    [context.algorithm, lang],
  );

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [scopeKey]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isOpen, messages, isLoading, error]);

  useEffect(() => {
    if (isOpen && !isLoading) {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, isLoading]);

  const sendQuestion = async (question: string) => {
    const query = question.trim();
    if (!query || isLoading || disabled || !context.mint) return;

    const userMessage: ChatMessage = { role: "user", content: query };
    const history = messages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_DOMAIN}/api/v1/wash-trading/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: context.mint,
          symbol: context.symbol || "TOKEN",
          timeframe: context.timeframe,
          algorithm: context.algorithm,
          language: lang === "vi" ? "vi" : "en",
          query,
          history,
        }),
      });

      const payload = (await response.json()) as ChatApiResponse;
      if (!response.ok || !payload.success || !payload.data?.answer) {
        throw new Error(payload.message || payload.error || (lang === "vi" ? "Không thể tạo câu trả lời AI." : "Unable to generate an AI response."));
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.data!.answer,
          suggestions: payload.data!.suggestions?.slice(0, 3),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === "vi" ? "Đã có lỗi xảy ra." : "Something went wrong."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(input);
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setInput("");
    setError(null);
  };

  const statusLabel = context.isAnalysisReady
    ? lang === "vi"
      ? "Đang dùng dữ liệu phân tích hiện tại"
      : "Using the current analysis data"
    : lang === "vi"
      ? "Sẽ dùng dữ liệu của token đang mở"
      : "Will use the token currently open";

  const dataSourceLabel = context.dataSource === "demo-fallback"
    ? "Demo"
    : context.dataSource === "helius-enhanced-api"
      ? "Helius Enhanced"
      : context.dataSource === "helius-rpc-token-accounts"
        ? "Helius RPC"
        : lang === "vi" ? "Chờ dữ liệu" : "Waiting for data";

  const riskTone = getRiskTone(context.riskScore);
  const riskLabel = context.riskScore == null
    ? lang === "vi" ? "Chưa có điểm" : "No score yet"
    : lang === "vi"
      ? `Risk ${Math.round(context.riskScore)}/100`
      : `Risk ${Math.round(context.riskScore)}/100`;

  return (
    <div className={`${styles.root} ${isLight ? styles.light : ""}`} aria-live="polite">
      {isOpen && (
        <section className={styles.panel} aria-label={lang === "vi" ? "Trợ lý phân tích wash trading" : "Wash trading analysis assistant"}>
          <header className={styles.header}>
            <div className={styles.brand}>
              <span className={styles.brandIcon}><InsightOrbitIcon size={17} /></span>
              <div>
                <span className={styles.brandEyebrow}>{lang === "vi" ? "AI ANALYSIS DESK" : "AI ANALYSIS DESK"}</span>
                <strong>{lang === "vi" ? "Trợ lý Wash Trading" : "Wash Trading Analyst"}</strong>
                <span className={styles.brandStatus}><i />{statusLabel}</span>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.headerButton}
                onClick={resetConversation}
                title={lang === "vi" ? "Cuộc trò chuyện mới" : "New conversation"}
                aria-label={lang === "vi" ? "Cuộc trò chuyện mới" : "New conversation"}
              >
                <ResetIcon size={15} />
              </button>
              <button
                type="button"
                className={styles.headerButton}
                onClick={() => setIsOpen(false)}
                title={lang === "vi" ? "Đóng" : "Close"}
                aria-label={lang === "vi" ? "Đóng" : "Close"}
              >
                <CloseIcon size={17} />
              </button>
            </div>
          </header>

          <div className={styles.contextStrip}>
            <div className={styles.tokenIdentity}>
              <span className={styles.tokenGlyph}>◎</span>
              <div>
                <span className={styles.scopeLabel}>{lang === "vi" ? "TOKEN ĐANG PHÂN TÍCH" : "ACTIVE TOKEN"}</span>
                <strong>{context.symbol || "TOKEN"}</strong>
                <span className={styles.mint} title={context.mint}>{shorten(context.mint)}</span>
              </div>
            </div>

            <div className={styles.analysisSummary}>
              <span className={`${styles.riskPill} ${styles[`risk_${riskTone}`]}`}>{riskLabel}</span>
              <div className={styles.contextChips}>
                <span>{context.timeframe}</span>
                <span>{context.algorithm}</span>
                <span className={context.dataSource === "demo-fallback" ? styles.demoChip : ""}>{dataSourceLabel}</span>
              </div>
            </div>
          </div>

          <div ref={listRef} className={styles.messages}>
            {messages.length === 0 ? (
              <div className={styles.welcome}>
                <div className={styles.welcomeIcon}><InsightOrbitIcon size={24} /></div>
                <div className={styles.welcomeEyebrow}>{lang === "vi" ? "PHÂN TÍCH CÓ NGỮ CẢNH" : "CONTEXT-GROUNDED ANALYSIS"}</div>
                <h3>{lang === "vi" ? `Hỏi trực tiếp về ${context.symbol || "token"} này` : `Ask directly about this ${context.symbol || "token"}`}</h3>
                <p>
                  {lang === "vi"
                    ? "Câu trả lời được giới hạn trong mint, timeframe, cấu hình chấm điểm và kết quả phát hiện wash trading đang hiển thị trên trang."
                    : "Answers are scoped to this mint, timeframe, scoring profile, and the wash-trading findings currently shown on this page."}
                </p>
                <div className={styles.quickQuestions}>
                  {quickQuestions.map((question, index) => (
                    <button key={question} type="button" disabled={disabled || isLoading} onClick={() => void sendQuestion(question)}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`${styles.message} ${message.role === "user" ? styles.userMessage : styles.assistantMessage}`}>
                  <span className={styles.messageLabel}>
                    {message.role === "user"
                      ? (lang === "vi" ? "BẠN" : "YOU")
                      : (lang === "vi" ? "AI ANALYST" : "AI ANALYST")}
                  </span>
                  <p>{message.content}</p>
                  {message.role === "assistant" && message.suggestions?.length ? (
                    <div className={styles.suggestions}>
                      {message.suggestions.map((suggestion) => (
                        <button key={suggestion} type="button" disabled={isLoading} onClick={() => void sendQuestion(suggestion)}>
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            )}

            {isLoading && (
              <div className={styles.typing}>
                <span /><span /><span />
                <em>{lang === "vi" ? "Đang đối chiếu graph và tín hiệu rủi ro…" : "Reviewing the graph and risk signals…"}</em>
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}
          </div>

          <div className={styles.composer}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, MAX_INPUT_LENGTH))}
              onKeyDown={handleKeyDown}
              disabled={disabled || isLoading}
              placeholder={lang === "vi" ? `Hỏi về ${context.symbol || "token"} này…` : `Ask about this ${context.symbol || "token"}…`}
              rows={2}
            />
            <div className={styles.composerFooter}>
              <span>{lang === "vi" ? "Enter để gửi · Shift + Enter để xuống dòng" : "Enter to send · Shift + Enter for a new line"}</span>
              <button
                type="button"
                onClick={() => void sendQuestion(input)}
                disabled={disabled || isLoading || !input.trim()}
                aria-label={lang === "vi" ? "Gửi câu hỏi" : "Send question"}
              >
                <SendIcon size={16} />
              </button>
            </div>
          </div>

          <footer className={styles.disclaimer}>
            {lang === "vi"
              ? "Giải thích dựa trên dữ liệu hiện tại và rule phân tích. Đây là tín hiệu cảnh báo, không phải kết luận pháp lý hoặc tư vấn đầu tư."
              : "Grounded in current data and analysis rules. This is an alert signal, not a legal conclusion or investment advice."}
          </footer>
        </section>
      )}

      {!isOpen && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          title={lang === "vi" ? "Mở trợ lý Wash Trading" : "Open Wash Trading Analyst"}
        >
          <span className={styles.fabIcon}><InsightOrbitIcon size={18} /></span>
          <span className={styles.fabText}>
            <small>{lang === "vi" ? "WASH TRADING" : "WASH TRADING"}</small>
            <strong>{lang === "vi" ? "Hỏi phân tích" : "Ask analysis"}</strong>
          </span>
          {context.riskScore != null && context.riskScore >= 45 ? <i className={styles.alertDot} /> : null}
        </button>
      )}
    </div>
  );
}
