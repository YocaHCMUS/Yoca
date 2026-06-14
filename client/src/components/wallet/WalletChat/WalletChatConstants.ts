import type { PredefinedQuestion } from "./types";

export const PREDEFINED_QUESTIONS: PredefinedQuestion[] = [
  { id: "overview", label: "Overview", query: "Give a portfolio overview of this wallet including total balance, 24h change, and trading volume.", labelKey: "chat.prompt.overview.label", queryKey: "chat.prompt.overview.query", contextTypes: ["wallet"] },
  { id: "pnl", label: "PnL Summary", query: "What is the profit and loss for this wallet? Show per-token breakdown with realized PnL and win rate.", labelKey: "chat.prompt.pnl.label", queryKey: "chat.prompt.pnl.query", contextTypes: ["wallet"] },
  { id: "trades", label: "Recent Trades", query: "Show the recent swap transactions for this wallet with token details and USD values.", labelKey: "chat.prompt.trades.label", queryKey: "chat.prompt.trades.query", contextTypes: ["wallet"] },
  { id: "tokens", label: "Top Tokens", query: "What are the current token holdings of this wallet by USD value?", labelKey: "chat.prompt.tokens.label", queryKey: "chat.prompt.tokens.query", contextTypes: ["wallet"] },
  { id: "balance", label: "Balance Trend", query: "Show the balance history chart for this wallet over the last 30 days.", labelKey: "chat.prompt.balance.label", queryKey: "chat.prompt.balance.query", contextTypes: ["wallet"] },
  { id: "portfolioChange", label: "Portfolio Change", query: "Compare this wallet's current portfolio to a past date. Have holdings changed significantly?", labelKey: "chat.prompt.portfolioChange.label", queryKey: "chat.prompt.portfolioChange.query", contextTypes: ["wallet"] },
  { id: "tokenPrices", label: "Token Prices", query: "Check the current prices and market data for tokens held by this wallet.", labelKey: "chat.prompt.tokenPrices.label", queryKey: "chat.prompt.tokenPrices.query", contextTypes: ["wallet"] },
  { id: "compareOverview", label: "Compare Portfolios", query: "Compare the portfolios of these wallets — which has the best total value and 24h change?", labelKey: "chat.prompt.compareOverview.label", queryKey: "chat.prompt.compareOverview.query", contextTypes: ["wallet-comparison"] },
  { id: "comparePnl", label: "PnL Comparison", query: "Compare PnL across these wallets — which has the highest realized profit and win rate?", labelKey: "chat.prompt.comparePnl.label", queryKey: "chat.prompt.comparePnl.query", contextTypes: ["wallet-comparison"] },
  { id: "commonHoldings", label: "Common Holdings", query: "Which tokens are commonly held across these wallets and what are the overlaps?", labelKey: "chat.prompt.commonHoldings.label", queryKey: "chat.prompt.commonHoldings.query", contextTypes: ["wallet-comparison"] },
  { id: "topPerformer", label: "Top Performer", query: "Which wallet has the best ROI and trading performance across all metrics?", labelKey: "chat.prompt.topPerformer.label", queryKey: "chat.prompt.topPerformer.query", contextTypes: ["wallet-comparison"] },
  { id: "riskComparison", label: "Risk Comparison", query: "Compare diversification and risk profiles across these wallets.", labelKey: "chat.prompt.riskComparison.label", queryKey: "chat.prompt.riskComparison.query", contextTypes: ["wallet-comparison"] },
];

export const CHAT_WIDGET_WIDTH = 420;
export const CHAT_WIDGET_HEIGHT = 600;
export const CHAT_WIDGET_MARGIN = 24;
