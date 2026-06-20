import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatPromptData {
  id: string;
  userId: string;
  label: string;
  query: string;
  contextTypes: string[];
  walletAddress: string | null;
  forkedFrom: string | null;
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListPromptsResult {
  items: ChatPromptData[];
  total: number;
  page: number;
  limit: number;
}

export type PromptScope = "mine" | "public" | "popular";

interface ListPromptsOptions {
  scope?: PromptScope;
  walletAddress?: string;
  contextType?: "wallet" | "wallet-comparison";
  sort?: "usage" | "recent" | "trending";
  page?: number;
  limit?: number;
}

export interface CreatePromptInput {
  label: string;
  query: string;
  contextTypes?: string[];
  walletAddress?: string | null;
  isPublic?: boolean;
  forkedFrom?: string | null;
}

export interface UpdatePromptInput {
  label?: string;
  query?: string;
  contextTypes?: string[];
  walletAddress?: string | null;
  isPublic?: boolean;
}

const API_BASE = import.meta.env.VITE_CLIENT_API_DOMAIN || "";

function promptUrl(path: string): string {
  return `${API_BASE}/api/chat/prompts${path}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error((errBody as Record<string, unknown>)?.message as string || `Prompt API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useChatPrompts() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<ChatPromptData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentScope, setCurrentScope] = useState<PromptScope>("public");

  const fetchPrompts = useCallback(async (opts: ListPromptsOptions = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("scope", opts.scope ?? currentScope);
      if (opts.walletAddress) params.set("walletAddress", opts.walletAddress);
      if (opts.contextType) params.set("contextType", opts.contextType);
      if (opts.sort) params.set("sort", opts.sort);
      if (opts.page) params.set("page", String(opts.page));
      if (opts.limit) params.set("limit", String(opts.limit));

      const data = await request<ListPromptsResult>(`${promptUrl("")}?${params.toString()}`);
      setPrompts(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch prompts");
    } finally {
      setIsLoading(false);
    }
  }, [user, currentScope]);

  const createPrompt = useCallback(async (input: CreatePromptInput): Promise<ChatPromptData | null> => {
    if (!user) return null;

    try {
      const data = await request<ChatPromptData>(promptUrl(""), {
        method: "POST",
        body: JSON.stringify(input),
      });
      setPrompts((prev) => [data, ...prev]);
      setTotal((t) => t + 1);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create prompt");
      return null;
    }
  }, [user]);

  const updatePrompt = useCallback(async (
    id: string,
    input: UpdatePromptInput,
  ): Promise<ChatPromptData | null> => {
    if (!user) return null;

    try {
      const data = await request<ChatPromptData>(promptUrl(`/${id}`), {
        method: "PUT",
        body: JSON.stringify(input),
      });
      setPrompts((prev) => prev.map((p) => (p.id === id ? data : p)));
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update prompt");
      return null;
    }
  }, [user]);

  const deletePrompt = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      await request<{ success: boolean }>(promptUrl(`/${id}`), {
        method: "DELETE",
      });
      setPrompts((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete prompt");
      return false;
    }
  }, [user]);

  const forkPrompt = useCallback(async (
    id: string,
    overrides?: { label?: string; isPublic?: boolean },
  ): Promise<ChatPromptData | null> => {
    if (!user) return null;

    try {
      const data = await request<ChatPromptData>(promptUrl(`/${id}/fork`), {
        method: "POST",
        body: JSON.stringify({
          label: overrides?.label,
          isPublic: overrides?.isPublic,
        }),
      });
      setPrompts((prev) => [data, ...prev]);
      setTotal((t) => t + 1);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fork prompt");
      return null;
    }
  }, [user]);

  return {
    prompts,
    total,
    page,
    isLoading,
    error,
    currentScope,
    setCurrentScope,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    forkPrompt,
  };
}
