import { createHash } from "node:crypto";

import { GoogleGenAI, Type } from "@google/genai";
import { WALLET_AUDIT_MODEL } from "@sv/config/constants.js";
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
  process.env.TOKEN_AI_CHAT_PROMPT_VERSION?.trim() || "v1";

const sectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum([
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
  ]),
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
  return (
    process.env.GOOGLE_AI_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    ""
  );
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
  return "en";
}

export function classifyTokenAiIntent(question: string): TokenAiIntent {
  const q = question.toLowerCase();
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
): TokenAiChatData {
  const warnings = evidenceWarning(context, request.language);
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
    tldr: tldr.slice(0, 3),
    sections: buildFallbackSections(context, intent, request.language),
    evidence: context.evidence,
    sources: context.sources,
    warnings,
    confidence: confidenceFor(context, intent),
    asOf: context.builtAt,
    disclaimer: defaultDisclaimer(request.language),
    generatedAt: new Date().toISOString(),
    provider: "deterministic",
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
    "Never invent unavailable data. Never claim mint authority, freeze authority, deployer, creator, honeypot status, token security, or private insider behavior unless the evidence explicitly includes it.",
    "Do not give direct buy, sell, or hold instructions. Do not use guaranteed, will pump, risk-free, or equivalent certainty.",
    "For investment-like questions, use scenario framing, risk framework, and watch-next items.",
    "Use intent-specific sections. Keep TLDR to 2-3 bullets. Include warnings for thin data, missing news, and missing security data.",
    "If language is vi, answer in Vietnamese.",
    "Return JSON only with keys: tldr, sections, warnings, confidence, disclaimer.",
    "",
    JSON.stringify(compactContextForPrompt(context), null, 2),
  ].join("\n");
}

async function generateGeminiAnswer(
  request: TokenAiChatRequest,
  context: TokenAiContext,
  intent: TokenAiIntent,
): Promise<Omit<TokenAiChatData, "cache"> | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

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

    const parsed = geminiResponseSchema.safeParse(
      JSON.parse(response.text ?? "{}"),
    );
    if (!parsed.success) return null;

    return {
      token: context.token,
      question: request.question,
      intent,
      tldr: parsed.data.tldr,
      sections: parsed.data.sections,
      evidence: context.evidence,
      sources: context.sources,
      warnings: [...new Set([...parsed.data.warnings, ...evidenceWarning(context, request.language)])].slice(0, 6),
      confidence:
        intent === "risk_overview" && parsed.data.confidence === "High"
          ? "Medium"
          : parsed.data.confidence,
      asOf: context.builtAt,
      disclaimer: parsed.data.disclaimer || defaultDisclaimer(request.language),
      generatedAt: new Date().toISOString(),
      provider: "gemini",
    };
  } catch (err) {
    console.warn("[token-ai-chat] Gemini generation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
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

  const cached = await readTokenAiChatCache(cacheKey);
  if (cached) {
    return {
      ...cached.data,
      cache: {
        hit: true,
        expiresAt: cached.expiresAt,
      },
    };
  }

  const fresh =
    (await generateGeminiAnswer(request, context, intent)) ??
    buildDeterministicAnswer(request, context, intent);
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
