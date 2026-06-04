import { createHash } from "node:crypto";

import { GoogleGenAI, Type } from "@google/genai";
import { getGoogleAiKey, WALLET_AUDIT_MODEL } from "@sv/config/constants.js";
import { z } from "zod";

import {
  buildTokenAiContext,
  hashTokenAiContext,
  type TokenAiContext,
  type TokenAiEvidence,
  type TokenAiIntent,
  type TokenAiLanguage,
  type TokenAiSource,
  type TokenAiTimeframe,
} from "./token-ai-context.js";
import {
  getTokenAiChatCacheExpiresAt,
  readTokenAiChatCache,
  writeTokenAiChatCache,
} from "./token-ai-chat-cache.js";

export type {
  TokenAiEvidence,
  TokenAiIntent,
  TokenAiLanguage,
  TokenAiSource,
  TokenAiTimeframe,
} from "./token-ai-context.js";

export interface TokenAiChatRequest {
  address: string;
  symbol?: string;
  name?: string;
  question: string;
  timeframe: TokenAiTimeframe;
  language: TokenAiLanguage;
  includeNews: boolean;
  includeVolatility: boolean;
}

export interface TokenAiSection {
  title: string;
  kind:
    | "market_snapshot"
    | "key_drivers"
    | "deep_dive"
    | "latest_headlines"
    | "why_it_matters"
    | "bullish_signals"
    | "bearish_signals"
    | "risk_factors"
    | "what_to_watch"
    | "simple_explanation"
    | "scenario_analysis"
    | "practical_framework"
    | "conclusion"
    | "custom";
  content?: string;
  bullets?: string[];
  table?: Array<Record<string, string | number | null>>;
}

export interface TokenAiChatData {
  token: {
    address: string;
    symbol?: string;
    name?: string;
    yocaUrl: string;
  };
  question: string;
  intent: TokenAiIntent;
  tldr: string[];
  sections: TokenAiSection[];
  evidence: TokenAiEvidence[];
  sources: TokenAiSource[];
  warnings: string[];
  confidence: "Low" | "Medium" | "High";
  asOf: string;
  disclaimer: string;
  generatedAt: string;
  provider: "gemini" | "deterministic";
  fallbackReason?: string;
  cache?: {
    hit: boolean;
    expiresAt?: string;
  };
}

const TOKEN_AI_CHAT_MODEL =
  process.env.TOKEN_AI_CHAT_MODEL?.trim() ||
  process.env.GEMINI_AUDIT_MODEL?.trim() ||
  WALLET_AUDIT_MODEL;
const TOKEN_AI_CHAT_PROMPT_VERSION =
  process.env.TOKEN_AI_CHAT_PROMPT_VERSION?.trim() || "v2";

const sectionKinds = [
  "market_snapshot",
  "key_drivers",
  "deep_dive",
  "latest_headlines",
  "why_it_matters",
  "bullish_signals",
  "bearish_signals",
  "risk_factors",
  "what_to_watch",
  "simple_explanation",
  "scenario_analysis",
  "practical_framework",
  "conclusion",
  "custom",
] as const;

type TokenAiFallbackReason =
  | "missing_api_key"
  | "gemini_api_error"
  | "gemini_invalid_json"
  | "gemini_zod_validation_error"
  | "cached_deterministic_response"
  | "cached_deterministic_ignored_gemini_available"
  | "deterministic_fallback";

function shouldExposeTokenAiDiagnostics() {
  return process.env.NODE_ENV !== "production";
}

function exposeFallbackReason(reason?: TokenAiFallbackReason) {
  return reason && shouldExposeTokenAiDiagnostics() ? reason : undefined;
}

function logGeminiFallback(
  reason: TokenAiFallbackReason,
  details?: Record<string, unknown>,
) {
  if (!shouldExposeTokenAiDiagnostics()) return;

  console.warn("[token-ai-chat] Gemini fallback", {
    reason,
    model: TOKEN_AI_CHAT_MODEL,
    hasGoogleAiKey: Boolean(process.env.GOOGLE_AI_KEY?.trim()),
    hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
    ...details,
  });
}

const sectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.preprocess(
    (value) =>
      typeof value === "string" &&
      sectionKinds.includes(value as (typeof sectionKinds)[number])
        ? value
        : "custom",
    z.enum(sectionKinds),
  ),
  content: z.string().trim().max(1600).optional(),
  bullets: z.array(z.string().trim().min(1).max(320)).max(8).optional(),
  table: z
    .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
    .max(8)
    .optional(),
});

const geminiResponseSchema = z.object({
  tldr: z.array(z.string().trim().min(1).max(260)).min(1).max(3),
  sections: z.array(sectionSchema).min(1).max(6),
  warnings: z.array(z.string().trim().min(1).max(280)).max(6),
  confidence: z.enum(["Low", "Medium", "High"]),
  disclaimer: z.string().trim().min(1).max(420),
});

function getGeminiApiKey() {
  return getGoogleAiKey();
}

function hashQuestion(question: string) {
  return createHash("sha256")
    .update(question.trim().toLowerCase().replace(/\s+/g, " "))
    .digest("hex");
}

export function inferTokenAiLanguage(
  question: string,
  language?: "en" | "vi",
): TokenAiLanguage {
  if (language) return language;
  const normalized = question.toLowerCase();
  if (
    /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
      question,
    ) ||
    /\b(token này|rủi ro|không|tin tức|giải thích|nên mua|bán|giữ)\b/.test(
      normalized,
    )
  ) {
    return "vi";
  }
  if (
    /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
      question,
    ) ||
    /\b(token này|rủi ro|không|tin tức|giải thích|nên mua|bán|giữ)\b/.test(
      normalized,
    )
  ) {
    return "vi";
  }
  return "en";
}

export function classifyTokenAiIntent(question: string): TokenAiIntent {
  const q = question.toLowerCase();
  if (/\b(risk|risks|risky|safe|scam|dangerous)\b/.test(q)) {
    return "risk_overview";
  }
  if (/\b(nên mua|nên bán|giữ|chốt lời)\b/.test(q)) {
    return "investment_guidance";
  }
  if (/\b(giảm|tăng|biến động)\b/.test(q)) {
    return "price_move_explanation";
  }
  if (/\b(tin tức|mới nhất|thông báo)\b/.test(q)) {
    return "latest_news";
  }
  if (/\b(rủi ro|an toàn|lừa đảo|nguy hiểm)\b/.test(q)) {
    return "risk_overview";
  }
  if (/\b(tích cực|tiêu cực)\b/.test(q)) {
    return "bullish_bearish";
  }
  if (/\b(giải thích|là gì|đơn giản)\b/.test(q)) {
    return "simple_explanation";
  }
  if (/\b(theo dõi|tiếp theo)\b/.test(q)) {
    return "what_to_watch";
  }
  if (
    /\b(should i buy|buy now|sell now|hold|entry|dca|take profit|nên mua|nên bán|giữ|chốt lời)\b/.test(
      q,
    )
  ) {
    return "investment_guidance";
  }
  if (/\b(why|down|up|pump|dump|move|moving|spike|giảm|tăng|biến động)\b/.test(q)) {
    return "price_move_explanation";
  }
  if (/\b(news|latest|announcement|headline|tin tức|mới nhất|thông báo)\b/.test(q)) {
    return "latest_news";
  }
  if (/\b(risk|safe|scam|dangerous|rủi ro|an toàn|lừa đảo|nguy hiểm)\b/.test(q)) {
    return "risk_overview";
  }
  if (/\b(bullish|bearish|upside|downside|tích cực|tiêu cực)\b/.test(q)) {
    return "bullish_bearish";
  }
  if (/\b(explain|what is|simple|giải thích|là gì|đơn giản)\b/.test(q)) {
    return "simple_explanation";
  }
  if (/\b(watch|next|monitor|theo dõi|tiếp theo)\b/.test(q)) {
    return "what_to_watch";
  }
  return "custom";
}

function compactCurrency(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(number) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(number) >= 1 ? 2 : 8,
  }).format(number);
}

function percent(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "unavailable";
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function tokenLabel(context: TokenAiContext) {
  return (
    context.token.name ||
    context.token.symbol ||
    `${context.token.address.slice(0, 4)}...${context.token.address.slice(-4)}`
  );
}

function marketRecord(context: TokenAiContext) {
  return (context.market ?? {}) as Record<string, unknown>;
}

function defaultDisclaimer(language: TokenAiLanguage) {
  return language === "vi"
    ? "Chỉ dùng cho mục đích thông tin, không phải lời khuyên tài chính. Hãy tự kiểm chứng dữ liệu và cân nhắc rủi ro trước mọi quyết định."
    : "For information only, not financial advice. Verify the data and consider your own risk before making decisions.";
}

function evidenceWarning(context: TokenAiContext, language: TokenAiLanguage) {
  const warnings = context.missingSections
    .filter((section) => section.section === "security")
    .map((section) => section.reason);
  if (context.latestNews.length === 0) {
    warnings.push(
      language === "vi"
        ? "Không có tin tức gần đây trong bằng chứng Yoca cho token này."
        : "No recent token news was available in the Yoca evidence bundle.",
    );
  }
  if (!context.market) {
    warnings.push(
      language === "vi"
        ? "Dữ liệu thị trường hiện không khả dụng."
        : "Current market data is unavailable.",
    );
  }
  return [...new Set(warnings)].slice(0, 6);
}

function confidenceFor(context: TokenAiContext, intent: TokenAiIntent) {
  if (
    intent === "risk_overview" ||
    context.missingSections.some((section) => section.section === "security")
  ) {
    return context.market && (context.holderStats || context.pools.length > 0)
      ? "Medium"
      : "Low";
  }
  if (context.market && context.latestNews.length >= 3 && context.volatilityEvents.length > 0) {
    return "High";
  }
  if (context.market || context.latestNews.length > 0) return "Medium";
  return "Low";
}

function newsBullets(context: TokenAiContext) {
  return context.latestNews.length > 0
    ? context.latestNews.map((article) => {
        const publisher = article.source ? ` (${article.source})` : "";
        return `${article.title}${publisher}`;
      })
    : ["No recent token-specific headlines were available from Yoca news evidence."];
}

function watchBullets(context: TokenAiContext) {
  const market = marketRecord(context);
  const bullets = [
    `Price and volume around ${compactCurrency(market.priceUsd)} and ${compactCurrency(market.volume24h)} 24h volume.`,
    `Liquidity and buy/sell activity in top pools, especially ${context.pools.length > 0 ? "the highest-liquidity pool" : "when pool data becomes available"}.`,
    "New Yoca news markers and volatility events, because timing can add context but does not prove causation.",
  ];
  if (context.holderStats) {
    bullets.push("Holder concentration changes, especially top-holder distribution.");
  }
  return bullets;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function poolDataRecord(pool: unknown) {
  const record = asRecord(pool);
  return asRecord(record.data ?? pool);
}

function topPoolData(context: TokenAiContext) {
  return context.pools.length > 0 ? poolDataRecord(context.pools[0]) : {};
}

function topPoolLiquidity(context: TokenAiContext) {
  return finiteNumber(topPoolData(context).liquidityUsd);
}

function holderTop10Percent(context: TokenAiContext) {
  return finiteNumber(asRecord(context.holderStats).top10Percent);
}

function holderCount(context: TokenAiContext) {
  return finiteNumber(asRecord(context.holderStats).holdersCount);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSearchTerms(context: TokenAiContext) {
  return [context.token.symbol, context.token.name]
    .map((value) => normalizeText(value))
    .filter((value) => value.length >= 3);
}

function countDirectNews(context: TokenAiContext) {
  const terms = tokenSearchTerms(context);
  if (terms.length === 0) return 0;

  return context.latestNews.filter((article) => {
    const haystack = normalizeText(
      `${article.title} ${article.description ?? ""}`,
    );
    return terms.some((term) => haystack.includes(term));
  }).length;
}

function isWrappedToken(context: TokenAiContext) {
  const symbol = normalizeText(context.token.symbol);
  const name = normalizeText(context.token.name);
  return (
    name.includes("wrapped") ||
    symbol.startsWith("w") ||
    context.token.address === "So11111111111111111111111111111111111111112"
  );
}

function priceMove(context: TokenAiContext) {
  const market = marketRecord(context);
  const change = finiteNumber(market.priceChangePercentage24h);
  if (change == null) {
    return {
      change,
      direction: "unknown" as const,
      phrase: "price direction is unavailable",
    };
  }

  const direction =
    Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
  const phrase =
    direction === "flat"
      ? `roughly flat over 24h (${percent(change)})`
      : `${direction} ${percent(Math.abs(change))} over 24h`;
  return { change, direction, phrase };
}

function volumeInterpretation(context: TokenAiContext) {
  const volume = finiteNumber(marketRecord(context).volume24h);
  if (volume == null) {
    return "24h volume is unavailable, so trading activity cannot be judged from market data.";
  }
  if (volume >= 5_000_000) {
    return `${compactCurrency(volume)} in 24h volume points to active trading rather than an idle market.`;
  }
  if (volume >= 250_000) {
    return `${compactCurrency(volume)} in 24h volume suggests meaningful trading activity, but not necessarily broad demand.`;
  }
  return `${compactCurrency(volume)} in 24h volume is thin, so smaller flows may move price more sharply.`;
}

function liquidityInterpretation(context: TokenAiContext) {
  const liquidity = topPoolLiquidity(context);
  if (liquidity == null) {
    return "Pool liquidity is unavailable, so slippage risk is harder to estimate.";
  }
  if (liquidity >= 1_000_000) {
    return `${compactCurrency(liquidity)} in top-pool liquidity can reduce ordinary slippage risk, but it does not prevent strong price moves.`;
  }
  if (liquidity >= 100_000) {
    return `${compactCurrency(liquidity)} in top-pool liquidity is usable but still sensitive to larger orders.`;
  }
  return `${compactCurrency(liquidity)} in top-pool liquidity is thin and can increase slippage and volatility risk.`;
}

function holderInterpretation(context: TokenAiContext) {
  const top10 = holderTop10Percent(context);
  const count = holderCount(context);
  if (top10 == null) {
    return "Holder concentration data is unavailable, so distribution risk is not visible from Yoca holder stats.";
  }

  const countText = count == null ? "an unknown holder count" : `${count.toLocaleString("en-US")} holders`;
  if (top10 >= 50) {
    return `Top 10 holders control ${percent(top10)} with ${countText}; that concentration can raise distribution risk, but it is not proof of manipulation.`;
  }
  if (top10 >= 25) {
    return `Top 10 holders control ${percent(top10)} with ${countText}; this is a meaningful concentration signal to monitor.`;
  }
  return `Top 10 holders control ${percent(top10)} with ${countText}; concentration risk is visible but not dominant from this single metric.`;
}

function newsInterpretation(context: TokenAiContext) {
  const total = context.latestNews.length;
  if (total === 0) {
    return "No recent token news was found in the Yoca evidence bundle, so price moves should not be over-attributed to headlines.";
  }

  const direct = countDirectNews(context);
  const label = tokenLabel(context);
  if (direct === 0) {
    return `${total} headline(s) were found, but they look broader ecosystem or market-related rather than direct ${label} catalysts.`;
  }
  if (direct < total) {
    return `${direct} of ${total} headline(s) directly reference ${label}; the rest are broader context, so news support is mixed.`;
  }
  return `${total} recent headline(s) directly reference ${label}, giving the narrative context more weight.`;
}

function catalystInterpretation(context: TokenAiContext) {
  const move = priceMove(context);
  const directNews = countDirectNews(context);
  if (move.direction === "down" && directNews === 0) {
    return "Price is down and no direct negative news catalyst appears in the evidence, so the move looks more market/liquidity-driven than news-driven.";
  }
  if (move.direction === "down" && directNews > 0) {
    return "Price is down while token-related headlines exist; treat news as context, not proven causation.";
  }
  if (move.direction === "up" && directNews === 0) {
    return "Price is up without a clear direct news catalyst, so the move may be flow, liquidity, or broader-market driven.";
  }
  if (directNews > 0) {
    return "Token-related news is present, but Yoca evidence does not prove it caused the price move.";
  }
  return "The evidence does not show a direct headline catalyst.";
}

function chartInterpretation(context: TokenAiContext) {
  if (context.chartSummary?.changePercent == null) {
    return "Chart data is thin for the selected timeframe, so the 24h market snapshot carries more weight than trend analysis.";
  }
  return `${context.timeframe} chart data shows ${percent(context.chartSummary.changePercent)} across ${context.chartSummary.points} points, which helps confirm whether the 24h move is isolated or part of a wider trend.`;
}

function volatilityInterpretation(context: TokenAiContext) {
  if (context.volatilityEvents.length === 0) {
    return "No bounded volatility event was detected in the selected context, so there is no separate spike/drop marker to explain.";
  }
  return `${context.volatilityEvents.length} volatility event(s) were detected; use them as timing markers, not proof of why traders acted.`;
}

function wrappedTokenInterpretation(context: TokenAiContext) {
  if (!isWrappedToken(context)) return null;
  return "This appears to be a wrapped token. Its market behavior may mostly reflect the underlying asset and wrapper liquidity, rather than an independent project narrative.";
}

function lowDataInterpretation(context: TokenAiContext) {
  const missing = [];
  if (!context.market) missing.push("market data");
  if (!context.chartSummary || context.chartSummary.points < 2) {
    missing.push("usable chart history");
  }
  if (context.latestNews.length === 0) missing.push("recent news");
  if (!context.holderStats) missing.push("holder concentration");
  if (context.pools.length === 0) missing.push("pool liquidity");
  if (context.missingSections.some((section) => section.section === "security")) {
    missing.push("contract/security authority data");
  }

  if (missing.length === 0) {
    return "The evidence bundle has enough market, liquidity, holder, and news context for a medium-confidence read.";
  }

  return `Missing or thin data: ${missing.join(", ")}. The assistant can still infer visible market/liquidity/news risk, but confidence should stay limited.`;
}

function headlineBullets(context: TokenAiContext) {
  if (context.latestNews.length === 0) {
    return ["No recent token-specific headlines were available from Yoca news evidence."];
  }

  return context.latestNews.slice(0, 5).map((article) => {
    const publisher = article.source ? ` (${article.source})` : "";
    const publishedMs = article.publishedAt ? Date.parse(article.publishedAt) : NaN;
    const timing = Number.isFinite(publishedMs)
      ? `, ${new Date(publishedMs).toISOString().slice(0, 10)}`
      : "";
    return `${article.title}${publisher}${timing}.`;
  });
}

function watchSignalBullets(context: TokenAiContext) {
  return [
    "If price falls while 24h volume rises, selling pressure, liquidation, or rotation may still be active.",
    "If liquidity drops sharply, slippage and volatility risk increase even when headline news is neutral.",
    "If new headlines are unrelated to the token, avoid over-attributing price moves to news.",
    "If holder concentration increases, distribution risk may rise; do not treat that as proof of manipulation.",
    "If chart direction, volume, and direct news start agreeing, confidence in the narrative improves.",
  ];
}

function viPriceMovePhrase(context: TokenAiContext) {
  const move = priceMove(context);
  if (move.change == null) return "chưa có dữ liệu hướng giá";
  if (move.direction === "flat") return `đi ngang trong 24h (${percent(move.change)})`;
  return `${move.direction === "up" ? "tăng" : "giảm"} ${percent(Math.abs(move.change))} trong 24h`;
}

function viVolumeInterpretation(context: TokenAiContext) {
  const volume = finiteNumber(marketRecord(context).volume24h);
  if (volume == null) {
    return "Chưa có volume 24h, nên khó đánh giá mức độ hoạt động giao dịch.";
  }
  if (volume >= 5_000_000) {
    return `Volume 24h ${compactCurrency(volume)} cho thấy giao dịch đang hoạt động mạnh, không phải thị trường đứng yên.`;
  }
  if (volume >= 250_000) {
    return `Volume 24h ${compactCurrency(volume)} cho thấy có hoạt động giao dịch đáng kể, nhưng chưa đủ để kết luận lực mua bền vững.`;
  }
  return `Volume 24h ${compactCurrency(volume)} khá mỏng, nên dòng tiền nhỏ cũng có thể làm giá biến động mạnh.`;
}

function viLiquidityInterpretation(context: TokenAiContext) {
  const liquidity = topPoolLiquidity(context);
  if (liquidity == null) {
    return "Chưa có dữ liệu thanh khoản pool, nên khó ước lượng rủi ro trượt giá.";
  }
  if (liquidity >= 1_000_000) {
    return `Thanh khoản pool cao khoảng ${compactCurrency(liquidity)} có thể giảm trượt giá thông thường, nhưng giá vẫn có thể biến động mạnh.`;
  }
  if (liquidity >= 100_000) {
    return `Thanh khoản pool khoảng ${compactCurrency(liquidity)} là mức có thể giao dịch, nhưng lệnh lớn vẫn dễ tạo biến động.`;
  }
  return `Thanh khoản pool chỉ khoảng ${compactCurrency(liquidity)}, làm rủi ro trượt giá và biến động tăng lên.`;
}

function viHolderInterpretation(context: TokenAiContext) {
  const top10 = holderTop10Percent(context);
  const count = holderCount(context);
  if (top10 == null) {
    return "Chưa có dữ liệu tập trung holder, nên chưa thấy rõ rủi ro phân phối từ holder lớn.";
  }
  const countText = count == null ? "số holder chưa rõ" : `${count.toLocaleString("en-US")} holder`;
  if (top10 >= 50) {
    return `Top 10 holder nắm ${percent(top10)} nguồn cung với ${countText}; mức tập trung này làm rủi ro phân phối cao hơn, nhưng không phải bằng chứng thao túng.`;
  }
  if (top10 >= 25) {
    return `Top 10 holder nắm ${percent(top10)} nguồn cung với ${countText}; đây là tín hiệu tập trung đáng theo dõi.`;
  }
  return `Top 10 holder nắm ${percent(top10)} nguồn cung với ${countText}; có rủi ro tập trung nhưng chưa phải tín hiệu nổi bật từ một chỉ số.`;
}

function viNewsInterpretation(context: TokenAiContext) {
  const total = context.latestNews.length;
  if (total === 0) {
    return "Không có tin tức gần đây trong bằng chứng Yoca, nên không nên gán biến động giá cho tin tức.";
  }
  const direct = countDirectNews(context);
  const label = tokenLabel(context);
  if (direct === 0) {
    return `${total} tin được tìm thấy nhưng có vẻ là bối cảnh hệ sinh thái/thị trường, không phải catalyst trực tiếp cho ${label}.`;
  }
  if (direct < total) {
    return `${direct}/${total} tin nhắc trực tiếp đến ${label}; phần còn lại là bối cảnh rộng hơn, nên tín hiệu tin tức ở mức pha trộn.`;
  }
  return `${total} tin gần đây nhắc trực tiếp đến ${label}, nên narrative có trọng lượng hơn nhưng vẫn không chứng minh nguyên nhân giá.`;
}

function viCatalystInterpretation(context: TokenAiContext) {
  const move = priceMove(context);
  const directNews = countDirectNews(context);
  if (move.direction === "down" && directNews === 0) {
    return "Giá đang giảm nhưng không có tin xấu trực tiếp trong bằng chứng, nên biến động có vẻ thiên về thị trường/thanh khoản hơn là do tin tức.";
  }
  if (move.direction === "down") {
    return "Giá đang giảm trong khi có tin liên quan; hãy xem tin tức là bối cảnh, không phải bằng chứng nguyên nhân.";
  }
  if (move.direction === "up" && directNews === 0) {
    return "Giá đang tăng nhưng chưa có catalyst tin tức trực tiếp, nên có thể là dòng tiền, thanh khoản hoặc thị trường rộng hơn.";
  }
  return "Bằng chứng hiện tại chưa chứng minh một nguyên nhân duy nhất cho biến động giá.";
}

function viLowDataInterpretation(context: TokenAiContext) {
  const missing = [];
  if (!context.market) missing.push("dữ liệu thị trường");
  if (!context.chartSummary || context.chartSummary.points < 2) {
    missing.push("lịch sử chart đủ dùng");
  }
  if (context.latestNews.length === 0) missing.push("tin tức gần đây");
  if (!context.holderStats) missing.push("tập trung holder");
  if (context.pools.length === 0) missing.push("thanh khoản pool");
  if (context.missingSections.some((section) => section.section === "security")) {
    missing.push("dữ liệu contract/security");
  }

  if (missing.length === 0) {
    return "Bằng chứng đủ để đọc rủi ro thị trường, thanh khoản, holder và tin tức ở mức trung bình.";
  }
  return `Dữ liệu còn thiếu hoặc mỏng: ${missing.join(", ")}. Yoca vẫn có thể suy luận rủi ro nhìn thấy được, nhưng độ tin cậy nên thấp hơn.`;
}

function viWatchSignalBullets(context: TokenAiContext) {
  return [
    "Nếu giá giảm trong khi volume 24h tăng, lực bán, liquidation hoặc rotation có thể vẫn đang hoạt động.",
    "Nếu thanh khoản giảm mạnh, rủi ro trượt giá và biến động tăng lên.",
    "Nếu tin mới không liên quan trực tiếp đến token, đừng gán biến động giá cho tin tức.",
    "Nếu tập trung holder tăng, rủi ro phân phối có thể tăng; không xem đó là bằng chứng thao túng.",
  ];
}

function bullishBullets(context: TokenAiContext) {
  const move = priceMove(context);
  const market = marketRecord(context);
  const volume = finiteNumber(market.volume24h);
  const liquidity = topPoolLiquidity(context);
  const bullets: string[] = [];

  if (move.direction === "up") {
    bullets.push(`Price strength is visible: ${move.phrase}.`);
  }
  if (volume != null && volume >= 250_000) {
    bullets.push(`${compactCurrency(volume)} in 24h volume shows active trading interest.`);
  }
  if (liquidity != null && liquidity >= 100_000) {
    bullets.push(liquidityInterpretation(context));
  }
  if (context.latestNews.length > 0) {
    bullets.push(newsInterpretation(context));
  }
  if (wrappedTokenInterpretation(context)) {
    bullets.push("For a wrapped asset, broad relevance of the underlying asset can support continued monitoring.");
  }

  return bullets.length > 0
    ? bullets.slice(0, 5)
    : ["No clear positive market, liquidity, or news signal is visible in the current Yoca evidence."];
}

function bearishBullets(context: TokenAiContext) {
  const move = priceMove(context);
  const liquidity = topPoolLiquidity(context);
  const bullets: string[] = [];

  if (move.direction === "down") {
    bullets.push(`Price weakness is visible: ${move.phrase}.`);
  }
  if (liquidity != null && liquidity < 100_000) {
    bullets.push(liquidityInterpretation(context));
  }
  if (context.latestNews.length === 0 || countDirectNews(context) === 0) {
    bullets.push("News evidence is missing or indirect, so there is no clear headline support for the move.");
  }
  bullets.push(holderInterpretation(context));
  bullets.push("Contract/security authority evidence is unavailable, so safe/scam conclusions cannot be verified from this response.");

  return [...new Set(bullets)].slice(0, 5);
}

function localizedDisclaimer(language: TokenAiLanguage) {
  return language === "vi"
    ? "Chỉ dùng cho mục đích thông tin, không phải lời khuyên tài chính. Hãy tự kiểm chứng dữ liệu và cân nhắc rủi ro trước mọi quyết định."
    : "For information only, not financial advice. Verify the data and consider your own risk before making decisions.";
}

function localizedEvidenceWarning(
  context: TokenAiContext,
  language: TokenAiLanguage,
) {
  if (language !== "vi") return evidenceWarning(context, language);

  const warnings: string[] = [];
  if (context.missingSections.some((section) => section.section === "security")) {
    warnings.push(
      "Yoca chưa có dữ liệu contract/security như mint authority, freeze authority hoặc deployer cho token này.",
    );
  }
  if (context.latestNews.length === 0) {
    warnings.push("Không có tin tức gần đây trong bằng chứng Yoca cho token này.");
  }
  if (!context.market) {
    warnings.push("Dữ liệu thị trường hiện không khả dụng.");
  }
  return [...new Set(warnings)].slice(0, 6);
}

function buildFallbackTldr(
  context: TokenAiContext,
  intent: TokenAiIntent,
  language: TokenAiLanguage,
) {
  const label = tokenLabel(context);
  const move = priceMove(context);
  const securityGap =
    "Security authority/deployer evidence is unavailable, so Yoca cannot verify safe/scam claims.";

  if (language === "vi") {
    return [
      `${label}: ${viPriceMovePhrase(context)}; cần đọc cùng volume, thanh khoản và tin tức thay vì chỉ nhìn giá.`,
      `${viCatalystInterpretation(context)} ${viVolumeInterpretation(context)}`,
      "Yoca chưa có dữ liệu contract/security, nên không thể xác nhận token an toàn hay lừa đảo từ câu trả lời này.",
    ];
  }

  if (intent === "latest_news") {
    return [
      `${headlineBullets(context).length} recent headline item(s) are available in the answer.`,
      newsInterpretation(context),
      catalystInterpretation(context),
    ];
  }

  return [
    `${label} is ${move.phrase}; the useful read is what that implies alongside volume, liquidity, holders, and news.`,
    `${catalystInterpretation(context)} ${volumeInterpretation(context)}`,
    securityGap,
  ];
}

function buildVietnameseFallbackSections(
  context: TokenAiContext,
  intent: TokenAiIntent,
): TokenAiSection[] {
  const label = tokenLabel(context);
  const wrapped = wrappedTokenInterpretation(context);

  if (intent === "risk_overview") {
    return [
      {
        title: "Rủi Ro Thị Trường",
        kind: "risk_factors",
        bullets: [
          `${label} đang ${viPriceMovePhrase(context)}; biến động này cần đọc cùng volume và thanh khoản.`,
          viCatalystInterpretation(context),
          viLowDataInterpretation(context),
        ],
      },
      {
        title: "Rủi Ro Thanh Khoản Và Giao Dịch",
        kind: "risk_factors",
        bullets: [viVolumeInterpretation(context), viLiquidityInterpretation(context)],
      },
      {
        title: "Rủi Ro Holder",
        kind: "risk_factors",
        bullets: [viHolderInterpretation(context)],
      },
      {
        title: "Rủi Ro Tin Tức Và Narrative",
        kind: "risk_factors",
        bullets: [
          viNewsInterpretation(context),
          ...(wrapped
            ? [
                "Đây có vẻ là wrapped token, nên biến động có thể phản ánh tài sản gốc và thanh khoản wrapper hơn là narrative độc lập.",
              ]
            : []),
        ],
      },
      {
        title: "Dữ Liệu Security Chưa Có",
        kind: "risk_factors",
        content:
          "Yoca chưa có bằng chứng về mint authority, freeze authority, deployer, creator hoặc honeypot status, nên không thể kết luận token an toàn hay lừa đảo.",
      },
      {
        title: "Cần Theo Dõi",
        kind: "what_to_watch",
        bullets: viWatchSignalBullets(context),
      },
    ];
  }

  return [
    {
      title: "Tóm Tắt Phân Tích",
      kind: "market_snapshot",
      bullets: [
        `${label} đang ${viPriceMovePhrase(context)}.`,
        viVolumeInterpretation(context),
        viLiquidityInterpretation(context),
      ],
    },
    {
      title: "Ý Nghĩa Của Tín Hiệu",
      kind: "deep_dive",
      bullets: [
        viCatalystInterpretation(context),
        viNewsInterpretation(context),
        viHolderInterpretation(context),
        ...(wrapped
          ? [
              "Vì đây có vẻ là wrapped token, hãy đọc dữ liệu như phản ánh tài sản gốc và thanh khoản wrapper.",
            ]
          : []),
      ],
    },
    {
      title: "Cần Theo Dõi",
      kind: "what_to_watch",
      bullets: viWatchSignalBullets(context),
    },
  ];
}

function buildImprovedFallbackSections(
  context: TokenAiContext,
  intent: TokenAiIntent,
  language: TokenAiLanguage,
): TokenAiSection[] {
  const label = tokenLabel(context);
  const wrapped = wrappedTokenInterpretation(context);

  if (language === "vi") {
    return buildVietnameseFallbackSections(context, intent);
  }

  switch (intent) {
    case "price_move_explanation":
      return [
        {
          title: "What The Move Implies",
          kind: "key_drivers",
          bullets: [
            `${label} is ${priceMove(context).phrase}.`,
            catalystInterpretation(context),
            volumeInterpretation(context),
            liquidityInterpretation(context),
            holderInterpretation(context),
          ],
        },
        {
          title: "Evidence Behind The Read",
          kind: "deep_dive",
          bullets: [
            chartInterpretation(context),
            volatilityInterpretation(context),
            newsInterpretation(context),
            lowDataInterpretation(context),
          ],
        },
        {
          title: "Watch Signals",
          kind: "what_to_watch",
          bullets: watchSignalBullets(context).slice(0, 3),
        },
        {
          title: "Bottom Line",
          kind: "conclusion",
          content:
            "The move can be framed with market, liquidity, holder, and news evidence, but the data does not prove a single cause.",
        },
      ];
    case "latest_news":
      return [
        {
          title: "Latest Headlines",
          kind: "latest_headlines",
          bullets: headlineBullets(context),
        },
        {
          title: "How Direct The News Looks",
          kind: "why_it_matters",
          content: newsInterpretation(context),
        },
        {
          title: "Why It Matters",
          kind: "why_it_matters",
          bullets: [
            catalystInterpretation(context),
            "Direct token-specific news can support a narrative; broad ecosystem news should be treated as context only.",
            "If price moves without direct token news, market structure and liquidity deserve more weight than headlines.",
          ],
        },
        {
          title: "What To Watch",
          kind: "what_to_watch",
          bullets: watchSignalBullets(context).slice(2, 5),
        },
      ];
    case "bullish_bearish":
      return [
        {
          title: "Bullish Case",
          kind: "bullish_signals",
          bullets: bullishBullets(context),
        },
        {
          title: "Bearish Case",
          kind: "bearish_signals",
          bullets: bearishBullets(context),
        },
        {
          title: "Balanced Conclusion",
          kind: "conclusion",
          content:
            "The useful conclusion is not a trade command: weigh price direction against volume quality, liquidity depth, holder distribution, news relevance, and missing security evidence.",
        },
        {
          title: "Confirmation Signals",
          kind: "what_to_watch",
          bullets: watchSignalBullets(context),
        },
      ];
    case "risk_overview":
      return [
        {
          title: "Market Risk",
          kind: "risk_factors",
          bullets: [
            `${label} is ${priceMove(context).phrase}.`,
            catalystInterpretation(context),
            chartInterpretation(context),
          ],
        },
        {
          title: "Liquidity And Trading Risk",
          kind: "risk_factors",
          bullets: [volumeInterpretation(context), liquidityInterpretation(context)],
        },
        {
          title: "Holder Concentration Risk",
          kind: "risk_factors",
          bullets: [holderInterpretation(context)],
        },
        {
          title: "News And Narrative Risk",
          kind: "risk_factors",
          bullets: [newsInterpretation(context), ...(wrapped ? [wrapped] : [])],
        },
        {
          title: "Unavailable Security Evidence",
          kind: "risk_factors",
          content:
            "Yoca does not have direct contract-security evidence for this token yet, so it cannot verify mint authority, freeze authority, deployer risk, creator risk, honeypot status, or whether the token is safe/scam.",
        },
        {
          title: "Risk Signals To Watch",
          kind: "what_to_watch",
          bullets: watchSignalBullets(context).slice(0, 4),
        },
      ];
    case "simple_explanation":
      return [
        {
          title: "What This Token Is",
          kind: "simple_explanation",
          content: wrapped
            ? `${label} appears to be a wrapped token, meaning it represents another underlying asset on this chain or venue. Its price action may mostly track that underlying asset plus local liquidity.`
            : `${label} is a token Yoca can inspect through available market, chart, news, liquidity, and holder evidence.`,
        },
        {
          title: "Why Users Track It",
          kind: "why_it_matters",
          bullets: [
            "Price and volume show whether traders are actively repricing it.",
            "Liquidity shows how costly larger trades may become through slippage.",
            "Holder concentration shows whether distribution risk is worth monitoring.",
            "News helps separate direct project catalysts from broad ecosystem noise.",
          ],
        },
        {
          title: "One-Line Takeaway",
          kind: "conclusion",
          content: `${label} is best read through market activity, liquidity depth, holder distribution, and direct news relevance; security claims need separate evidence.`,
        },
      ];
    case "what_to_watch":
      return [
        {
          title: "Concrete Signals",
          kind: "what_to_watch",
          bullets: watchSignalBullets(context),
        },
        {
          title: "How To Interpret Them",
          kind: "deep_dive",
          bullets: [
            volumeInterpretation(context),
            liquidityInterpretation(context),
            holderInterpretation(context),
            newsInterpretation(context),
          ],
        },
        {
          title: "Takeaway",
          kind: "conclusion",
          content:
            "The strongest read comes when price, volume, liquidity, holders, and direct news all point in the same direction.",
        },
      ];
    case "investment_guidance":
      return [
        {
          title: "Market Context",
          kind: "market_snapshot",
          bullets: [
            `${label} is ${priceMove(context).phrase}.`,
            volumeInterpretation(context),
            liquidityInterpretation(context),
            catalystInterpretation(context),
          ],
        },
        {
          title: "Bullish Case",
          kind: "bullish_signals",
          bullets: bullishBullets(context),
        },
        {
          title: "Bearish Case",
          kind: "bearish_signals",
          bullets: bearishBullets(context),
        },
        {
          title: "Risk Framework",
          kind: "practical_framework",
          bullets: [
            "Do not treat this as a buy/sell instruction.",
            "Wait for confirmation from price direction, volume quality, liquidity stability, direct news, and holder concentration.",
            "Keep security authority gaps separate from market signals; missing security data should lower confidence.",
          ],
        },
      ];
    default:
      return [
        {
          title: "Market Snapshot",
          kind: "market_snapshot",
          bullets: [
            `${label} is ${priceMove(context).phrase}.`,
            volumeInterpretation(context),
            liquidityInterpretation(context),
          ],
        },
        {
          title: "Interpretation",
          kind: "deep_dive",
          bullets: [
            catalystInterpretation(context),
            newsInterpretation(context),
            holderInterpretation(context),
            lowDataInterpretation(context),
          ],
        },
        {
          title: "What To Watch",
          kind: "what_to_watch",
          bullets: watchSignalBullets(context).slice(0, 4),
        },
      ];
  }
}

function buildFallbackSections(
  context: TokenAiContext,
  intent: TokenAiIntent,
  language: TokenAiLanguage,
): TokenAiSection[] {
  const market = marketRecord(context);
  const priceChange24h = Number(market.priceChangePercentage24h);
  const label = tokenLabel(context);
  const snapshot = [
    `Price: ${compactCurrency(market.priceUsd)}.`,
    `24h change: ${percent(market.priceChangePercentage24h)}.`,
    `24h volume: ${compactCurrency(market.volume24h)}.`,
    `Market cap: ${compactCurrency(market.marketCap)}.`,
  ];
  const drivers = [
    context.chartSummary?.changePercent != null
      ? `${context.timeframe} chart change is ${percent(context.chartSummary.changePercent)} across ${context.chartSummary.points} points.`
      : "Chart data is thin for the selected timeframe.",
    context.volatilityEvents.length > 0
      ? `${context.volatilityEvents.length} volatility signal(s) were detected.`
      : "No bounded volatility signal was available in the context.",
    context.latestNews.length > 0
      ? `${context.latestNews.length} recent news item(s) were included.`
      : "No recent news item was included.",
  ];

  if (language === "vi") {
    const viWatch = [
      "Theo dõi giá, khối lượng 24h, thanh khoản pool và các sự kiện biến động mới.",
      "Đối chiếu tin tức với thời điểm biến động, nhưng không xem đó là bằng chứng nhân quả.",
      "Không dùng câu trả lời này thay cho kiểm tra bảo mật on-chain.",
    ];
    if (intent === "latest_news") {
      return [
        { title: "Tin Mới Nhất", kind: "latest_headlines", bullets: newsBullets(context) },
        { title: "Vì Sao Quan Trọng", kind: "why_it_matters", bullets: drivers },
        { title: "Cần Theo Dõi", kind: "what_to_watch", bullets: viWatch },
        { title: "Kết Luận", kind: "conclusion", content: `Bằng chứng hiện tại cho ${label} hữu ích để tạo bối cảnh, nhưng còn hạn chế.` },
      ];
    }
    if (intent === "risk_overview") {
      return [
        { title: "Rủi Ro Chính", kind: "risk_factors", bullets: ["Dữ liệu bảo mật như mint/freeze authority và deployer hiện chưa có.", ...drivers] },
        { title: "Tín Hiệu Có Dữ Liệu", kind: "deep_dive", bullets: snapshot },
        { title: "Cần Theo Dõi", kind: "what_to_watch", bullets: viWatch },
        { title: "Kết Luận", kind: "conclusion", content: "Có thể đánh giá rủi ro thị trường và thanh khoản ở mức sơ bộ, nhưng không thể kết luận token an toàn hay lừa đảo từ dữ liệu hiện có." },
      ];
    }
  }

  switch (intent) {
    case "latest_news":
      return [
        { title: "Latest Headlines", kind: "latest_headlines", bullets: newsBullets(context) },
        { title: "Why It Matters", kind: "why_it_matters", bullets: drivers },
        { title: "What To Watch Next", kind: "what_to_watch", bullets: watchBullets(context) },
        { title: "Conclusion", kind: "conclusion", content: `The available headlines provide context for ${label}, but they do not prove why price moved.` },
      ];
    case "risk_overview":
      return [
        { title: "Main Risk Factors", kind: "risk_factors", bullets: ["Security fields are unavailable, so Yoca cannot verify mint authority, freeze authority, deployer, creator, honeypot status, or private insider behavior.", ...drivers] },
        { title: "Data-Backed Risk Signals", kind: "deep_dive", bullets: snapshot },
        { title: "What To Watch Next", kind: "what_to_watch", bullets: watchBullets(context) },
        { title: "Conclusion", kind: "conclusion", content: "This can support a market/liquidity risk overview, but it cannot prove whether the token is safe or unsafe." },
      ];
    case "bullish_bearish":
      return [
        { title: "Bullish Signals", kind: "bullish_signals", bullets: [Number.isFinite(priceChange24h) && priceChange24h > 0 ? `Positive 24h price change of ${percent(priceChange24h)}.` : "No positive 24h price signal in the current market data.", context.latestNews.length > 0 ? "Recent news context is available." : "No recent news support in the evidence."] },
        { title: "Bearish Signals", kind: "bearish_signals", bullets: [Number.isFinite(priceChange24h) && priceChange24h < 0 ? `Negative 24h price change of ${percent(priceChange24h)}.` : "No negative 24h price signal in the current market data.", "Security and authority fields are missing."] },
        { title: "Balance of Evidence", kind: "conclusion", content: "The evidence is mixed and should be treated as context, not a trading command." },
        { title: "What To Watch Next", kind: "what_to_watch", bullets: watchBullets(context) },
      ];
    case "simple_explanation":
      return [
        { title: "What This Token Is", kind: "simple_explanation", content: `${label} is shown on Yoca with available market, chart, news, holder, and pool context. The current backend evidence does not define private team behavior or security authority fields.` },
        { title: "How It Works / Ecosystem Role", kind: "deep_dive", content: typeof (context.metadata as { description?: unknown } | null)?.description === "string" ? String((context.metadata as { description: string }).description).slice(0, 800) : "Yoca does not currently have enough structured project-description evidence for a deeper ecosystem explanation." },
        { title: "Why It Matters", kind: "why_it_matters", bullets: snapshot },
        { title: "One-Line Takeaway", kind: "conclusion", content: `${label} can be reviewed through market movement, liquidity, holders, and news context, but security claims need separate evidence.` },
      ];
    case "what_to_watch":
      return [
        { title: "Key Items To Watch", kind: "what_to_watch", bullets: watchBullets(context) },
        { title: "How To Interpret These Signals", kind: "deep_dive", content: "Use agreement across market data, liquidity, holder concentration, volatility, and credible news as stronger context than any single signal." },
        { title: "Takeaway", kind: "conclusion", content: "Track changes over time; a single snapshot is not enough for high confidence." },
      ];
    case "investment_guidance":
      return [
        { title: "Market Facts and Why They Matter", kind: "market_snapshot", bullets: snapshot },
        { title: "Plausible Scenarios", kind: "scenario_analysis", bullets: ["Constructive scenario: price/volume/liquidity improve while news remains supportive.", "Cautious scenario: liquidity thins, volatility increases, or new negative evidence appears."] },
        { title: "Practical Risk Framework", kind: "practical_framework", bullets: ["Define invalidation conditions before acting.", "Avoid relying on unavailable security fields.", "Size decisions according to risk tolerance and independent research."] },
        { title: "What To Watch Next", kind: "what_to_watch", bullets: watchBullets(context) },
        { title: "Conclusion", kind: "conclusion", content: "Yoca can frame scenarios and risks, but it should not be used as a direct buy, sell, or hold instruction." },
      ];
    default:
      return [
        { title: "Market Snapshot", kind: "market_snapshot", bullets: snapshot },
        { title: "Key Context", kind: "deep_dive", bullets: drivers },
        { title: "What To Watch Next", kind: "what_to_watch", bullets: watchBullets(context) },
        { title: "Conclusion", kind: "conclusion", content: "The answer is grounded in the available Yoca evidence and avoids unsupported security or trading claims." },
      ];
  }
}

function buildDeterministicAnswer(
  request: TokenAiChatRequest,
  context: TokenAiContext,
  intent: TokenAiIntent,
  fallbackReason: TokenAiFallbackReason = "deterministic_fallback",
): TokenAiChatData {
  const warnings = localizedEvidenceWarning(context, request.language);
  const market = marketRecord(context);
  const label = tokenLabel(context);
  const tldr =
    request.language === "vi"
      ? [
          `${label}: giá hiện khoảng ${compactCurrency(market.priceUsd)}, thay đổi 24h ${percent(market.priceChangePercentage24h)}.`,
          context.latestNews.length > 0
            ? `Có ${context.latestNews.length} tin tức gần đây trong bằng chứng.`
            : "Không có tin tức gần đây trong bằng chứng.",
          "Không có dữ liệu bảo mật mint/freeze/deployer, nên không thể kết luận token an toàn hay lừa đảo.",
        ]
      : [
          `${label} is around ${compactCurrency(market.priceUsd)} with 24h change of ${percent(market.priceChangePercentage24h)}.`,
          context.latestNews.length > 0
            ? `${context.latestNews.length} recent news item(s) were included as context.`
            : "No recent token news was available in the evidence bundle.",
          "Security authority/deployer fields are unavailable, so Yoca cannot verify safe/scam claims.",
        ];

  return {
    token: context.token,
    question: request.question,
    intent,
    tldr: buildFallbackTldr(context, intent, request.language).slice(0, 3),
    sections: buildImprovedFallbackSections(context, intent, request.language),
    evidence: context.evidence,
    sources: context.sources,
    warnings,
    confidence: confidenceFor(context, intent),
    asOf: context.builtAt,
    disclaimer: localizedDisclaimer(request.language),
    generatedAt: new Date().toISOString(),
    provider: "deterministic",
    fallbackReason: exposeFallbackReason(fallbackReason),
  };
}

function compactContextForPrompt(context: TokenAiContext) {
  return {
    token: context.token,
    timeframe: context.timeframe,
    market: context.market,
    metadata: context.metadata,
    chartSummary: context.chartSummary,
    latestNews: context.latestNews.map((article) => ({
      title: article.title,
      source: article.source,
      publishedAt: article.publishedAt,
      description: article.description?.slice(0, 320),
      url: article.url,
    })),
    chartNewsMarkers: context.chartNewsMarkers,
    volatilityEvents: context.volatilityEvents,
    holderStats: context.holderStats,
    topHolders: context.topHolders.slice(0, 5),
    pools: context.pools.slice(0, 3),
    recentTrades: context.recentTrades.slice(0, 5),
    missingSections: context.missingSections,
    evidence: context.evidence,
    sources: context.sources,
    builtAt: context.builtAt,
  };
}

function buildPrompt({
  request,
  context,
  intent,
}: {
  request: TokenAiChatRequest;
  context: TokenAiContext;
  intent: TokenAiIntent;
}) {
  return [
    `Question: ${request.question}`,
    `Language: ${request.language}`,
    `Intent: ${intent}`,
    `Timeframe: ${request.timeframe}`,
    "",
    "Use only the provided Yoca evidence. Separate facts from interpretation.",
    "Do not simply list the available evidence. Synthesize it into a useful analyst answer.",
    "Minimum usefulness rule: every non-empty section must contain at least one concrete implication or decision-useful interpretation, not just a repeated metric.",
    "For every important metric, explain what it implies. For every conclusion, point to the evidence that supports it.",
    "Prefer specific interpretation over generic advice. Avoid phrases like watch price and volume, track changes over time, or do your own research unless followed by the concrete pattern that matters.",
    "If price is down but no direct negative news is found, say the move appears more likely market/liquidity-driven than news-driven.",
    "If volume is high while price falls, explain possible sell pressure, liquidation, or rotation context, but do not claim causation without evidence.",
    "If holder concentration is high, explain that it can increase distribution risk, but do not claim manipulation.",
    "If liquidity is high, explain that slippage risk may be lower, but price can still move strongly.",
    "If only wrapped-token data is available, explain that the token may reflect the underlying asset rather than an independent project.",
    "Never invent unavailable data. Never claim mint authority, freeze authority, deployer, creator, honeypot status, token security, or private insider behavior unless the evidence explicitly includes it.",
    "Do not give direct buy, sell, or hold instructions. Do not use guaranteed, will pump, risk-free, or equivalent certainty.",
    "If the user asks risk, safe, or scam, clearly separate available market/liquidity/holder/news risk from unavailable contract/security authority evidence.",
    "If the user asks whether to buy, do not give a buy/sell command. Give market context, bullish case, bearish case, risk framework, and confirmation signals to wait for.",
    "For investment-like questions, use scenario framing, risk framework, and watch-next items.",
    "Sound like a crypto analyst explaining the situation to a normal user. Be direct, concrete, and careful about uncertainty.",
    "Use intent-specific sections. Keep TLDR to 2-3 bullets. Include warnings for thin data, missing news, and missing security data.",
    "If language is vi, answer in Vietnamese.",
    "Return JSON only with keys: tldr, sections, warnings, confidence, disclaimer.",
    "",
    JSON.stringify(compactContextForPrompt(context), null, 2),
  ].join("\n");
}

interface GeminiAnswerResult {
  data: Omit<TokenAiChatData, "cache"> | null;
  fallbackReason: TokenAiFallbackReason;
}

function parseGeminiJsonText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true as const, value: {} };

  try {
    return { ok: true as const, value: JSON.parse(trimmed) as unknown };
  } catch (firstError) {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) {
      try {
        return { ok: true as const, value: JSON.parse(fenced) as unknown };
      } catch {
        // Fall through to the concise parse error below.
      }
    }

    return {
      ok: false as const,
      error: firstError instanceof Error ? firstError.message : String(firstError),
    };
  }
}

async function generateGeminiAnswer(
  request: TokenAiChatRequest,
  context: TokenAiContext,
  intent: TokenAiIntent,
): Promise<GeminiAnswerResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    logGeminiFallback("missing_api_key");
    return { data: null, fallbackReason: "missing_api_key" };
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: TOKEN_AI_CHAT_MODEL,
      contents: buildPrompt({ request, context, intent }),
      config: {
        temperature: 0.25,
        responseMimeType: "application/json",
        systemInstruction: [
          "You are Yoca AI, a careful token evidence analyst.",
          "You answer custom questions about one token using only supplied Yoca evidence.",
          "You avoid direct financial advice and unsupported token security claims.",
          "Return strict JSON only.",
        ].join(" "),
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tldr: { type: Type.ARRAY, items: { type: Type.STRING } },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  kind: { type: Type.STRING },
                  content: { type: Type.STRING },
                  bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                  table: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT },
                  },
                },
                required: ["title", "kind"],
              },
            },
            warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidence: { type: Type.STRING },
            disclaimer: { type: Type.STRING },
          },
          required: ["tldr", "sections", "warnings", "confidence", "disclaimer"],
        },
      },
    });

    const rawText = response.text ?? "";
    const json = parseGeminiJsonText(rawText);
    if (!json.ok) {
      logGeminiFallback("gemini_invalid_json", {
        error: json.error,
        responseLength: rawText.length,
      });
      return { data: null, fallbackReason: "gemini_invalid_json" };
    }

    const parsed = geminiResponseSchema.safeParse(json.value);
    if (!parsed.success) {
      logGeminiFallback("gemini_zod_validation_error", {
        issues: parsed.error.issues
          .slice(0, 8)
          .map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
      });
      return { data: null, fallbackReason: "gemini_zod_validation_error" };
    }

    return {
      data: {
        token: context.token,
        question: request.question,
        intent,
        tldr: parsed.data.tldr,
        sections: parsed.data.sections,
        evidence: context.evidence,
        sources: context.sources,
        warnings: [
          ...new Set([
            ...parsed.data.warnings,
            ...localizedEvidenceWarning(context, request.language),
          ]),
        ].slice(0, 6),
        confidence:
          intent === "risk_overview" && parsed.data.confidence === "High"
            ? "Medium"
            : parsed.data.confidence,
        asOf: context.builtAt,
        disclaimer: parsed.data.disclaimer || localizedDisclaimer(request.language),
        generatedAt: new Date().toISOString(),
        provider: "gemini",
      },
      fallbackReason: "deterministic_fallback",
    };
  } catch (err) {
    logGeminiFallback("gemini_api_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { data: null, fallbackReason: "gemini_api_error" };
  }
}

export async function askTokenAiChat(
  request: TokenAiChatRequest,
): Promise<TokenAiChatData> {
  const intent = classifyTokenAiIntent(request.question);
  const context = await buildTokenAiContext({
    address: request.address,
    symbol: request.symbol,
    name: request.name,
    timeframe: request.timeframe,
    includeNews: request.includeNews,
    includeVolatility: request.includeVolatility,
  });
  const evidenceHash = hashTokenAiContext(compactContextForPrompt(context));
  const cacheKey = {
    tokenAddress: request.address,
    normalizedQuestionHash: hashQuestion(request.question),
    timeframe: request.timeframe,
    language: request.language,
    promptVersion: TOKEN_AI_CHAT_PROMPT_VERSION,
    model: TOKEN_AI_CHAT_MODEL,
    evidenceHash,
  };
  const geminiConfigured = Boolean(getGeminiApiKey());

  const cached = await readTokenAiChatCache(cacheKey);
  if (cached) {
    if (cached.data.provider === "deterministic" && geminiConfigured) {
      logGeminiFallback("cached_deterministic_ignored_gemini_available");
    } else {
      const fallbackReason =
        cached.data.provider === "deterministic"
          ? cached.data.fallbackReason ??
            exposeFallbackReason("cached_deterministic_response")
          : undefined;
      return {
        ...cached.data,
        fallbackReason,
        cache: {
          hit: true,
          expiresAt: cached.expiresAt,
        },
      };
    }
  }

  const gemini = await generateGeminiAnswer(request, context, intent);
  const fresh =
    gemini.data ??
    buildDeterministicAnswer(
      request,
      context,
      intent,
      gemini.fallbackReason,
    );

  if (fresh.provider === "deterministic" && !fresh.fallbackReason) {
    fresh.fallbackReason = exposeFallbackReason(gemini.fallbackReason);
  }

  const expiresAt = getTokenAiChatCacheExpiresAt(request.timeframe);
  const data: TokenAiChatData = {
    ...fresh,
    cache: {
      hit: false,
      expiresAt: expiresAt.toISOString(),
    },
  };

  try {
    await writeTokenAiChatCache(cacheKey, data, expiresAt);
  } catch (err) {
    console.warn("[token-ai-chat] cache write failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return data;
}
