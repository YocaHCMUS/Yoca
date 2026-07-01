import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCookie: vi.fn(),
  verify: vi.fn(),
  readCache: vi.fn(),
  writeCache: vi.fn(),
  getVolatility: vi.fn(),
  getRssNews: vi.fn(),
  summarize: vi.fn(),
  geminiConfigured: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
  getUsage: vi.fn(),
}));

vi.mock("hono/cookie", () => ({ getCookie: mocks.getCookie }));
vi.mock("hono/jwt", () => ({ verify: mocks.verify }));
vi.mock("@sv/util/load-env.js", () => ({
  default: { JWT_SECRET: "test-secret" },
}));
vi.mock("@sv/config/constants.js", () => ({
  AUTH_COOKIE_NAME: "auth_token",
}));
vi.mock("@sv/services/ai-usage.service.js", () => ({
  AI_FEATURES: {
    VolatilitySignalSummary: "volatility_signal_summary",
  },
  getAiUsage: mocks.getUsage,
  reserveAiUsage: mocks.reserve,
  releaseAiUsage: mocks.release,
}));
vi.mock("@sv/services/tokens/token-volatility-news-cache.js", () => ({
  getTokenVolatilityNewsCacheExpiresAt: vi.fn(
    () => new Date("2026-06-24T00:00:00.000Z"),
  ),
  readTokenVolatilityNewsCache: mocks.readCache,
  writeTokenVolatilityNewsCache: mocks.writeCache,
}));
vi.mock("@sv/services/tokens/token-volatility.js", () => ({
  getTokenPriceVolatilityEvents: mocks.getVolatility,
}));
vi.mock("@sv/services/rss-news.service.js", () => ({
  getRssTokenNews: mocks.getRssNews,
}));
vi.mock("@sv/services/tokens/token-volatility-summary.js", () => ({
  isTokenVolatilityGeminiConfigured: mocks.geminiConfigured,
  summarizeTokenVolatilityNews: mocks.summarize,
}));

import app from "@sv/routes/token-volatility-news.js";

const usage = {
  feature: "volatility_signal_summary",
  tier: "Free",
  limit: 10,
  used: 1,
  remaining: 9,
  resetsAt: "2026-06-24T00:00:00.000Z",
} as const;

const volatility = {
  token: {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
  },
  thresholdPercent: 20,
  timeframe: "daily",
  metric: "price",
  updatedAt: "2026-06-23T00:00:00.000Z",
  dataPointsAnalyzed: 20,
  rawEventsDetected: 0,
  groupedEventsReturned: 0,
  evaluatedWindows: ["24h"],
  events: [],
};

function request({
  summary = false,
  authenticated = false,
  forceRefresh = false,
} = {}) {
  const query = new URLSearchParams({
    address: volatility.token.address,
    symbol: volatility.token.symbol,
    name: volatility.token.name,
    threshold: "20",
    timeframe: "daily",
    window: "auto",
    maxEventsWithNews: "3",
    ...(summary ? { includeSummary: "true" } : {}),
    ...(forceRefresh ? { forceRefresh: "true" } : {}),
  });

  return app.request(`/?${query}`, {
    headers: authenticated ? { "x-test-user": "user-1" } : {},
  });
}

describe("GET /api/token-volatility-news", () => {
  beforeEach(() => {
    mocks.getCookie.mockImplementation((c) =>
      c.req.header("x-test-user") ? "test-token" : undefined,
    );
    mocks.verify.mockResolvedValue({
      id: "user-1",
      exp: 9999999999,
      displayName: null,
    });
    mocks.readCache.mockResolvedValue(null);
    mocks.writeCache.mockResolvedValue(undefined);
    mocks.getVolatility.mockResolvedValue(volatility);
    mocks.getRssNews.mockResolvedValue({
      articles: [],
      meta: {
        braveFallbackUsed: false,
        braveNewsUsed: false,
        braveWebFallbackUsed: false,
        providersUsed: ["rss"],
        sourceTypeCounts: {
          news: 0,
          web_mention: 0,
          project_update: 0,
        },
      },
    });
    mocks.geminiConfigured.mockReturnValue(true);
    mocks.summarize.mockResolvedValue({
      headline: "Summary",
      bullets: ["Bullet"],
      riskNote: "Risk",
      generatedAt: "2026-06-23T00:00:00.000Z",
      provider: "gemini:gemini-2.5-flash",
    });
    mocks.reserve.mockResolvedValue({
      allowed: true,
      usage,
      userId: "user-1",
      usageDate: "2026-06-23",
    });
    mocks.release.mockResolvedValue(undefined);
    mocks.getUsage.mockResolvedValue({ ...usage, used: 0, remaining: 10 });
  });

  it("keeps normal volatility signals public and quota-free", async () => {
    const response = await request();

    expect(response.status).toBe(200);
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.summarize).not.toHaveBeenCalled();
  });

  it("requires authentication for summaries", async () => {
    const response = await request({ summary: true });

    expect(response.status).toBe(401);
    expect(mocks.readCache).not.toHaveBeenCalled();
  });

  it("does not consume quota for a cached summary", async () => {
    mocks.readCache.mockResolvedValue({
      data: { ...volatility, summary: { headline: "Cached" } },
      expiresAt: "2026-06-24T00:00:00.000Z",
    });

    const response = await request({ summary: true, authenticated: true });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ counted: false });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it("does not consume quota when Gemini is not configured", async () => {
    mocks.geminiConfigured.mockReturnValue(false);
    mocks.summarize.mockResolvedValue({
      headline: "Fallback",
      bullets: ["Bullet"],
      riskNote: "Risk",
      generatedAt: "2026-06-23T00:00:00.000Z",
      provider: "deterministic",
    });

    const response = await request({ summary: true, authenticated: true });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ counted: false });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it("keeps the reservation for a successful Gemini summary", async () => {
    const response = await request({ summary: true, authenticated: true });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ counted: true, usage });
    expect(mocks.reserve).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("releases usage when summary generation falls back", async () => {
    mocks.summarize.mockResolvedValue({
      headline: "Fallback",
      bullets: ["Bullet"],
      riskNote: "Risk",
      generatedAt: "2026-06-23T00:00:00.000Z",
      provider: "deterministic",
    });

    const response = await request({ summary: true, authenticated: true });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ counted: false });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("returns 429 without calling Gemini when quota is exhausted", async () => {
    mocks.reserve.mockResolvedValue({
      allowed: false,
      usage: { ...usage, used: 10, remaining: 0 },
      userId: "user-1",
      usageDate: "2026-06-23",
    });

    const response = await request({ summary: true, authenticated: true });
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toMatchObject({
      errorCode: "AI_DAILY_LIMIT_EXCEEDED",
      used: 10,
      remaining: 0,
      upgradePath: "/pricing",
    });
    expect(mocks.summarize).not.toHaveBeenCalled();
  });
});
