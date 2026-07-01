import { AIFeature } from "@/services/tokenAiChat";

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
  sourceType: "news" | "web_mention" | "project_update";
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

export interface VolatilityAiUsage {
  feature: AIFeature;
  tier: "Free" | "Lite" | "Plus" | "Pro";
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
  disabled?: boolean;
}

export interface VolatilitySignalResponse {
  success: boolean;
  usage?: VolatilityAiUsage;
  counted?: boolean;
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
      braveNewsUsed?: boolean;
      braveWebFallbackUsed?: boolean;
      sourceTypeCounts?: {
        news: number;
        web_mention: number;
        project_update: number;
      };
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
