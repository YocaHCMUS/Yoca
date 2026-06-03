import type { PredefinedQuestion } from "./types";

export const PREDEFINED_QUESTIONS: PredefinedQuestion[] = [
  { id: "overview", label: "Overview", query: "Give me a portfolio overview of this wallet including total balance, 24h change, and trading volume." },
  { id: "pnl", label: "PnL Summary", query: "What is my profit and loss? Show per-token breakdown with realized PnL and win rate." },
  { id: "trades", label: "Recent Trades", query: "Show me my recent swap transactions with token details and USD values." },
  { id: "risk", label: "Risk Analysis", query: "Analyze the risk level of this wallet. What are the risk factors and trust score?" },
  { id: "tokens", label: "Top Tokens", query: "What are my current token holdings by USD value?" },
  { id: "balance", label: "Balance Trend", query: "Show me my balance history chart over the last 30 days." },
  { id: "volume", label: "Volume Trend", query: "What's my daily trading volume trend over the last 30 days?" },
  { id: "audit", label: "Forensic Audit", query: "Run a forensic audit on this wallet. What persona and behavior patterns do you see?" },
];

export const CHAT_WIDGET_WIDTH = 420;
export const CHAT_WIDGET_HEIGHT = 600;
export const CHAT_WIDGET_MARGIN = 24;
