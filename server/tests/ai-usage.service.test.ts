import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@sv/db/index.js", () => ({ db: {} }));
vi.mock("@sv/db/schema.js", () => ({
  aiDailyUsage: {},
  subscriptions: {},
}));

let getAiDailyLimit: typeof import("@sv/services/ai-usage.service.js").getAiDailyLimit;
let getUtcUsageWindow: typeof import("@sv/services/ai-usage.service.js").getUtcUsageWindow;
let selectHighestTier: typeof import("@sv/services/ai-usage.service.js").selectHighestTier;

beforeAll(async () => {
  const service = await import("@sv/services/ai-usage.service.js");
  getAiDailyLimit = service.getAiDailyLimit;
  getUtcUsageWindow = service.getUtcUsageWindow;
  selectHighestTier = service.selectHighestTier;
});

describe("AI usage policy", () => {
  it("uses the configured Ask Yoca AI limits", () => {
    expect(getAiDailyLimit("ask_yoca_ai", "Free")).toBe(5);
    expect(getAiDailyLimit("ask_yoca_ai", "Lite")).toBe(20);
    expect(getAiDailyLimit("ask_yoca_ai", "Plus")).toBe(50);
    expect(getAiDailyLimit("ask_yoca_ai", "Pro")).toBe(100);
  });

  it("uses the configured Volatility Signal Summary limits", () => {
    expect(getAiDailyLimit("volatility_signal_summary", "Free")).toBe(10);
    expect(getAiDailyLimit("volatility_signal_summary", "Lite")).toBe(25);
    expect(getAiDailyLimit("volatility_signal_summary", "Plus")).toBe(50);
    expect(getAiDailyLimit("volatility_signal_summary", "Pro")).toBe(100);
  });

  it("resets at the next UTC midnight", () => {
    expect(getUtcUsageWindow(new Date("2026-06-23T23:59:59.000Z"))).toEqual({
      usageDate: "2026-06-23",
      resetsAt: "2026-06-24T00:00:00.000Z",
    });
  });

  it("uses the highest valid paid tier", () => {
    expect(selectHighestTier([])).toBe("Free");
    expect(selectHighestTier(["Lite", "Pro", "Plus"])).toBe("Pro");
  });
});
