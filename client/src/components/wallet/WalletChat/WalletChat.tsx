import { useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { Add, ChevronDown, Close, Maximize, OpenPanelLeft, OpenPanelRight, Playlist, Send, TrashCan } from "@carbon/icons-react";
import { WalletChatMessage } from "./WalletChatMessage";
import { PREDEFINED_QUESTIONS } from "./WalletChatConstants";
import { ChatPromptMenu } from "./ChatPromptMenu";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { LangKeys } from "@/config/localization";
import type { ChatSessionContextType } from "./useChatSessions";
import type { ChatMessageItem } from "./types";
import styles from "./WalletChat.module.scss";
import { useAuth } from "@/contexts/AuthContext";
import { ChatContext, ChatContextProvider, MAX_INPUT_LENGTH, useChatContext } from "./ChatContext";

const MAX_QUICK_QUESTIONS = 5;

interface Props {
  address?: string;
  addresses?: string[];
  lang?: LangKeys;
  variant?: "widget" | "sidebar";
  chatPosition: "right" | "left" | "fullscreen";
  onChatPositionChange: (position: "right" | "left" | "fullscreen") => void;
  contextType?: ChatSessionContextType;
  onRequestClose?: () => void;
}

function WalletChatInner({ variant, chatPosition, onChatPositionChange, walletAddresses, onRequestClose }: {
  variant: "widget" | "sidebar";
  chatPosition: "right" | "left" | "fullscreen";
  onChatPositionChange: (position: "right" | "left" | "fullscreen") => void;
  walletAddresses: string[];
  onRequestClose?: () => void;
}) {
  const { tr, fmt } = useLocalization();
  const { user, isUserLoading } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(variant === "sidebar");
  const [isMinimized, setIsMinimized] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const [activeMessageContext, setActiveMessageContext] = useState<ChatMessageItem["context"] | null>(null);

  const {
    messages,
    inputText,
    isLoading,
    error,
    showPromptMenu,
    showSessionMenu,
    sessions,
    activeSessionId,
    activeSession,
    contextType,
    setInputText,
    setShowPromptMenu,
    setShowSessionMenu,
    sendQuery,
    handleRedo,
    handleRevert,
    handleNewChat,
    handleSessionSelect,
    handleDeleteSession,
  } = useChatContext();

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

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * 3 + 8;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, [inputText]);

  useEffect(() => {
    if (!showSessionMenu) return;
    const handler = (e: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target as Node)) {
        setShowSessionMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSessionMenu, setShowSessionMenu]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery(inputText);
    }
  };

  const handlePredefined = (query: string, promptId?: string) => {
    sendQuery(query, promptId ? { promptId } : undefined);
  };

  const resolveQuery = (q: typeof PREDEFINED_QUESTIONS[number]): string => {
    return q.queryKey ? tr(q.queryKey as "chat.prompt.overview.query") : q.query;
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

  const trimmedInput = inputText.trim();
  const inputValidationError =
    trimmedInput.length === 0 ? null
      : trimmedInput.length > MAX_INPUT_LENGTH ? tr("chat.inputOverLimit", { max: MAX_INPUT_LENGTH })
        : null;

  // ─── Auth gate ───────────────────────────────────────────────────────
  const getMessageContext = useCallback((msg?: ChatMessageItem): NonNullable<ChatMessageItem["context"]> => {
    if (msg?.context) return msg.context;
    if (activeSession) {
      return {
        contextType: activeSession.contextType,
        walletAddresses: activeSession.walletAddresses,
      };
    }
    return {
      contextType: contextType ?? (walletAddresses.length > 1 ? "wallet-comparison" : "wallet"),
      walletAddresses,
    };
  }, [activeSession, contextType, walletAddresses]);

  const formatContextAddresses = useCallback((addressesToFormat: string[]) => {
    if (addressesToFormat.length > 2) {
      return `${addressesToFormat.slice(0, 2).map((a) => fmt.text.address(a)).join(", ")}, +${addressesToFormat.length - 2}`;
    }
    return addressesToFormat.map((a) => fmt.text.address(a)).join(", ");
  }, [fmt.text]);

  const updateActiveMessageContext = useCallback(() => {
    const container = listRef.current;
    if (!container || messages.length === 0) {
      setActiveMessageContext(null);
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const messageNodes = Array.from(container.querySelectorAll<HTMLElement>("[data-message-index]"));
    let activeIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    messageNodes.forEach((node) => {
      const rawIndex = Number(node.dataset.messageIndex);
      if (!Number.isFinite(rawIndex)) return;
      const distance = Math.abs(node.getBoundingClientRect().top - containerTop - 16);
      if (distance < bestDistance) {
        bestDistance = distance;
        activeIndex = rawIndex;
      }
    });

    setActiveMessageContext(getMessageContext(messages[activeIndex]));
  }, [getMessageContext, messages]);

  useEffect(() => {
    updateActiveMessageContext();
  }, [messages, activeSession, updateActiveMessageContext]);

  const renderSubheader = () => {
    const ctx = activeMessageContext ?? (messages.length > 0 ? getMessageContext(messages[messages.length - 1]) : null);
    if (!ctx || ctx.walletAddresses.length === 0) return null;

    return (
      <div className={styles.subheader} aria-label="Wallet context">
        <span className={styles.contextLabel}>{tr("chat.context")}:</span>
        {ctx.walletAddresses.map((addr) => (
          <button
            key={addr}
            type="button"
            className={styles.contextTag}
            onClick={() => navigate(`/wallets/${encodeURIComponent(addr)}`)}
            title={addr}
          >
            {fmt.text.address(addr)}
          </button>
        ))}
      </div>
    );
  };

  const sameMessageContext = (a: ChatMessageItem["context"], b: ChatMessageItem["context"]) => {
    if (!a || !b) return a === b;
    if (a.contextType !== b.contextType) return false;
    if (a.walletAddresses.length !== b.walletAddresses.length) return false;
    return a.walletAddresses.every((address, index) => address === b.walletAddresses[index]);
  };

  const renderMessages = () => {
    let previousUserContext: ChatMessageItem["context"] | null = null;

    return (
      <div ref={listRef} className={styles.messagesArea} onScroll={updateActiveMessageContext}>
        {messages.map((msg, i) => {
          const ctx = getMessageContext(msg);
          const shouldShowContextShift = msg.role === "user" && !!previousUserContext && !sameMessageContext(previousUserContext, ctx);

          if (msg.role === "user") {
            previousUserContext = ctx;
          }

          return (
            <div key={i} data-message-index={i}>
              {shouldShowContextShift && (
                <div className={styles.contextChange}>
                  <span className={styles.contextChangeAddresses}>{formatContextAddresses(ctx.walletAddresses)}</span>
                </div>
              )}
              <WalletChatMessage message={msg} index={i} onAction={sendQuery} onRedo={handleRedo} onRevert={handleRevert} />
            </div>
          );
        })}
        {isLoading && (
          <div className={styles.loadingDots}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.dot} style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
            <span className={styles.loadingLabel}>{tr("chat.loadingLabel")}</span>
          </div>
        )}
        {error && (
          <div className={styles.errorMsg}>{error}</div>
        )}
      </div>
    );
  };


  if (!isUserLoading && !user) {
    if (variant === "widget" && (!isOpen || isMinimized)) {
      return (
        <button
          type="button"
          onClick={handleToggle}
          title={tr("chat.fabTitle")}
          className={styles.fab}
        >
          <span className={styles.fabText}>{tr("chat.fabLabel")}</span>
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
              <button
                type="button"
                onClick={handleToggle}
                className={styles.headerBtn}
                aria-label={tr("chat.close")}
              >
                ✕
              </button>
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
          <span className={styles.fabText}>{tr("chat.fabLabel")}</span>
        </button>
      );
    }
    return null;
  }

  if (variant === "widget" && (!isOpen || isMinimized)) {
    const unreadCount = messages.filter((m) => m.role === "assistant").length;
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={tr("chat.fabTitle")}
        className={styles.fab}
      >
        <span className={styles.fabText}>{tr("chat.fabLabel")}</span>
        {unreadCount > 0 && (
          <span className={styles.fabBadge}>{unreadCount}</span>
        )}
      </button>
    );
  }

  if (variant === "sidebar" && !isOpen) {
    return null;
  }

  const renderPromptMenu = () => (
    <ChatPromptMenu
      walletAddress={walletAddresses[0]}
      onSelect={handlePredefined}
      onClose={() => setShowPromptMenu(false)}
    />
  );

  const renderGreeting = () => {
    const quickItems = PREDEFINED_QUESTIONS.slice(0, MAX_QUICK_QUESTIONS);

    return (
      <div ref={listRef} className={styles.messagesArea}>
        <div className={styles.greetingBubble}>
          <div className={styles.greetingTitle}>{tr("chat.greetingTitle")}</div>
          <p className={styles.greetingDescription}>{tr("chat.greetingDescription")}</p>
          <div className={styles.greetingPromptLabel}>{tr("chat.greetingPrompt")}</div>
          <div className={styles.greetingList}>
            {quickItems.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => handlePredefined(resolveQuery(q))}
                className={styles.greetingItem}
              >
                {resolveQuery(q)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

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
              {s.contextType === "wallet-comparison" ? tr("chat.contextTypeComparison") : tr("chat.contextTypeWallet")}
              {" · "}
              {s.walletAddresses.length > 2
                ? s.walletAddresses.slice(0, 2).map((a) => fmt.text.address(a)).join(", ") + `, +${s.walletAddresses.length - 2}`
                : s.walletAddresses.map((a) => fmt.text.address(a)).join(", ")}
              {" · "}
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
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>{tr("chat.headerTitle")}</span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.sessionSelector}>
            <button
              type="button"
              className={styles.sessionToggle}
              onClick={() => setShowSessionMenu((v) => !v)}
            >
              <span className={styles.sessionToggleLabel}>
                {activeSession?.title ?? tr("chat.newChat")}
              </span>
              <ChevronDown size={12} />
            </button>
            {showSessionMenu && renderSessionMenu()}
          </div>
          <button
            className={styles.headerBtn}
            data-active={chatPosition === "left"}
            onClick={() => onChatPositionChange("left")}
            title={tr("chat.leftSidebar")}
          >
            <OpenPanelLeft size={16} />
          </button>
          <button
            className={styles.headerBtn}
            data-active={chatPosition === "right"}
            onClick={() => onChatPositionChange("right")}
            title={tr("chat.rightSidebar")}
          >
            <OpenPanelRight size={16} />
          </button>
          <button
            className={styles.headerBtn}
            data-active={chatPosition === "fullscreen"}
            onClick={() => onChatPositionChange("fullscreen")}
            title={tr("chat.fullscreenMode")}
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
          {onRequestClose && (
            <button
              type="button"
              onClick={onRequestClose}
              className={styles.headerBtn}
              aria-label={tr("chat.close")}
              title={tr("chat.close")}
            >
              <Close size={16} />
            </button>
          )}
          {variant === "widget" && (
            <>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className={styles.headerBtn}
                aria-label={tr("chat.minimize")}
              >
                ⟱
              </button>
              <button
                type="button"
                onClick={handleToggle}
                className={styles.headerBtn}
                aria-label={tr("chat.close")}
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
      {renderSubheader()}

      {showPromptMenu ? renderPromptMenu()
        : messages.length === 0 && !isLoading ? renderGreeting()
          : renderMessages()}

      <div className={styles.inputBar}>
        <div className={styles.inputContainer}>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tr("chat.inputPlaceholder")}
            disabled={isLoading}
            className={styles.inputTextarea}
            rows={3}
          />
          <div className={styles.inputFooter}>
            <span className={styles.charCount}>
              {tr("chat.inputCounter", { current: String(inputText.length), max: MAX_INPUT_LENGTH })}
            </span>
            <div className={styles.inputActions}>
              <button
                type="button"
                onClick={() => setShowPromptMenu((v) => !v)}
                disabled={isLoading}
                className={styles.iconBtn}
                title={tr("chat.promptMenuBtn")}
              >
                <Playlist size={16} />
              </button>
              <button
                type="button"
                onClick={() => sendQuery(inputText)}
                disabled={isLoading || !inputText.trim() || inputText.length > MAX_INPUT_LENGTH}
                className={styles.iconBtn}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
        {inputText.length > 0 && inputValidationError && (
          <div className={styles.validationError}>{inputValidationError}</div>
        )}
      </div>
    </div>
  );
}

export function WalletChat({ address, addresses, lang, variant = "widget", chatPosition, onChatPositionChange, contextType: contextTypeProp, onRequestClose }: Props) {
  const existingCtx = useContext(ChatContext);

  if (existingCtx) {
    return <WalletChatInner variant={variant} chatPosition={chatPosition} onChatPositionChange={onChatPositionChange} walletAddresses={existingCtx.addresses} onRequestClose={onRequestClose} />;
  }

  const activeAddresses = [address, ...(addresses ?? [])].filter(Boolean) as string[];
  const contextType = contextTypeProp ?? (activeAddresses.length > 1 ? "wallet-comparison" : "wallet");

  return (
    <ChatContextProvider addresses={activeAddresses} contextType={contextType} lang={lang}>
      <WalletChatInner variant={variant} chatPosition={chatPosition} onChatPositionChange={onChatPositionChange} walletAddresses={activeAddresses} onRequestClose={onRequestClose} />
    </ChatContextProvider>
  );
}
