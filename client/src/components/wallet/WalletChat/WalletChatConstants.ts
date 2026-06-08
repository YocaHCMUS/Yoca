import type { PredefinedQuestion } from "./types";

export const PREDEFINED_QUESTIONS: PredefinedQuestion[] = [
  { id: "overview", label: "Overview", query: "Give a portfolio overview of this wallet including total balance, 24h change, and trading volume.", labelKey: "chat.prompt.overview.label", queryKey: "chat.prompt.overview.query" },
  { id: "pnl", label: "PnL Summary", query: "What is the profit and loss for this wallet? Show per-token breakdown with realized PnL and win rate.", labelKey: "chat.prompt.pnl.label", queryKey: "chat.prompt.pnl.query" },
  { id: "trades", label: "Recent Trades", query: "Show the recent swap transactions for this wallet with token details and USD values.", labelKey: "chat.prompt.trades.label", queryKey: "chat.prompt.trades.query" },
  { id: "tokens", label: "Top Tokens", query: "What are the current token holdings of this wallet by USD value?", labelKey: "chat.prompt.tokens.label", queryKey: "chat.prompt.tokens.query" },
  { id: "balance", label: "Balance Trend", query: "Show the balance history chart for this wallet over the last 30 days.", labelKey: "chat.prompt.balance.label", queryKey: "chat.prompt.balance.query" },
  { id: "portfolioChange", label: "Portfolio Change", query: "Compare this wallet's current portfolio to a past date. Have holdings changed significantly?", labelKey: "chat.prompt.portfolioChange.label", queryKey: "chat.prompt.portfolioChange.query" },
  { id: "tokenPrices", label: "Token Prices", query: "Check the current prices and market data for tokens held by this wallet.", labelKey: "chat.prompt.tokenPrices.label", queryKey: "chat.prompt.tokenPrices.query" },
];

export const CHAT_WIDGET_WIDTH = 420;
export const CHAT_WIDGET_HEIGHT = 600;
export const CHAT_WIDGET_MARGIN = 24;
