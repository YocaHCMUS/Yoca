import { describe, expect, it, vi } from "vitest";

vi.mock("@sv/db/index.js", () => ({ db: {} }));
vi.mock("@sv/db/schema.js", () => ({ subscriptions: {} }));

import {
  getEntitlementsForPlanTier,
  selectHighestEffectivePlanTier,
} from "@sv/services/subscription-entitlements.service.js";

describe("subscription entitlements", () => {
  it("selects the highest effective tier", () => {
    expect(selectHighestEffectivePlanTier([])).toBe("Free");
    expect(selectHighestEffectivePlanTier(["Lite", "Plus"])).toBe("Plus");
    expect(selectHighestEffectivePlanTier(["Pro", "Lite", "Plus"])).toBe(
      "Pro",
    );
  });

  it("grants paid AI entitlements only to Plus and Pro", () => {
    expect(getEntitlementsForPlanTier("Free")).toEqual({
      washTradingAi: false,
      walletAiAnalysis: false,
    });
    expect(getEntitlementsForPlanTier("Lite")).toEqual({
      washTradingAi: false,
      walletAiAnalysis: false,
    });
    expect(getEntitlementsForPlanTier("Plus")).toEqual({
      washTradingAi: true,
      walletAiAnalysis: true,
    });
    expect(getEntitlementsForPlanTier("Pro")).toEqual({
      washTradingAi: true,
      walletAiAnalysis: true,
    });
  });
});
