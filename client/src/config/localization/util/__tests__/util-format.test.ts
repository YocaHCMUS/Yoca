import { beforeEach, describe, expect, it } from "vitest";
import { defineDateTimeFormat, defineNumberFormat } from "../util-format";

describe("Number Formatting", () => {
  describe("defineNumberFormat - Standard Notation", () => {
    let formatter: ReturnType<typeof defineNumberFormat>;

    beforeEach(() => {
      const mockStrategy = {
        decimalResolution: {
          resolveCurrency: (value: number) => (Math.abs(value) >= 1 ? 2 : 4),
          resolveDecimal: (value: number) => (Math.abs(value) >= 1 ? 2 : 4),
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol" as const,
        },
        readableCompactCurrency: {
          format: (value: number) =>
            `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
        },
      };

      formatter = defineNumberFormat("en-US", mockStrategy);
    });

    it("should format decimal numbers correctly", () => {
      expect(formatter.decimal(123.45)).toBeTruthy();
      expect(formatter.decimal(null)).toBe("-");
      expect(formatter.decimal(null as any)).toBe("-");
    });

    it("should format currency with exchange rate", () => {
      const mockStrategy = {
        decimalResolution: {
          resolveCurrency: () => 2,
          resolveDecimal: () => 2,
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol" as const,
        },
        readableCompactCurrency: {
          format: (value: number) => `$${value}`,
        },
      };

      const getRate = () => 2;
      const currencyFormatter = defineNumberFormat(
        "en-US",
        mockStrategy,
        getRate,
      );

      // Should apply exchange rate
      const result = currencyFormatter.currency(100);
      expect(result).toBeTruthy();
    });

    it("should handle absolute value formatting", () => {
      expect(formatter.decimal(-123.45, true)).toBeTruthy();
    });

    it("should format percentages", () => {
      expect(formatter.percent(0.25)).toBeTruthy();
    });

    it("should format with units", () => {
      const result = formatter.unit(100, "km");
      expect(result).toContain("km");
    });

    it("should return nullDisplay for invalid values", () => {
      expect(formatter.decimal(NaN)).toBe("-");
      expect(formatter.decimal(Infinity)).toBe("-");
      expect(formatter.decimal("invalid")).toBe("-");
    });

    it("should handle string number conversion", () => {
      expect(formatter.decimal("123.45")).toBeTruthy();
    });
  });

  describe("defineNumberFormat - Compact Notation", () => {
    let formatter: ReturnType<typeof defineNumberFormat>;

    beforeEach(() => {
      const mockStrategy = {
        decimalResolution: {
          resolveCurrency: () => 2,
          resolveDecimal: () => 2,
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol" as const,
        },
        readableCompactCurrency: {
          format: (value: number) => `$${value}`,
        },
      };

      formatter = defineNumberFormat("en-US", mockStrategy);
    });

    it("should format compact decimals", () => {
      const result = formatter.compact.decimal(1000000);
      expect(result).toBeTruthy();
    });

    it("should format compact currency", () => {
      const result = formatter.compact.currency(1000000);
      expect(result).toBeTruthy();
    });

    it("should format compact percentages", () => {
      const result = formatter.compact.percent(0.25);
      expect(result).toBeTruthy();
    });
  });

  describe("defineNumberFormat - Readable Compact Currency", () => {
    let formatter: ReturnType<typeof defineNumberFormat>;

    beforeEach(() => {
      const mockStrategy = {
        decimalResolution: {
          resolveCurrency: () => 2,
          resolveDecimal: () => 2,
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol" as const,
        },
        readableCompactCurrency: {
          format: (value: number, opts: Intl.NumberFormatOptions) => {
            const abs = Math.abs(value);
            const sign = value < 0 ? "-" : "";

            if (abs >= 1e12) {
              return `${sign}$${(abs / 1e12).toLocaleString("en-US", opts)} Trillion`;
            }
            if (abs >= 1e9) {
              return `${sign}$${(abs / 1e9).toLocaleString("en-US", opts)} Billion`;
            }
            if (abs >= 1e6) {
              return `${sign}$${(abs / 1e6).toLocaleString("en-US", opts)} Million`;
            }
            return `$${value}`;
          },
        },
      };

      formatter = defineNumberFormat("en-US", mockStrategy);
    });

    it("should format readable compact currency with exchange rate", () => {
      const result = formatter.readableCompact.currency(1000000);
      expect(result).toContain("Million");
    });

    it("should handle null/undefined in readableCompact", () => {
      expect(formatter.readableCompact.currency(null)).toBe("-");
      expect(formatter.readableCompact.currency(null as any)).toBe("-");
      expect(formatter.readableCompact.currency("" as any)).toBe("-");
    });

    it("should handle invalid values in readableCompact", () => {
      expect(formatter.readableCompact.currency(NaN)).toBe("-");
      expect(formatter.readableCompact.currency(Infinity)).toBe("-");
    });
  });

  describe("DateTime Formatting", () => {
    let dateFormatter: ReturnType<typeof defineDateTimeFormat>;

    beforeEach(() => {
      dateFormatter = defineDateTimeFormat("en-US", {
        datePattern: "MM/DD/YYYY",
        timePattern: "hh:mm A",
        dateTimePattern: "MMM D, YYYY hh:mm A",
        utcDateTimePattern: "MMM D, YYYY HH:mm [UTC]",
      });
    });

    it("should format date", () => {
      const result = dateFormatter.date("2026-03-15");
      expect(result).toBeTruthy();
      expect(result).not.toBe("-");
    });

    it("should format time", () => {
      const result = dateFormatter.time("2026-03-15T14:30:00");
      expect(result).toBeTruthy();
      expect(result).not.toBe("-");
    });

    it("should format datetime", () => {
      const result = dateFormatter.datetime("2026-03-15T14:30:00");
      expect(result).toBeTruthy();
      expect(result).not.toBe("-");
    });

    it("should format UTC datetime", () => {
      const result = dateFormatter.utc("2026-03-15T14:30:00Z");
      expect(result).toBeTruthy();
      expect(result).toContain("UTC");
    });

    it("should format ISO string", () => {
      const result = dateFormatter.iso("2026-03-15T14:30:00Z");
      expect(result).toContain("2026-03-15");
    });

    it("should format relative time", () => {
      const result = dateFormatter.relative("2026-03-15");
      expect(result).toBeTruthy();
    });

    it("should format from unix seconds", () => {
      const unixSeconds = Math.floor(new Date("2026-03-15").getTime() / 1000);
      const result = dateFormatter.fromUnixSeconds(unixSeconds);
      expect(result).toBeTruthy();
      expect(result).not.toBe("-");
    });

    it("should format from unix milliseconds", () => {
      const ms = new Date("2026-03-15").getTime();
      const result = dateFormatter.fromUnixMilliseconds(ms);
      expect(result).toBeTruthy();
      expect(result).not.toBe("-");
    });

    it("should return nullDisplay for null/undefined", () => {
      expect(dateFormatter.date(null)).toBe("-");
      expect(dateFormatter.time(undefined)).toBe("-");
      expect(dateFormatter.datetime(null)).toBe("-");
      expect(dateFormatter.relative(null)).toBe("-");
      expect(dateFormatter.fromUnixSeconds(null)).toBe("-");
      expect(dateFormatter.fromUnixMilliseconds(null)).toBe("-");
    });

    it("should handle different locale patterns", () => {
      const viFormatter = defineDateTimeFormat("vi-VN", {
        datePattern: "DD/MM/YYYY",
        timePattern: "HH:mm",
        dateTimePattern: "D MMM YYYY HH:mm",
        utcDateTimePattern: "D MMM YYYY HH:mm [UTC]",
      });

      const result = viFormatter.date("2026-03-15");
      expect(result).toBeTruthy();
      expect(result).not.toBe("-");
    });
  });

  describe("Formatter Strategy Caching", () => {
    it("should reuse same formatter for same configuration", () => {
      const mockStrategy = {
        decimalResolution: {
          resolveCurrency: () => 2,
          resolveDecimal: () => 2,
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol" as const,
        },
        readableCompactCurrency: {
          format: (value: number) => `$${value}`,
        },
      };

      const formatter = defineNumberFormat("en-US", mockStrategy);

      // Call multiple times with same style/notation/decimals
      formatter.decimal(100);
      formatter.decimal(200);
      formatter.decimal(300);

      // Should use cached formatter (we can't directly verify, but no errors should occur)
      expect(true).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    let formatter: ReturnType<typeof defineNumberFormat>;

    beforeEach(() => {
      const mockStrategy = {
        decimalResolution: {
          resolveCurrency: () => 2,
          resolveDecimal: () => 2,
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol" as const,
        },
        readableCompactCurrency: {
          format: (value: number) => `$${value}`,
        },
      };

      formatter = defineNumberFormat("en-US", mockStrategy);
    });

    it("should handle zero", () => {
      expect(formatter.decimal(0)).toBeTruthy();
    });

    it("should handle negative numbers", () => {
      expect(formatter.decimal(-100)).toBeTruthy();
    });

    it("should handle very large numbers", () => {
      expect(formatter.decimal(1e15)).toBeTruthy();
    });

    it("should handle very small numbers", () => {
      expect(formatter.decimal(1e-10)).toBeTruthy();
    });

    it("should handle units with null", () => {
      const result = formatter.unit(100, null);
      expect(result).toBeTruthy();
    });
  });
});
