import type { PredefinedQuestion } from "./types";

export const PREDEFINED_QUESTIONS: PredefinedQuestion[] = [
  { id: "overview", label: "Overview", query: "Give me a portfolio overview of this wallet including total balance, 24h change, and trading volume.", labelKey: "chat.prompt.overview.label", queryKey: "chat.prompt.overview.query" },
  { id: "pnl", label: "PnL Summary", query: "What is my profit and loss? Show per-token breakdown with realized PnL and win rate.", labelKey: "chat.prompt.pnl.label", queryKey: "chat.prompt.pnl.query" },
  { id: "trades", label: "Recent Trades", query: "Show me my recent swap transactions with token details and USD values.", labelKey: "chat.prompt.trades.label", queryKey: "chat.prompt.trades.query" },
  { id: "risk", label: "Risk Analysis", query: "Analyze the risk level of this wallet. What are the risk factors and trust score?", labelKey: "chat.prompt.risk.label", queryKey: "chat.prompt.risk.query" },
  { id: "tokens", label: "Top Tokens", query: "What are my current token holdings by USD value?", labelKey: "chat.prompt.tokens.label", queryKey: "chat.prompt.tokens.query" },
  { id: "balance", label: "Balance Trend", query: "Show me my balance history chart over the last 30 days.", labelKey: "chat.prompt.balance.label", queryKey: "chat.prompt.balance.query" },
  { id: "volume", label: "Volume Trend", query: "What's my daily trading volume trend over the last 30 days?", labelKey: "chat.prompt.volume.label", queryKey: "chat.prompt.volume.query" },
  { id: "audit", label: "Forensic Audit", query: "Run a forensic audit on this wallet. What persona and behavior patterns do you see?", labelKey: "chat.prompt.audit.label", queryKey: "chat.prompt.audit.query" },
];

export const CHAT_WIDGET_WIDTH = 420;
export const CHAT_WIDGET_HEIGHT = 600;
export const CHAT_WIDGET_MARGIN = 24;
