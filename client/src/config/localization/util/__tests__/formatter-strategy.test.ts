import { describe, expect, it } from "vitest";
import type {
  CurrencyConfigStrategy,
  DecimalResolutionStrategy,
  NumberFormattingStrategy,
  ReadableCompactCurrencyStrategy,
} from "../formatter-strategy";

describe("Formatter Strategy Interfaces", () => {
  describe("DecimalResolutionStrategy", () => {
    it("should define resolveCurrency method", () => {
      const strategy: DecimalResolutionStrategy = {
        resolveCurrency: (value: number) => 2,
        resolveDecimal: (value: number) => 2,
        resolvePercent: (value: number) => 2,
      };

      expect(typeof strategy.resolveCurrency).toBe("function");
      expect(strategy.resolveCurrency(100)).toBe(2);
    });

    it("should define resolveDecimal method", () => {
      const strategy: DecimalResolutionStrategy = {
        resolveCurrency: (value: number) => 2,
        resolveDecimal: (value: number) => 2,
        resolvePercent: (value: number) => 2,
      };

      expect(typeof strategy.resolveDecimal).toBe("function");
      expect(strategy.resolveDecimal(100)).toBe(2);
    });

    it("should define resolvePercent method", () => {
      const strategy: DecimalResolutionStrategy = {
        resolveCurrency: (value: number) => 2,
        resolveDecimal: (value: number) => 2,
        resolvePercent: (value: number) => 2,
      };

      expect(typeof strategy.resolvePercent).toBe("function");
      expect(strategy.resolvePercent(0.5)).toBe(2);
    });

    it("should support dynamic decimal resolution based on value", () => {
      const strategy: DecimalResolutionStrategy = {
        resolveCurrency: (value: number) => {
          const abs = Math.abs(value);
          if (abs >= 100) return 0;
          if (abs >= 1) return 2;
          return 4;
        },
        resolveDecimal: (value: number) => {
          const abs = Math.abs(value);
          if (abs >= 100) return 0;
          if (abs >= 1) return 2;
          return 4;
        },
        resolvePercent: () => 2,
      };

      expect(strategy.resolveCurrency(1000)).toBe(0);
      expect(strategy.resolveCurrency(50)).toBe(2);
      expect(strategy.resolveCurrency(0.001)).toBe(4);
    });
  });

  describe("CurrencyConfigStrategy", () => {
    it("should define currencyCode method", () => {
      const strategy: CurrencyConfigStrategy = {
        currencyCode: () => "USD",
        currencyDisplay: () => "narrowSymbol",
      };

      expect(typeof strategy.currencyCode).toBe("function");
      expect(strategy.currencyCode()).toBe("USD");
    });

    it("should define currencyDisplay method", () => {
      const strategy: CurrencyConfigStrategy = {
        currencyCode: () => "USD",
        currencyDisplay: () => "narrowSymbol",
      };

      expect(typeof strategy.currencyDisplay).toBe("function");
      expect(strategy.currencyDisplay()).toBe("narrowSymbol");
    });

    it("should support different currency codes", () => {
      const usdStrategy: CurrencyConfigStrategy = {
        currencyCode: () => "USD",
        currencyDisplay: () => "narrowSymbol",
      };

      const vndStrategy: CurrencyConfigStrategy = {
        currencyCode: () => "VND",
        currencyDisplay: () => "narrowSymbol",
      };

      expect(usdStrategy.currencyCode()).toBe("USD");
      expect(vndStrategy.currencyCode()).toBe("VND");
    });

    it("should support different currency display options", () => {
      const displayOptions: Array<"symbol" | "narrowSymbol" | "code" | "name"> =
        ["symbol", "narrowSymbol", "code", "name"];

      for (const display of displayOptions) {
        const strategy: CurrencyConfigStrategy = {
          currencyCode: () => "USD",
          currencyDisplay: () => display,
        };

        expect(strategy.currencyDisplay()).toBe(display);
      }
    });
  });

  describe("ReadableCompactCurrencyStrategy", () => {
    it("should define format method", () => {
      const strategy: ReadableCompactCurrencyStrategy = {
        format: (value: number, opts: Intl.NumberFormatOptions) => `$${value}`,
      };

      expect(typeof strategy.format).toBe("function");
      expect(strategy.format(100, {})).toBe("$100");
    });

    it("should accept Intl.NumberFormatOptions", () => {
      const strategy: ReadableCompactCurrencyStrategy = {
        format: (value: number, opts: Intl.NumberFormatOptions) => {
          const formatted = value.toLocaleString("en-US", opts);
          return `$${formatted}`;
        },
      };

      const result = strategy.format(1000, {
        maximumFractionDigits: 2,
      });
      expect(result).toContain("$");
    });

    it("should support scale abbreviations", () => {
      const strategy: ReadableCompactCurrencyStrategy = {
        format: (value: number, opts: Intl.NumberFormatOptions) => {
          const abs = Math.abs(value);
          if (abs >= 1e12) return `$${(abs / 1e12).toFixed(2)} Trillion`;
          if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)} Billion`;
          if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)} Million`;
          if (abs >= 1e3) return `$${(abs / 1e3).toFixed(2)} Thousand`;
          return `$${value}`;
        },
      };

      expect(strategy.format(1000000000, {})).toContain("Billion");
      expect(strategy.format(1000000, {})).toContain("Million");
      expect(strategy.format(1000, {})).toContain("Thousand");
    });
  });

  describe("NumberFormattingStrategy", () => {
    it("should combine all sub-strategies", () => {
      const strategy: NumberFormattingStrategy = {
        decimalResolution: {
          resolveCurrency: () => 2,
          resolveDecimal: () => 2,
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol",
        },
        readableCompactCurrency: {
          format: (value) => `$${value}`,
        },
      };

      expect(strategy.decimalResolution).toBeDefined();
      expect(strategy.currencyConfig).toBeDefined();
      expect(strategy.readableCompactCurrency).toBeDefined();
    });

    it("should validate complete strategy", () => {
      const completeStrategy: NumberFormattingStrategy = {
        decimalResolution: {
          resolveCurrency: (value: number) => {
            const abs = Math.abs(value);
            if (abs >= 100) return 0;
            if (abs >= 1) return 2;
            return 4;
          },
          resolveDecimal: (value: number) => {
            const abs = Math.abs(value);
            if (abs >= 100) return 0;
            if (abs >= 1) return 2;
            return 4;
          },
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol",
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
            if (abs >= 1e3) {
              return `${sign}$${(abs / 1e3).toLocaleString("en-US", opts)} Thousand`;
            }
            return `$${value}`;
          },
        },
      };

      expect(completeStrategy.decimalResolution.resolveCurrency(1000)).toBe(0);
      expect(completeStrategy.currencyConfig.currencyCode()).toBe("USD");
      expect(
        completeStrategy.readableCompactCurrency.format(1e9, {}),
      ).toContain("Billion");
    });
  });

  describe("Strategy Flexibility", () => {
    it("should allow different strategy implementations", () => {
      // Strategy 1: Simple fixed decimals
      const simpleStrategy: NumberFormattingStrategy = {
        decimalResolution: {
          resolveCurrency: () => 2,
          resolveDecimal: () => 2,
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol",
        },
        readableCompactCurrency: {
          format: (value) => `$${value}`,
        },
      };

      // Strategy 2: Dynamic decimals
      const dynamicStrategy: NumberFormattingStrategy = {
        decimalResolution: {
          resolveCurrency: (value: number) => {
            const frac = Math.abs(value) % 1;
            if (frac >= 0.01) return 4;
            if (frac >= 0.0001) return 6;
            return 8;
          },
          resolveDecimal: (value: number) => {
            const frac = Math.abs(value) % 1;
            if (frac >= 0.01) return 4;
            if (frac >= 0.0001) return 6;
            return 8;
          },
          resolvePercent: () => 4,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "code",
        },
        readableCompactCurrency: {
          format: (value) => `USD ${value}`,
        },
      };

      expect(simpleStrategy.decimalResolution.resolveCurrency(0.5)).toBe(2);
      expect(
        dynamicStrategy.decimalResolution.resolveCurrency(0.5),
      ).toBeGreaterThan(2);
    });
  });

  describe("Multi-locale Strategies", () => {
    it("should support English locale strategy", () => {
      const enStrategy: NumberFormattingStrategy = {
        decimalResolution: {
          resolveCurrency: (value: number) => {
            const frac = Math.abs(value) % 1;
            if (frac >= 0.01) return 4;
            if (frac >= 0.0001) return 6;
            return 8;
          },
          resolveDecimal: (value: number) => {
            const frac = Math.abs(value) % 1;
            if (frac >= 0.01) return 4;
            if (frac >= 0.0001) return 6;
            return 8;
          },
          resolvePercent: () => 4,
        },
        currencyConfig: {
          currencyCode: () => "USD",
          currencyDisplay: () => "narrowSymbol",
        },
        readableCompactCurrency: {
          format: (value: number) => {
            const abs = Math.abs(value);
            if (abs >= 1e12) return `$${(abs / 1e12).toFixed(2)} Trillion`;
            if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)} Billion`;
            if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)} Million`;
            if (abs >= 1e3) return `$${(abs / 1e3).toFixed(2)} Thousand`;
            return `$${value}`;
          },
        },
      };

      expect(enStrategy.currencyConfig.currencyCode()).toBe("USD");
    });

    it("should support Vietnamese locale strategy", () => {
      const viStrategy: NumberFormattingStrategy = {
        decimalResolution: {
          resolveCurrency: (value: number) => {
            const abs = Math.abs(value);
            if (abs >= 100) return 0;
            if (abs >= 1) return 2;
            return 4;
          },
          resolveDecimal: (value: number) => {
            const abs = Math.abs(value);
            if (abs >= 100) return 0;
            if (abs >= 1) return 2;
            return 4;
          },
          resolvePercent: () => 2,
        },
        currencyConfig: {
          currencyCode: () => "VND",
          currencyDisplay: () => "narrowSymbol",
        },
        readableCompactCurrency: {
          format: (value: number) => {
            const abs = Math.abs(value);
            const sign = value < 0 ? "-" : "";
            if (abs >= 1e12)
              return `${sign}${(abs / 1e12).toFixed(2)} nghìn tỷ đồng`;
            if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} tỷ đồng`;
            if (abs >= 1e6)
              return `${sign}${(abs / 1e6).toFixed(2)} triệu đồng`;
            if (abs >= 1e3)
              return `${sign}${(abs / 1e3).toFixed(2)} nghìn đồng`;
            return `${value} đồng`;
          },
        },
      };

      expect(viStrategy.currencyConfig.currencyCode()).toBe("VND");
    });
  });
});
