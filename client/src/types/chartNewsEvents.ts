export type TokenChartNewsTimeframe = "24h" | "7d" | "1m" | "3m" | "1y";

export interface TokenChartNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  description: string;
  score: number;
  matchedBy: string[];
  sourceType: "news" | "web_mention" | "project_update";
  imageUrl?: string | null;
  favicon?: string | null;
}

export interface TokenChartNewsEventSummary {
  headline: string;
  tldr: string;
  bullets: string[];
  themes: string[];
  confidence: "high" | "medium" | "low";
  riskNote: string;
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
  meta?: {
    providersUsed: Array<"rss" | "brave">;
    braveFallbackUsed: boolean;
    braveNewsUsed?: boolean;
    braveWebFallbackUsed?: boolean;
    sourceTypeCounts?: {
      news: number;
      web_mention: number;
      project_update: number;
    };
  };
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
  forceRefresh?: boolean;
  date?: string;
}
