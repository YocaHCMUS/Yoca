export type TokenChartNewsTimeframe = "24h" | "7d" | "1m" | "3m" | "1y";

export interface TokenChartNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  description: string;
  score: number;
  matchedBy: string[];
}

export interface TokenChartNewsEventSummary {
  headline: string;
  bullets: string[];
  provider?: string;
  generatedAt: string;
}

export interface TokenChartNewsEvent {
  date: string;
  timestamp: string;
  articleCount: number;
  summary: TokenChartNewsEventSummary | null;
  articles: TokenChartNewsArticle[];
}

export interface TokenChartNewsEventsData {
  token: {
    address: string;
    symbol: string;
    name: string;
  };
  timeframe: TokenChartNewsTimeframe;
  updatedAt: string;
  events: TokenChartNewsEvent[];
}

export interface TokenChartNewsEventsResponse {
  success: true;
  data: TokenChartNewsEventsData;
}

export interface TokenChartNewsEventsQuery {
  address: string;
  symbol: string;
  name: string;
  timeframe: TokenChartNewsTimeframe;
  includeSummary?: boolean;
}
