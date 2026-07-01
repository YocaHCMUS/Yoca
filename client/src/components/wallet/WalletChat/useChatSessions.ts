import { useCallback, useEffect, useState } from "react";
import type { ChatMessageItem } from "./types";

export type ChatSessionContextType = "wallet" | "wallet-comparison";

export interface SessionItem {
  id: string;
  userId: string;
  walletAddresses: string[];
  contextType: ChatSessionContextType;
  contextHash: string;
  title: string | null;
  messages: ChatMessageItem[];
  createdAt: string;
  updatedAt: string;
}

const API_BASE = import.meta.env.VITE_CLIENT_API_DOMAIN || "";

function sessionUrl(path: string): string {
  return `${API_BASE}/api/chat/sessions${path}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`Session API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useChatSessions(
  userId: string | null,
) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setActiveSessionId(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await request<SessionItem[]>(sessionUrl(""));
      setSessions(data);
    } catch (err) {
      console.error("[useChatSessions] Failed to fetch sessions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createNewSession = useCallback(
    async (addresses: string[], contextType: ChatSessionContextType, title?: string) => {
      if (!userId || addresses.length === 0) return null;
      try {
        const session = await request<SessionItem>(sessionUrl(""), {
          method: "POST",
          body: JSON.stringify({ addresses, contextType, title }),
        });
        setSessions((prev) => {
          const exists = prev.some((s) => s.id === session.id);
          return exists ? prev : [session, ...prev];
        });
        setActiveSessionId(session.id);
        return session;
      } catch (err) {
        console.error("[useChatSessions] Failed to create session:", err);
      }
      return null;
    },
    [userId],
  );

  const saveMessagesToSession = useCallback(
    async (
      sessionId: string,
      messages: ChatMessageItem[],
      title?: string,
    ) => {
      if (!userId) return;
      try {
        const updated = await request<SessionItem>(
          sessionUrl(`/${sessionId}`),
          {
            method: "PUT",
            body: JSON.stringify({ messages, title }),
          },
        );
        setSessions((prev) => {
          const exists = prev.some((s) => s.id === sessionId);
          if (!exists) return [updated, ...prev];
          return prev.map((s) => (s.id === sessionId ? updated : s));
        });
      } catch (err) {
        console.error("[useChatSessions] Failed to save session:", err);
      }
    },
    [userId],
  );

  const createSessionWithMessages = useCallback(
    async (
      addresses: string[],
      contextType: ChatSessionContextType,
      messages: ChatMessageItem[],
      title?: string,
    ) => {
      if (!userId || addresses.length === 0) return null;
      try {
        const session = await request<SessionItem>(sessionUrl(""), {
          method: "POST",
          body: JSON.stringify({ addresses, contextType, title }),
        });
        const updated = await request<SessionItem>(
          sessionUrl(`/${session.id}`),
          {
            method: "PUT",
            body: JSON.stringify({ messages, title }),
          },
        );
        setSessions((prev) => {
          const exists = prev.some((s) => s.id === updated.id);
          return exists
            ? prev.map((s) => (s.id === updated.id ? updated : s))
            : [updated, ...prev];
        });
        setActiveSessionId(updated.id);
        return updated;
      } catch (err) {
        console.error("[useChatSessions] Failed to create session with messages:", err);
      }
      return null;
    },
    [userId],
  );
  const deleteSessionById = useCallback(
    async (sessionId: string) => {
      if (!userId) return;
      try {
        await request<{ success: boolean }>(sessionUrl(`/${sessionId}`), {
          method: "DELETE",
        });
        setSessions((prev) => {
          const next = prev.filter((s) => s.id !== sessionId);
          return next;
        });
        if (activeSessionId === sessionId) {
          setActiveSessionId((prev) =>
            prev === sessionId ? null : prev,
          );
        }
      } catch (err) {
        console.error("[useChatSessions] Failed to delete session:", err);
      }
    },
    [userId, activeSessionId],
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  return {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    createNewSession,
    saveMessagesToSession,
    createSessionWithMessages,
    deleteSessionById,
    refreshSessions: fetchSessions,
    isLoading,
  };
}
