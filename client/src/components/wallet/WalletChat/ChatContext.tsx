import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import client from "@/api/main";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useChatSessions, type ChatSessionContextType, type SessionItem } from "./useChatSessions";
import type { ChatMessageItem, ChatResponse } from "./types";

export const MAX_INPUT_LENGTH = 500;

interface ChatContextValue {
  addresses: string[];
  contextType: ChatSessionContextType;
  messages: ChatMessageItem[];
  inputText: string;
  isLoading: boolean;
  error: string | null;
  showPromptMenu: boolean;
  showSessionMenu: boolean;
  truncatedMessages: ChatMessageItem[] | null;
  sessions: SessionItem[];
  activeSessionId: string | null;
  activeSession: SessionItem | null;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  setShowPromptMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSessionMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveSessionId: (id: string | null) => void;
  sendQuery: (query: string, opts?: { skipCache?: boolean; promptId?: string }) => Promise<void>;
  handleRedo: (msgIndex: number, content: string) => Promise<void>;
  handleRevert: (msgIndex: number, content: string) => Promise<void>;
  handleUndoRevert: () => Promise<void>;
  handleNewChat: () => Promise<void>;
  handleSessionSelect: (sessionId: string) => Promise<void>;
  handleDeleteSession: (e: React.MouseEvent, sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  injectQuickMessages: (msgs: ChatMessageItem[], chatAddresses: string[]) => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatContextProviderProps {
  addresses: string[];
  contextType: ChatSessionContextType;
  lang?: string;
  children: React.ReactNode;
}

export function ChatContextProvider({ addresses, contextType, lang, children }: ChatContextProviderProps) {
  const { tr } = useLocalization();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [truncatedMessages, setTruncatedMessages] = useState<ChatMessageItem[] | null>(null);

  const {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    saveMessagesToSession,
    deleteSessionById,
    refreshSessions,
  } = useChatSessions(user?.userId ?? null);

  useEffect(() => {
    if (activeSession) {
      setMessages(activeSession.messages);
      setError(null);
      setTruncatedMessages(null);
      return;
    }
    setMessages([]);
    setError(null);
    setTruncatedMessages(null);
  }, [activeSession]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const makeMessageContext = useCallback(
    (walletAddresses = addresses): NonNullable<ChatMessageItem["context"]> => ({
      contextType: walletAddresses.length > 1 ? "wallet-comparison" : contextType,
      walletAddresses,
    }),
    [addresses, contextType],
  );

  const withMessageContext = useCallback(
    (msg: ChatMessageItem, walletAddresses?: string[]): ChatMessageItem => ({
      ...msg,
      context: msg.context ?? makeMessageContext(walletAddresses),
    }),
    [makeMessageContext],
  );

  const sendQuery = useCallback(
    async (query: string, opts?: { skipCache?: boolean; promptId?: string }) => {
      if (!query.trim() || isLoading || addresses.length === 0) return;

      setShowPromptMenu(false);
      setTruncatedMessages(null);

      const messageContext = makeMessageContext();
      const userMsg: ChatMessageItem = { role: "user", content: query.trim(), context: messageContext };
      const prevMessages = messagesRef.current;
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsLoading(true);
      setError(null);

      try {
        const history = prevMessages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content.length > 2000 ? m.content.slice(0, 2000) : m.content,
        }));
        const res = await client.api.chat.index.$post({
          json: {
            addresses,
            query: query.trim(),
            language: lang,
            history,
            sessionId: activeSessionId ?? undefined,
            contextType,
            skipCache: opts?.skipCache,
            promptId: opts?.promptId,
          },
        });

        if (!res.ok) {
          throw new Error(tr("chat.serverError", { status: String(res.status) }));
        }

        const data = (await res.json()) as ChatResponse & { sessionId?: string };
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

        if (data.sessionId && data.sessionId !== activeSessionId) {
          setActiveSessionId(data.sessionId);
        }

        refreshSessions();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to send message";
        setError(msg);
        setMessages((prev) => [
          ...prev,
          withMessageContext({ role: "assistant", content: tr("chat.errorMessage", { error: msg }) }),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [addresses, contextType, lang, isLoading, activeSessionId, setActiveSessionId, refreshSessions, tr, makeMessageContext, withMessageContext],
  );

  const handleRedo = useCallback(async (msgIndex: number, content: string) => {
    if (isLoading) return;

    const prevMessages = messagesRef.current;
    const truncated = prevMessages.slice(0, msgIndex + 1);
    const title = prevMessages.find((m) => m.role === "user")?.content.slice(0, 50);

    setMessages(truncated);
    setTruncatedMessages(null);
    setShowPromptMenu(false);
    setIsLoading(true);
    setError(null);

    try {
      const history = prevMessages.slice(0, msgIndex).slice(-10).map((m) => ({
        role: m.role,
        content: m.content.length > 2000 ? m.content.slice(0, 2000) : m.content,
      }));

      const res = await client.api.chat.index.$post({
        json: {
          addresses,
          query: content.trim(),
          language: lang,
          history,
          sessionId: activeSessionId ?? undefined,
          contextType,
          skipCache: true,
          skipSessionSave: true,
        },
      });

      if (!res.ok) throw new Error(tr("chat.serverError", { status: String(res.status) }));

      const data = (await res.json()) as ChatResponse & { sessionId?: string };
      const redoContext = truncated[msgIndex]?.context ?? makeMessageContext();
      const assistantMsg: ChatMessageItem = {
        role: "assistant",
        content: data.text,
        context: redoContext,
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

      const finalMessages = [...truncated, assistantMsg];
      setMessages(finalMessages);

      if (activeSessionId) {
        await saveMessagesToSession(activeSessionId, finalMessages, title);
      }

      if (data.sessionId && data.sessionId !== activeSessionId) {
        setActiveSessionId(data.sessionId);
      }

      refreshSessions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        withMessageContext({ role: "assistant", content: tr("chat.errorMessage", { error: msg }) }),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [addresses, activeSessionId, setActiveSessionId, contextType, isLoading, lang, saveMessagesToSession, refreshSessions, tr, makeMessageContext, withMessageContext]);

  const handleRevert = useCallback(async (msgIndex: number, content: string) => {
    if (!activeSessionId) return;

    const prevMessages = messagesRef.current;
    const truncated = prevMessages.slice(0, msgIndex);
    const title = prevMessages.find((m) => m.role === "user")?.content.slice(0, 50);
    await saveMessagesToSession(activeSessionId, truncated, title);

    const rest = prevMessages.slice(msgIndex);
    setTruncatedMessages(rest.length > 0 ? rest : null);
    setMessages(truncated);
    setInputText(content);
    setShowPromptMenu(false);
  }, [activeSessionId, saveMessagesToSession]);

  const handleUndoRevert = useCallback(async () => {
    if (!truncatedMessages) return;
    const prevMessages = messagesRef.current;
    const restored = [...prevMessages, ...truncatedMessages];
    setMessages(restored);
    setTruncatedMessages(null);
    if (activeSessionId) {
      await saveMessagesToSession(activeSessionId, restored);
    }
  }, [truncatedMessages, activeSessionId, saveMessagesToSession]);

  const handleNewChat = useCallback(async () => {
    setMessages([]);
    setTruncatedMessages(null);
    setError(null);
    setShowPromptMenu(false);
    setActiveSessionId(null);
  }, [setActiveSessionId]);

  const handleSessionSelect = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setShowSessionMenu(false);
  }, [setActiveSessionId]);

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await deleteSessionById(sessionId);
  }, [deleteSessionById]);

  const injectQuickMessages = useCallback((msgs: ChatMessageItem[], chatAddresses: string[]) => {
    const stampedMessages = msgs.map((msg) => withMessageContext(msg, chatAddresses));
    setMessages((prev) => [...prev, ...stampedMessages]);
    setActiveSessionId(null);
    setTruncatedMessages(null);
  }, [setActiveSessionId, withMessageContext]);

  return (
    <ChatContext.Provider
      value={{
        addresses,
        contextType,
        messages,
        inputText,
        isLoading,
        error,
        showPromptMenu,
        showSessionMenu,
        truncatedMessages,
        sessions,
        activeSessionId,
        activeSession,
        setInputText,
        setShowPromptMenu,
        setShowSessionMenu,
        setActiveSessionId,
        sendQuery,
        handleRedo,
        handleRevert,
        handleUndoRevert,
        handleNewChat,
        handleSessionSelect,
        handleDeleteSession,
        refreshSessions,
        injectQuickMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within a ChatContextProvider");
  }
  return ctx;
}
