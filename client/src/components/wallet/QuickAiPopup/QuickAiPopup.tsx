import { useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { AiGenerate, Send, Close, ArrowRight } from "@carbon/icons-react";
import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { WalletChatMessage } from "../WalletChat/WalletChatMessage";
import { ChatContext } from "../WalletChat/ChatContext";
import type {
  ChatMessageItem,
  ChatResponse,
  PredefinedQuestion,
} from "../WalletChat/types";
import styles from "./QuickAiPopup.module.scss";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorElement: HTMLElement | null;
  addresses: string[];
  contextType: "wallet" | "wallet-comparison";
  lang?: string;
  componentLabel: string;
  predefinedQuestions?: PredefinedQuestion[];
  onOpenChat?: () => void;
}

const MAX_INPUT = 500;

export function QuickAiPopup({
  open,
  onClose,
  anchorElement,
  addresses,
  contextType,
  lang,
  componentLabel,
  predefinedQuestions = [],
  onOpenChat,
}: Props) {
  const { tr } = useLocalization();
  const { user, isUserLoading } = useAuth();
  const chatCtx = useContext(ChatContext);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"prompt" | "loading" | "response">("prompt");
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInputText("");
      setError(null);
      setMode("prompt");
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, mode]);

  const updatePopupPosition = useCallback(() => {
    if (!open || !anchorElement) return;

    const gap = 8;
    const minHeight = 220;
    const maxPreferredHeight = 480;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rect = anchorElement.getBoundingClientRect();
    const width = Math.min(400, Math.max(280, viewportWidth - gap * 2));
    const availableBelow = viewportHeight - rect.bottom - gap;
    const availableAbove = rect.top - gap;
    const placeBelow = availableBelow >= minHeight || availableBelow >= availableAbove;
    const availableHeight = Math.max(minHeight, placeBelow ? availableBelow : availableAbove);
    const maxHeight = Math.min(maxPreferredHeight, availableHeight);
    const left = Math.min(Math.max(gap, rect.left), viewportWidth - width - gap);
    const top = placeBelow
      ? Math.min(rect.bottom + gap, viewportHeight - maxHeight - gap)
      : Math.max(gap, rect.top - maxHeight - gap);

    setPopupStyle({
      top,
      left,
      width,
      maxHeight,
      "--quick-ai-max-height": `${maxHeight}px`,
      visibility: "visible",
    } as CSSProperties);
  }, [anchorElement, open]);

  useEffect(() => {
    updatePopupPosition();
    if (!open) return;

    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [open, updatePopupPosition]);

  const handleSend = useCallback(async (query: string) => {
    if (!query.trim() || isLoading || !user || addresses.length === 0) return;

    const messageContext: NonNullable<ChatMessageItem["context"]> = { contextType, walletAddresses: addresses };
    const userMsg: ChatMessageItem = { role: "user", content: query.trim(), context: messageContext };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setMode("loading");
    setIsLoading(true);
    setError(null);

    try {
      const res = await client.api.chat.index.$post({
        json: {
          addresses,
          query: query.trim(),
          language: lang,
          history: [],
          skipSessionSave: true,
          skipCache: true,
          contextType,
        },
      });

      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }

      const data = (await res.json()) as ChatResponse;
      const assistantMsg: ChatMessageItem = {
        role: "assistant",
        content: data.text,
        context: messageContext,
        data: data.data,
        charts: data.charts,
        tables: data.tables,
        actions: data.actions,
        tldr: data.tldr,
        sections: data.sections,
        sources: data.sources,
        evidence: data.evidence,
        warnings: data.warnings,
        confidence: data.confidence,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setMode("response");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      setError(msg);
      setMode("response");
    } finally {
      setIsLoading(false);
    }
  }, [addresses, contextType, lang, isLoading, user]);

  const handlePredefined = useCallback((q: string) => {
    void handleSend(q);
  }, [handleSend]);

  const handleContinueInChat = useCallback(() => {
    if (messages.length > 0 && chatCtx) {
      chatCtx.injectQuickMessages(messages, addresses);
    }
    onOpenChat?.();
    onClose();
  }, [messages, chatCtx, addresses, onOpenChat, onClose]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(inputText);
    }
  };

  const inputValid =
    inputText.trim().length > 0 && inputText.length <= MAX_INPUT;

  if (!open || !anchorElement) return null;

  if (!user && !isUserLoading) {
    return (
      <>
        <div className={styles.overlay} onClick={onClose} />
        <div className={styles.popup} style={popupStyle}>
          <div className={styles.header}>
            <span className={styles.headerTitle}>
              <AiGenerate size={14} />
              AI — {componentLabel}
            </span>
            <button type="button" className={styles.headerClose} onClick={onClose}>
              <Close size={14} />
            </button>
          </div>
          <div className={styles.body} style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cds-text-secondary)", fontSize: 13 }}>
            {tr("chat.signInRequired")}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.popup} style={popupStyle}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            <AiGenerate size={14} />
            AI — {componentLabel}
          </span>
          <button type="button" className={styles.headerClose} onClick={onClose}>
            <Close size={14} />
          </button>
        </div>

        <div ref={bodyRef} className={styles.body}>
          {mode === "prompt" && (
            <div className={styles.promptArea}>
              <label className={styles.promptLabel}>
                {tr("chat.inputPlaceholder")}
              </label>
              <textarea
                ref={inputRef}
                className={styles.promptInput}
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tr("chat.inputPlaceholder")}
              />
              <div className={styles.promptActions}>
                <button
                  type="button"
                  className={styles.sendBtn}
                  disabled={!inputValid}
                  onClick={() => handleSend(inputText)}
                >
                  <Send size={12} />
                </button>
              </div>

              {predefinedQuestions.length > 0 && (
                <div className={styles.predefinedSection}>
                  <div className={styles.predefinedLabel}>
                    {tr("chat.greetingPrompt")}
                  </div>
                  <div className={styles.predefinedList}>
                    {predefinedQuestions.slice(0, 6).map((q) => {
                      const queryText = q.queryKey
                        ? tr(q.queryKey as "chat.prompt.overview.query")
                        : q.query;
                      const labelText = q.labelKey
                        ? tr(q.labelKey as "chat.prompt.overview.label")
                        : q.label;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          className={styles.predefinedItem}
                          onClick={() => handlePredefined(queryText)}
                        >
                          {labelText}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {(mode === "loading" || mode === "response") && (
            <div className={styles.responseArea}>
              {messages.map((msg, i) => (
                <WalletChatMessage
                  key={i}
                  message={msg}
                  index={i}
                  onAction={(query) => handlePredefined(query)}
                />
              ))}
              {mode === "loading" && (
                <div className={styles.loadingArea}>
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                  <span className={styles.loadingLabel}>
                    {tr("chat.loadingLabel")}
                  </span>
                </div>
              )}
              {error && <div className={styles.errorText}>{error}</div>}
            </div>
          )}
        </div>

        {mode === "response" && messages.length >= 2 && (
          <div className={styles.continueBar}>
            <button
              type="button"
              className={styles.continueBtn}
              onClick={handleContinueInChat}
            >
              <AiGenerate size={14} />
              Continue in Chat
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
