import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import client from "@/api/main";
import { WalletChatMessage } from "./WalletChatMessage";
import { PREDEFINED_QUESTIONS, CHAT_WIDGET_WIDTH, CHAT_WIDGET_HEIGHT, CHAT_WIDGET_MARGIN } from "./WalletChatConstants";
import type { ChatMessageItem, ChatResponse } from "./types";

interface Props {
  address: string;
  lang?: string;
}

export function WalletChat({ address, lang }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

      const userMsg: ChatMessageItem = { role: "user", content: query.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setIsLoading(true);
      setError(null);

      try {
        const res = await client.api.chat.index.$post({
          json: { address, query: query.trim(), language: lang },
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
            content: `Sorry, I encountered an error: ${msg}. Please try again.`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [address, lang, isLoading],
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

  // Minimized FAB
  if (!isOpen || isMinimized) {
    const unreadCount = messages.filter((m) => m.role === "assistant").length;

    return (
      <button
        type="button"
        onClick={handleToggle}
        title="Open AI Chat"
        style={{
          position: "fixed",
          bottom: CHAT_WIDGET_MARGIN,
          right: CHAT_WIDGET_MARGIN,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #2a6df4, #6c3af8)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: 24,
          boxShadow: "0 4px 16px rgba(42, 109, 244, 0.4)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s",
        }}
      >
        💬
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#da1e28",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              borderRadius: "50%",
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Expanded chat window
  return (
    <div
      style={{
        position: "fixed",
        bottom: CHAT_WIDGET_MARGIN,
        right: CHAT_WIDGET_MARGIN,
        width: CHAT_WIDGET_WIDTH,
        height: CHAT_WIDGET_HEIGHT,
        background: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #2a2a2a",
          background: "#1a1a1a",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
          AI Wallet Assistant
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16, padding: 4 }}
          >
            ⟱
          </button>
          <button
            type="button"
            onClick={handleClose}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16, padding: 4 }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Predefined Questions */}
      {messages.length === 0 && !error && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #222" }}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 8, fontWeight: 600 }}>
            QUICK QUESTIONS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PREDEFINED_QUESTIONS.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => handlePredefined(q.query)}
                disabled={isLoading}
                style={{
                  background: "#1e1e1e",
                  border: "1px solid #333",
                  borderRadius: 12,
                  padding: "4px 10px",
                  fontSize: 11,
                  color: "#ccc",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 12px 4px",
        }}
      >
        {messages.map((msg, i) => (
          <WalletChatMessage key={i} message={msg} />
        ))}
        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", color: "#888" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#888", animation: "none" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#888", animation: "none" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#888", animation: "none" }} />
            <span style={{ fontSize: 11, marginLeft: 4 }}>Analyzing...</span>
          </div>
        )}
        {error && (
          <div style={{ fontSize: 11, color: "#da1e28", padding: "4px 0" }}>
            {error}
          </div>
        )}
        {messages.length === 0 && !isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#555",
              fontSize: 13,
              textAlign: "center",
              padding: 20,
            }}
          >
            Ask a question about this wallet to get AI-powered insights.
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "8px 12px 12px", borderTop: "1px solid #2a2a2a" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this wallet..."
            disabled={isLoading}
            style={{
              flex: 1,
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              color: "#fff",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => sendQuery(inputText)}
            disabled={isLoading || !inputText.trim()}
            style={{
              background: isLoading || !inputText.trim() ? "#333" : "#2a6df4",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 16,
              color: "#fff",
              cursor: isLoading || !inputText.trim() ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
