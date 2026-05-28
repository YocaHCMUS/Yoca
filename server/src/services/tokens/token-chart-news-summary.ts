import { GoogleGenAI, Type } from "@google/genai";
import { WALLET_AUDIT_MODEL } from "@sv/config/constants.js";
import type { TokenNewsArticle } from "@sv/services/rss-news.service.js";
import { z } from "zod";

export interface TokenChartNewsEventSummary {
  headline: string;
  tldr: string;
  bullets: string[];
  themes: string[];
  riskNote: string;
  provider?: string;
  generatedAt: string;
}

export interface TokenChartNewsEventSummaryInput {
  token: {
    symbol: string;
    name: string;
  };
  date: string;
  articleCount: number;
  articles: TokenNewsArticle[];
}

const TOKEN_CHART_NEWS_SUMMARY_MODEL =
  process.env.TOKEN_CHART_NEWS_SUMMARY_MODEL?.trim() ||
  process.env.GEMINI_AUDIT_MODEL?.trim() ||
  WALLET_AUDIT_MODEL;

const TOKEN_CHART_NEWS_RISK_NOTE =
  "These articles provide news context only and do not prove causation or imply investment advice.";

const summarySchema = z.object({
  headline: z.string().trim().min(1).max(140),
  tldr: z.string().trim().min(1).max(520),
  bullets: z.array(z.string().trim().min(1).max(260)).min(1).max(4),
  themes: z.array(z.string().trim().min(1).max(48)).min(1).max(6),
  riskNote: z.string().trim().min(1).max(280),
});

function getGeminiApiKey() {
  return (
    process.env.GOOGLE_AI_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    ""
  );
}

function normalizeText(value: string | null | undefined, maxLength: number) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function formatDateLabel(dateKey: string) {
  const timestamp = Date.parse(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) return dateKey;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(timestamp);
}

function buildArticlesForPrompt(articles: TokenNewsArticle[]) {
  return articles.slice(0, 6).map((article) => ({
    title: normalizeText(article.title, 220),
    source: article.source,
    publishedAt: article.publishedAt,
    description: normalizeText(article.description, 700),
    url: article.url,
  }));
}

function detectThemes(text: string) {
  const candidates: Array<[string, RegExp]> = [
    ["security", /\b(exploit|hack|vulnerability|security|attack)\b/i],
    ["listing", /\b(listing|exchange|binance|coinbase|kraken)\b/i],
    ["partnership", /\b(partnership|partner|collaboration|integration)\b/i],
    ["regulation", /\b(regulation|regulatory|sec|lawsuit|policy)\b/i],
    ["ecosystem", /\b(ecosystem|developer|protocol|network|mainnet)\b/i],
    ["market attention", /\b(market|trading|volume|demand|investor)\b/i],
    ["governance", /\b(governance|proposal|vote|dao)\b/i],
    ["funding", /\b(funding|raise|investment|treasury)\b/i],
  ];

  const themes = candidates
    .filter(([, pattern]) => pattern.test(text))
    .map(([theme]) => theme);

  return themes.length > 0 ? themes.slice(0, 4) : ["token news"];
}

export function buildFallbackChartNewsSummary(
  input: TokenChartNewsEventSummaryInput,
  provider = "deterministic",
): TokenChartNewsEventSummary {
  const articleInputs = buildArticlesForPrompt(input.articles);
  const snippets = articleInputs
    .map((article) => article.description)
    .filter((description) => description.length > 0);
  const evidenceTexts =
    snippets.length > 0
      ? snippets
      : articleInputs.map((article) => article.title).filter(Boolean);
  const combinedEvidence = evidenceTexts.join(" ");
  const themes = detectThemes(combinedEvidence);
  const hasLimitedSnippets =
    snippets.length === 0 ||
    snippets.join(" ").length < Math.min(160, input.articleCount * 60);

  const bullets =
    evidenceTexts.length > 0
      ? evidenceTexts.slice(0, 3).map((text) => {
          const sentence = text.split(/(?<=[.!?])\s+/)[0] || text;
          return normalizeText(sentence, 220);
        })
      : [`${input.articleCount} related article${input.articleCount === 1 ? "" : "s"} was grouped on this date.`];

  if (hasLimitedSnippets) {
    bullets.push("Summary detail is limited because the available article snippets are short.");
  }

  return {
    headline: `${input.token.name} news summary for ${formatDateLabel(input.date)}.`,
    tldr:
      evidenceTexts.length > 0
        ? `The available snippets point to ${themes.slice(0, 2).join(" and ")} around ${input.token.name}. ${hasLimitedSnippets ? "Because the snippets are limited, this summary should be treated as brief context rather than a full article synthesis." : "The summary is based on article snippets rather than full article text."}`
        : `Related token news was grouped for ${formatDateLabel(input.date)}, but usable snippets were not available.`,
    bullets: bullets.slice(0, 4),
    themes,
    riskNote: TOKEN_CHART_NEWS_RISK_NOTE,
    generatedAt: new Date().toISOString(),
    provider,
  };
}

function buildSummaryPrompt(input: TokenChartNewsEventSummaryInput) {
  const articlesJson = JSON.stringify(buildArticlesForPrompt(input.articles), null, 2);

  return [
    "Token:",
    `Name: ${input.token.name}`,
    `Symbol: ${input.token.symbol}`,
    "",
    `Date: ${input.date}`,
    `Article count: ${input.articleCount}`,
    "",
    "Articles:",
    articlesJson,
    "",
    "Task:",
    "Write a concise news summary for this token/date.",
    "",
    "Rules:",
    "- Use the article descriptions/snippets as the main evidence.",
    "- Do not merely list or rewrite titles.",
    "- Identify the shared theme across articles.",
    "- Explain what the news suggests about the token, protocol, ecosystem, adoption, regulation, security, listings, partnerships, or market attention.",
    "- If articles are mixed or only loosely related, say that clearly.",
    "- If descriptions are too short, say the summary is based on limited snippets.",
    "- Do not say the news caused price movement.",
    "- Do not predict price.",
    "- Do not add facts not present in the articles.",
    "",
    "Return valid JSON only:",
    "{",
    '  "headline": "One sentence, max 18 words.",',
    '  "tldr": "2-3 sentences summarizing the actual news content.",',
    '  "bullets": [',
    '    "Specific point from the article snippets.",',
    '    "Specific point from the article snippets.",',
    '    "Specific point from the article snippets."',
    "  ],",
    '  "themes": ["theme1", "theme2"],',
    `  "riskNote": "${TOKEN_CHART_NEWS_RISK_NOTE}"`,
    "}",
  ].join("\n");
}

export async function summarizeTokenChartNewsEvent(
  input: TokenChartNewsEventSummaryInput,
): Promise<TokenChartNewsEventSummary> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return buildFallbackChartNewsSummary(input);
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: TOKEN_CHART_NEWS_SUMMARY_MODEL,
      contents: buildSummaryPrompt(input),
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        systemInstruction:
          "You are a crypto market news analyst. Summarize only from the provided article titles and snippets. Do not invent facts. Do not claim price causation. Do not give financial advice.",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            tldr: { type: Type.STRING },
            bullets: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            themes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            riskNote: { type: Type.STRING },
          },
          required: ["headline", "tldr", "bullets", "themes", "riskNote"],
        },
      },
    });

    const parsed = summarySchema.safeParse(JSON.parse(response.text ?? "{}"));
    if (!parsed.success) {
      return buildFallbackChartNewsSummary(input, "deterministic");
    }

    return {
      ...parsed.data,
      riskNote: parsed.data.riskNote || TOKEN_CHART_NEWS_RISK_NOTE,
      generatedAt: new Date().toISOString(),
      provider: `gemini:${TOKEN_CHART_NEWS_SUMMARY_MODEL}`,
    };
  } catch (err) {
    console.warn("[token-chart-news-summary] summary generation failed", {
      error: err instanceof Error ? err.message : String(err),
    });

    return buildFallbackChartNewsSummary(input, "deterministic");
  }
}
