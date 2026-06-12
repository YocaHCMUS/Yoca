import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Playlist, Send } from "@carbon/icons-react";
import client from "@/api/main";
import { WalletChatMessage } from "./WalletChatMessage";
import { PREDEFINED_QUESTIONS } from "./WalletChatConstants";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { LangKeys } from "@/config/localization";
import type { ChatMessageItem, ChatResponse } from "./types";
import styles from "./WalletChat.module.scss";

const MAX_QUICK_QUESTIONS = 5;

interface Props {
  address: string;
  lang?: LangKeys;
  variant?: "widget" | "sidebar";
}

export function WalletChat({ address, lang, variant = "widget" }: Props) {
  const { tr } = useLocalization();
  const [isOpen, setIsOpen] = useState(variant === "sidebar");
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const sendQuery = useCallback(
    async (query: string) => {
      if (!query.trim() || isLoading) return;

      setShowPromptMenu(false);

      const userMsg: ChatMessageItem = { role: "user", content: query.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsLoading(true);
      setError(null);

      try {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content.length > 2000 ? m.content.slice(0, 2000) : m.content,
        }));
        const res = await client.api.chat.index.$post({
          json: { address, query: query.trim(), language: lang, history },
        });

        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }

        const data = (await res.json()) as ChatResponse;
        const assistantMsg: ChatMessageItem = {
          role: "assistant",
          content: data.text,
          data: data.data,
          charts: data.charts,
          tables: data.tables,
          actions: data.actions,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to send message";
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: tr("chat.errorMessage", { error: msg }),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [address, lang, isLoading, messages],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery(inputText);
    }
  };

  const handlePredefined = (query: string) => {
    sendQuery(query);
  };

  const resolveQuery = (q: typeof PREDEFINED_QUESTIONS[number]): string => {
    return q.queryKey ? tr(q.queryKey as "chat.prompt.overview.query") : q.query;
  };

  const resolveLabel = (q: typeof PREDEFINED_QUESTIONS[number]): string => {
    return q.labelKey ? tr(q.labelKey as "chat.prompt.overview.label") : q.label;
  };

  const handleToggle = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsMinimized(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  // Minimized FAB (widget variant only)
  if (variant === "widget" && (!isOpen || isMinimized)) {
    const unreadCount = messages.filter((m) => m.role === "assistant").length;

    return (
      <button
        type="button"
        onClick={handleToggle}
        title={tr("chat.fabTitle")}
        className={styles.fab}
      >
        <span className={styles.fabText}>AI</span>
        {unreadCount > 0 && (
          <span className={styles.fabBadge}>
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Sidebar variant always renders (parent controls visibility)
  if (variant === "sidebar" && !isOpen) {
    return null;
  }

  const quickItems = PREDEFINED_QUESTIONS.slice(0, MAX_QUICK_QUESTIONS);

  const renderPromptMenu = () => (
    <div className={styles.promptMenuOverlay}>
      <div className={styles.promptMenuTitle}>{tr("chat.promptMenuTitle")}</div>
      <div className={styles.promptMenuList}>
        {PREDEFINED_QUESTIONS.map((q) => (
          <button
            key={q.id}
            type="button"
            className={styles.promptMenuItem}
            onClick={() => handlePredefined(resolveQuery(q))}
          >
            <div className={styles.promptMenuItemLabel}>{resolveLabel(q)}</div>
            <div className={styles.promptMenuItemQuery}>{resolveQuery(q)}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderQuickQuestions = () => (
    <div className={styles.messagesArea}>
      <div className={styles.quickTitle}>{tr("chat.quickQuestionsTitle")}</div>
      <div className={styles.quickList}>
        {quickItems.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => handlePredefined(resolveQuery(q))}
            disabled={isLoading}
            className={styles.quickBtn}
          >
            {resolveLabel(q)}
          </button>
        ))}
      </div>
    </div>
  );

  const renderMessages = () => (
    <div ref={listRef} className={styles.messagesArea}>
      {messages.map((msg, i) => (
        <WalletChatMessage key={i} message={msg} onAction={sendQuery} />
      ))}
      {isLoading && (
        <div className={styles.loadingDots}>
          <div className={styles.dot} />
          <div className={styles.dot} />
          <div className={styles.dot} />
          <span className={styles.loadingLabel}>{tr("chat.loadingLabel")}</span>
        </div>
      )}
      {error && (
        <div className={styles.errorMsg}>{error}</div>
      )}
    </div>
  );

  const wrapperClass = variant === "sidebar" ? styles.sidebarContainer : styles.widgetContainer;

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          {tr("chat.headerTitle")}
        </span>
        {variant === "widget" && (
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className={styles.headerBtn}
            >
              ⟱
            </button>
            <button
              type="button"
              onClick={handleClose}
              className={styles.headerBtn}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {showPromptMenu ? renderPromptMenu()
        : messages.length === 0 && !isLoading ? renderQuickQuestions()
        : renderMessages()}

      {/* Input */}
      <div className={styles.inputBar}>
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tr("chat.inputPlaceholder")}
            disabled={isLoading}
            className={styles.inputField}
          />
          <button
            type="button"
            onClick={() => setShowPromptMenu((v) => !v)}
            disabled={isLoading}
            className={styles.promptMenuBtn}
            title={tr("chat.promptMenuBtn")}
          >
            <Playlist size={16} />
          </button>
          <button
            type="button"
            onClick={() => sendQuery(inputText)}
            disabled={isLoading || !inputText.trim()}
            className={styles.sendBtn}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
