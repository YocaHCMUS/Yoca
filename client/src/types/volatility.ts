export type VolatilitySeverity = "medium" | "high" | "extreme";
export type RelatedNewsConfidence = "high" | "medium" | "low";
export type VolatilityTimeframe = "24h" | "daily";
export type VolatilityWindow = "auto" | "adjacent" | "15m" | "1h" | "6h" | "24h";

export interface RelatedNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  description: string;
  score: number;
  matchedBy: string[];
  imageUrl?: string | null;
  favicon?: string | null;
  timeDistanceHours: number | null;
  confidence: RelatedNewsConfidence;
}

export interface VolatilityEvent {
  id: string;
  type: "price_spike" | "price_drop";
  metric: "price";
  timestamp: string;
  window: string;
  changePercent: number;
  before: number;
  after: number;
  severity: VolatilitySeverity;
  relatedNews: RelatedNewsArticle[];
}

export interface VolatilitySummary {
  headline: string;
  bullets: string[];
  riskNote: string;
  generatedAt: string;
  provider?: string;
}

export interface VolatilitySignalResponse {
  success: boolean;
  data: {
    token: {
      address: string;
      symbol: string;
      name: string;
    };
    thresholdPercent: number;
    timeframe: string;
    window: string;
    metric: "price";
    updatedAt: string;
    dataPointsAnalyzed: number;
    rawEventsDetected: number;
    groupedEventsReturned: number;
    evaluatedWindows: string[];
    relatedNewsWindowHours: number;
    meta?: {
      providersUsed: Array<"rss" | "brave">;
      braveFallbackUsed: boolean;
    };
    cache?: {
      hit: boolean;
      expiresAt: string;
    };
    summary: VolatilitySummary | null;
    events: VolatilityEvent[];
  };
}

export interface TokenVolatilityNewsQuery {
  address: string;
  symbol: string;
  name: string;
  threshold?: number;
  timeframe?: VolatilityTimeframe;
  window?: VolatilityWindow;
  maxEventsWithNews?: number;
  forceRefresh?: boolean;
  includeSummary?: boolean;
}
