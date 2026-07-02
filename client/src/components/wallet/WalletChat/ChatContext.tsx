import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import client from "@/api/main";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useChatSessions, type ChatSessionContextType, type SessionItem } from "./useChatSessions";
import type { ChatAiUsage, ChatMessageItem, ChatResponse } from "./types";

export const MAX_INPUT_LENGTH = 500;
const API_BASE = import.meta.env.VITE_CLIENT_API_DOMAIN || "";

interface ChatContextValue {
  addresses: string[];
  contextType: ChatSessionContextType;
  messages: ChatMessageItem[];
  inputText: string;
  isLoading: boolean;
  error: string | null;
  usage: ChatAiUsage | null;
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
  createSessionFromQuickMessages: (msgs: ChatMessageItem[], chatAddresses: string[]) => Promise<SessionItem | null>;
}


async function hydrateMessageData(message: ChatMessageItem): Promise<ChatMessageItem> {
  const needsData = message.role === "assistant"
    && !message.data
    && Array.isArray(message.dataRefs)
    && message.dataRefs.length > 0
    && ((message.charts?.length ?? 0) > 0 || (message.tables?.length ?? 0) > 0);

  if (!needsData) return message;

  try {
    const res = await fetch(`${API_BASE}/api/chat/tool-data/resolve`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refs: message.dataRefs }),
    });
    if (!res.ok) return message;
    const payload = (await res.json()) as { data?: Record<string, unknown> };
    return { ...message, data: payload.data ?? {} };
  } catch {
    return message;
  }
}

async function hydrateSessionMessages(messages: ChatMessageItem[]): Promise<ChatMessageItem[]> {
  return Promise.all(messages.map((message) => hydrateMessageData(message)));
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
  const { user, openAuthModal } = useAuth();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ChatAiUsage | null>(null);
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [truncatedMessages, setTruncatedMessages] = useState<ChatMessageItem[] | null>(null);

  const {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    saveMessagesToSession,
    createSessionWithMessages,
    deleteSessionById,
    refreshSessions,
  } = useChatSessions(user?.userId ?? null);

  useEffect(() => {
    let cancelled = false;
    if (activeSession) {
      setMessages(activeSession.messages);
      setError(null);
      setTruncatedMessages(null);
      hydrateSessionMessages(activeSession.messages).then((hydrated) => {
        if (!cancelled) setMessages(hydrated);
      });
      return () => {
        cancelled = true;
      };
    }
    setMessages([]);
    setError(null);
    setTruncatedMessages(null);
    return () => {
      cancelled = true;
    };
  }, [activeSession]);

  useEffect(() => {
    if (!user?.userId) return;
    let cancelled = false;
    client.api.chat.usage.$get()
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUsage(data as ChatAiUsage);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.userId]);

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

  const readChatError = useCallback(
    async (res: Response) => {
      if (res.status === 401) openAuthModal("login");

      try {
        const body = await res.json() as {
          error?: string;
          message?: string;
          errorCode?: string;
          upgradePath?: string;
        };
        const message =
          body.message?.trim() ||
          body.error?.trim() ||
          tr("chat.serverError", { status: String(res.status) });

        return body.upgradePath &&
          body.errorCode === "AI_DAILY_LIMIT_EXCEEDED"
          ? `${message} Upgrade: ${body.upgradePath}`
          : message;
      } catch {
        return tr("chat.serverError", { status: String(res.status) });
      }
    },
    [openAuthModal, tr],
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
        const res = await client.api.chat.$post({
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

        if (!res.ok) throw new Error(await readChatError(res));

        const data = (await res.json()) as ChatResponse & { sessionId?: string };
        if (data.usage) setUsage(data.usage);
        const assistantMsg: ChatMessageItem = {
          role: "assistant",
          content: data.text,
          context: messageContext,
          dataRefs: data.dataRefs,
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

    [addresses, contextType, lang, isLoading, activeSessionId, setActiveSessionId, refreshSessions, tr, makeMessageContext, withMessageContext, readChatError],
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

      const res = await client.api.chat.$post({
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

      if (!res.ok) throw new Error(await readChatError(res));

      const data = (await res.json()) as ChatResponse & { sessionId?: string };
      const redoContext = truncated[msgIndex]?.context ?? makeMessageContext();
      if (data.usage) setUsage(data.usage);
      const assistantMsg: ChatMessageItem = {
        role: "assistant",
        content: data.text,
        context: redoContext,
        dataRefs: data.dataRefs,
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
  }, [addresses, activeSessionId, setActiveSessionId, contextType, isLoading, lang, saveMessagesToSession, refreshSessions, tr, makeMessageContext, withMessageContext, readChatError]);

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

  const createSessionFromQuickMessages = useCallback(async (msgs: ChatMessageItem[], chatAddresses: string[]) => {
    const messageContext: NonNullable<ChatMessageItem["context"]> = {
      contextType: chatAddresses.length > 1 ? "wallet-comparison" : "wallet",
      walletAddresses: chatAddresses,
    };
    const stampedMessages = msgs.map((msg) => ({
      ...msg,
      context: messageContext,
    }));
    const title = stampedMessages.find((msg) => msg.role === "user")?.content.slice(0, 50);
    const session = await createSessionWithMessages(
      chatAddresses,
      messageContext.contextType,
      stampedMessages,
      title,
    );

    if (session) {
      setMessages(stampedMessages);
      setTruncatedMessages(null);
      setShowPromptMenu(false);
      setShowSessionMenu(false);
    }

    return session;
  }, [createSessionWithMessages]);

  return (
    <ChatContext.Provider
      value={{
        addresses,
        contextType,
        messages,
        inputText,
        isLoading,
        error,
        usage,
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
        createSessionFromQuickMessages,
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
