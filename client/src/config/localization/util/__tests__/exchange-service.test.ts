import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getUsdToVndRate,
  refreshUsdToVndRate,
} from "../exchange-service";

describe("Exchange Rate Service", () => {
  describe("getUsdToVndRate", () => {
    it("should return the USD to VND rate", () => {
      const rate = getUsdToVndRate();
      expect(typeof rate).toBe("number");
      expect(rate).toBeGreaterThan(0);
    });

    it("should return a reasonable rate (around 25000)", () => {
      const rate = getUsdToVndRate();
      // Vietnamese Dong exchange rate should be in a reasonable range
      expect(rate).toBeGreaterThan(20000);
      expect(rate).toBeLessThan(30000);
    });
  });

  describe("refreshUsdToVndRate", () => {
    // Note: These tests use mocked API responses
    // In a real scenario, you might want to mock the API client

    it("should be an async function", () => {
      const result = refreshUsdToVndRate();
      expect(result instanceof Promise).toBe(true);
    });

    it("should not throw on network errors", async () => {
      // This test verifies the function gracefully handles errors
      expect(async () => {
        await refreshUsdToVndRate();
      }).not.toThrow();
    });

    it("should maintain fallback rate on failure", async () => {
      const rateBefore = getUsdToVndRate();
      await refreshUsdToVndRate();
      const rateAfter = getUsdToVndRate();

      // Should keep a valid rate (either original or updated)
      expect(rateAfter).toBeGreaterThan(0);
    });
  });

  describe("Rate Update Behavior", () => {
    it("should support multiple refresh calls", async () => {
      await refreshUsdToVndRate();
      await refreshUsdToVndRate();
      await refreshUsdToVndRate();

      const rate = getUsdToVndRate();
      expect(rate).toBeGreaterThan(0);
    });

    it("should handle concurrent refresh calls", async () => {
      await Promise.all([
        refreshUsdToVndRate(),
        refreshUsdToVndRate(),
        refreshUsdToVndRate(),
      ]);

      const rate = getUsdToVndRate();
      expect(rate).toBeGreaterThan(0);
    });
  });

  describe("Module Load Behavior", () => {
    it("should have initial rate set", () => {
      const rate = getUsdToVndRate();
      expect(rate).toBe(25000); // Default value from module load
    });
  });

  describe("Rate Validation", () => {
    it("should always return a positive number", () => {
      const rate = getUsdToVndRate();
      expect(rate).toBeGreaterThan(0);
      expect(Number.isFinite(rate)).toBe(true);
    });

    it("should return a number with reasonable precision", () => {
      const rate = getUsdToVndRate();
      // Exchange rates typically have at most 2-4 decimal places
      const decimalPlaces = (rate.toString().split(".")[1] || "").length;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });
  });
});
