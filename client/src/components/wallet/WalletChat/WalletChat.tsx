import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Add, ChevronDown, Playlist, Send, TrashCan } from "@carbon/icons-react";
import client from "@/api/main";
import { WalletChatMessage } from "./WalletChatMessage";
import { PREDEFINED_QUESTIONS } from "./WalletChatConstants";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { LangKeys } from "@/config/localization";
import type { ChatMessageItem, ChatResponse } from "./types";
import styles from "./WalletChat.module.scss";
import { Maximize, OpenPanelLeft, OpenPanelRight } from "@carbon/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSessions } from "./useChatSessions";

const MAX_QUICK_QUESTIONS = 5;
const MAX_INPUT_LENGTH = 500;

interface Props {
  address?: string;
  addresses?: string[];
  lang?: LangKeys;
  variant?: "widget" | "sidebar";
  chatPosition: "right" | "left" | "fullscreen";
  onChatPositionChange: (position: "right" | "left" | "fullscreen") => void;
}

export function WalletChat({ address, addresses, lang, variant = "widget", chatPosition, onChatPositionChange }: Props) {
  const { tr, fmt } = useLocalization();
  const { user, isUserLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(variant === "sidebar");
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);

  const activeAddresses = useMemo(
    () => (addresses?.length ? addresses : address ? [address] : []).filter(Boolean),
    [address, addresses],
  );
  const contextType = activeAddresses.length > 1 ? "wallet-comparison" : "wallet";

  const {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId: changeSessionId,
    createNewSession,
    saveMessagesToSession,
    deleteSessionById,
    refreshSessions,
  } = useChatSessions(user?.userId ?? null);

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

  // Load active session messages when switching sessions
  useEffect(() => {
    if (activeSession) {
      setMessages(activeSession.messages);
      setError(null);
      return;
    }
    setMessages([]);
    setError(null);
  }, [activeSession]);

  // Close session menu on outside click
  useEffect(() => {
    if (!showSessionMenu) return;
    const handler = (e: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target as Node)) {
        setShowSessionMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSessionMenu]);

  const doSaveCurrentSession = useCallback(async () => {
    if (!activeSessionId || messages.length === 0) return;
    const title = messages.find((m) => m.role === "user")?.content.slice(0, 50);
    await saveMessagesToSession(activeSessionId, messages, title);
  }, [activeSessionId, messages, saveMessagesToSession]);

  const sendQuery = useCallback(
    async (query: string) => {
      if (!query.trim() || isLoading || activeAddresses.length === 0) return;

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
          json: {
            addresses: activeAddresses,
            query: query.trim(),
            language: lang,
            history,
            sessionId: activeSessionId ?? undefined,
            contextType,
          },
        });

        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }

        const data = (await res.json()) as ChatResponse & { sessionId?: string };
        const assistantMsg: ChatMessageItem = {
          role: "assistant",
          content: data.text,
          data: data.data,
          charts: data.charts,
          tables: data.tables,
          actions: data.actions,
          tldr: data.tldr,
          sections: data.sections,
          evidence: data.evidence,
          warnings: data.warnings,
          confidence: data.confidence,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // If backend created a new session, sync the id
        if (data.sessionId && data.sessionId !== activeSessionId) {
          changeSessionId(data.sessionId);
        }

        // Refresh session list so new sessions appear in selector
        refreshSessions();
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
    [activeAddresses, contextType, lang, isLoading, messages, activeSessionId, changeSessionId, refreshSessions, tr],
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

  const handleClose = async () => {
    await doSaveCurrentSession();
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleNewChat = async () => {
    await doSaveCurrentSession();
    setMessages([]);
    setError(null);
    setShowPromptMenu(false);
    changeSessionId(null);
  };

  const handleSessionSelect = async (sessionId: string) => {
    await doSaveCurrentSession();
    changeSessionId(sessionId);
    setShowSessionMenu(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await deleteSessionById(sessionId);
  };

  // ─── Auth gate ───────────────────────────────────────────────────────
  if (!isUserLoading && !user) {
    if (variant === "widget" && (!isOpen || isMinimized)) {
      return (
        <button
          type="button"
          onClick={handleToggle}
          title={tr("chat.fabTitle")}
          className={styles.fab}
        >
          <span className={styles.fabText}>AI</span>
        </button>
      );
    }

    if (variant === "sidebar" && !isOpen) {
      return null;
    }

    return (
      <div className={variant === "sidebar" ? styles.sidebarContainer : styles.widgetContainer}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>{tr("chat.headerTitle")}</span>
          <div className={styles.headerActions}>
            {variant === "widget" && (
              <button type="button" onClick={handleClose} className={styles.headerBtn}>✕</button>
            )}
          </div>
        </div>
        <div className={styles.authRequired}>
          <div className={styles.authRequiredTitle}>{tr("chat.signInRequired")}</div>
          <p className={styles.authRequiredDesc}>{tr("chat.signInRequiredDesc")}</p>
        </div>
      </div>
    );
  }

  if (isUserLoading) {
    if (variant === "widget" && (!isOpen || isMinimized)) {
      return (
        <button type="button" className={styles.fab}>
          <span className={styles.fabText}>AI</span>
        </button>
      );
    }
    return null;
  }

  // Minimized FAB (widget variant only, authenticated)
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
  const trimmedInput = inputText.trim();
  const inputValidationError =
    trimmedInput.length === 0 ? null
      : trimmedInput.length > MAX_INPUT_LENGTH ? tr("chat.inputOverLimit", { max: MAX_INPUT_LENGTH })
        : null;

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
            disabled={isLoading || activeAddresses.length === 0}
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

  const renderSessionMenu = () => (
    <div ref={sessionMenuRef} className={styles.sessionDropdown}>
      <div className={styles.sessionDropdownTitle}>{tr("chat.sessions")}</div>
      {sessions.length === 0 && (
        <div className={styles.sessionEmpty}>{tr("chat.noSessions")}</div>
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          className={`${styles.sessionItem} ${s.id === activeSessionId ? styles.sessionItemActive : ""}`}
          onClick={() => handleSessionSelect(s.id)}
        >
          <div className={styles.sessionItemContent}>
            <span className={styles.sessionItemTitle}>
              {s.title || tr("chat.newChat")}
            </span>
            <span className={styles.sessionItemTime}>
              {fmt.datetime.relative(s.updatedAt)}
            </span>
          </div>
          <button
            type="button"
            className={styles.sessionItemDelete}
            onClick={(e) => handleDeleteSession(e, s.id)}
            title={tr("chat.deleteSession")}
          >
            <TrashCan size={12} />
          </button>
        </div>
      ))}
    </div>
  );

  const wrapperClass = variant === "sidebar" ? styles.sidebarContainer : styles.widgetContainer;

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>
            {tr("chat.headerTitle")}
          </span>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.sessionSelector}>
            <button
              type="button"
              className={styles.sessionToggle}
              onClick={() => setShowSessionMenu((v) => !v)}
            >
              <span className={styles.sessionToggleLabel}>
                {activeSession?.title
                  ? activeSession.title.length > 16
                    ? activeSession.title.slice(0, 16) + "..."
                    : activeSession.title
                  : tr("chat.newChat")}
              </span>
              <ChevronDown size={12} />
            </button>
            {showSessionMenu && renderSessionMenu()}
          </div>
          <button
            className={styles.headerBtn}
            data-active={chatPosition === "left"}
            onClick={() => onChatPositionChange("left")}
            title="Left sidebar"
          >
            <OpenPanelLeft size={16} />
          </button>
          <button
            className={styles.headerBtn}
            data-active={chatPosition === "right"}
            onClick={() => onChatPositionChange("right")}
            title="Right sidebar"
          >
            <OpenPanelRight size={16} />
          </button>
          <button
            className={styles.headerBtn}
            data-active={chatPosition === "fullscreen"}
            onClick={() => onChatPositionChange("fullscreen")}
            title="Fullscreen"
          >
            <Maximize size={16} />
          </button>
          <button
            type="button"
            onClick={handleNewChat}
            className={styles.headerBtn}
            title={tr("chat.newChat")}
          >
            <Add size={16} />
          </button>
          {variant === "widget" && (
            <>
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
            </>
          )}
        </div>
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
            disabled={isLoading || activeAddresses.length === 0}
            className={styles.inputField}
          />
          <button
            type="button"
            onClick={() => setShowPromptMenu((v) => !v)}
            disabled={isLoading || activeAddresses.length === 0}
            className={styles.promptMenuBtn}
            title={tr("chat.promptMenuBtn")}
          >
            <Playlist size={16} />
          </button>
          <button
            type="button"
            onClick={() => sendQuery(inputText)}
            disabled={isLoading || activeAddresses.length === 0 || !inputText.trim() || inputText.length > MAX_INPUT_LENGTH}
            className={styles.sendBtn}
          >
            <Send size={16} />
          </button>
        </div>
        <div className={styles.inputMeta}>
          <span>{tr("chat.inputCounter", { current: String(inputText.length), max: MAX_INPUT_LENGTH })}</span>
          {inputText.length > 0 && inputValidationError && (
            <span className={styles.validationError}>{inputValidationError}</span>
          )}
        </div>
      </div>
    </div>
  );
}
