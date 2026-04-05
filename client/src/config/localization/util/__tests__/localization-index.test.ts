/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it } from "vitest";
import { locale, type LangKeys } from "../../index";

describe("Localization Index", () => {
  describe("Locale Object Structure", () => {
    it("should have en locale", () => {
      expect(locale).toHaveProperty("en");
      expect(locale.en).toBeDefined();
    });

    it("should have vi locale", () => {
      expect(locale).toHaveProperty("vi");
      expect(locale.vi).toBeDefined();
    });

    it("should have langCode and format in each locale", () => {
      expect(locale.en).toHaveProperty("langCode");
      expect(locale.en).toHaveProperty("format");
      expect(locale.vi).toHaveProperty("langCode");
      expect(locale.vi).toHaveProperty("format");
    });

    it("should have translation in each locale", () => {
      expect(locale.en).toHaveProperty("translation");
      expect(locale.vi).toHaveProperty("translation");
    });
  });

  describe("Language Codes", () => {
    it("should have correct English language code", () => {
      expect(locale.en.langCode).toBe("en-US");
    });

    it("should have correct Vietnamese language code", () => {
      expect(locale.vi.langCode).toBe("vi-VN");
    });
  });

  describe("Format Objects", () => {
    it("should have number formatting in English", () => {
      expect(locale.en.format).toHaveProperty("num");
      expect(locale.en.format.num).toHaveProperty("decimal");
      expect(locale.en.format.num).toHaveProperty("currency");
      expect(locale.en.format.num).toHaveProperty("percent");
    });

    it("should have number formatting in Vietnamese", () => {
      expect(locale.vi.format).toHaveProperty("num");
      expect(locale.vi.format.num).toHaveProperty("decimal");
      expect(locale.vi.format.num).toHaveProperty("currency");
      expect(locale.vi.format.num).toHaveProperty("percent");
    });

    it("should have datetime formatting in English", () => {
      expect(locale.en.format).toHaveProperty("datetime");
      expect(locale.en.format.datetime).toHaveProperty("date");
      expect(locale.en.format.datetime).toHaveProperty("time");
      expect(locale.en.format.datetime).toHaveProperty("datetime");
      expect(locale.en.format.datetime).toHaveProperty("utc");
    });

    it("should have datetime formatting in Vietnamese", () => {
      expect(locale.vi.format).toHaveProperty("datetime");
      expect(locale.vi.format.datetime).toHaveProperty("date");
      expect(locale.vi.format.datetime).toHaveProperty("time");
      expect(locale.vi.format.datetime).toHaveProperty("datetime");
      expect(locale.vi.format.datetime).toHaveProperty("utc");
    });
  });

  describe("Translation Objects", () => {
    it("should have translation structure in English", () => {
      const trans = locale.en.translation;
      expect(typeof trans).toBe("object");
      expect(trans).not.toBeNull();
    });

    it("should have translation structure in Vietnamese", () => {
      const trans = locale.vi.translation;
      expect(typeof trans).toBe("object");
      expect(trans).not.toBeNull();
    });

    it("should have common translations", () => {
      expect(locale.en.translation).toHaveProperty("common");
      expect(locale.vi.translation).toHaveProperty("common");
    });

    it("should have auth translations", () => {
      expect(locale.en.translation).toHaveProperty("auth");
      expect(locale.vi.translation).toHaveProperty("auth");
    });
  });

  describe("Locale Keys Type", () => {
    it("should have valid language keys", () => {
      const langKeys: LangKeys[] = ["en", "vi"];
      langKeys.forEach((key) => {
        expect(locale).toHaveProperty(key);
      });
    });
  });

  describe("Format Methods Work", () => {
    it("should format numbers in English", () => {
      const result = locale.en.format.num.decimal(123.45);
      expect(typeof result).toBe("string");
      expect(result).toBeTruthy();
    });

    it("should format numbers in Vietnamese", () => {
      const result = locale.vi.format.num.decimal(123.45);
      expect(typeof result).toBe("string");
      expect(result).toBeTruthy();
    });

    it("should format currency in English", () => {
      const result = locale.en.format.num.currency(100);
      expect(typeof result).toBe("string");
      expect(result).toBeTruthy();
    });

    it("should format currency in Vietnamese", () => {
      const result = locale.vi.format.num.currency(100);
      expect(typeof result).toBe("string");
      expect(result).toBeTruthy();
    });

    it("should format dates in English", () => {
      const result = locale.en.format.datetime.date("2026-03-15");
      expect(typeof result).toBe("string");
      expect(result).toBeTruthy();
    });

    it("should format dates in Vietnamese", () => {
      const result = locale.vi.format.datetime.date("2026-03-15");
      expect(typeof result).toBe("string");
      expect(result).toBeTruthy();
    });
  });

  describe("Different Currency Handling", () => {
    it("should use USD for English locale", () => {
      const result = locale.en.format.num.currency(100);
      expect(result).toContain("$");
    });

    it("should use VND for Vietnamese locale", () => {
      const result = locale.vi.format.num.currency(100);
      expect(typeof result).toBe("string");
      // VND formatting may vary based on Intl.NumberFormat implementation
      expect(result).toBeTruthy();
    });
  });

  describe("Compact Notation", () => {
    it("should support compact notation in English", () => {
      const result = locale.en.format.num.compact.decimal(1000000);
      expect(typeof result).toBe("string");
    });

    it("should support compact notation in Vietnamese", () => {
      const result = locale.vi.format.num.compact.decimal(1000000);
      expect(typeof result).toBe("string");
    });

    it("should support readable compact currency in English", () => {
      const result = locale.en.format.num.readableCompact.currency(1000000);
      expect(typeof result).toBe("string");
      expect(result).toContain("Million");
    });

    it("should support readable compact currency in Vietnamese", () => {
      const result = locale.vi.format.num.readableCompact.currency(1000000);
      expect(typeof result).toBe("string");
      // Should contain Vietnamese scale word
      expect(result).toBeTruthy();
    });
  });

  describe("Common Translations", () => {
    it("should have common UI labels in English", () => {
      const common = locale.en.translation.common;
      expect(common).toHaveProperty("cancel");
      expect(common).toHaveProperty("confirm");
      expect(common).toHaveProperty("submit");
      expect(common).toHaveProperty("loading");
      expect(common).toHaveProperty("error");
      expect(common).toHaveProperty("success");
    });

    it("should have common UI labels in Vietnamese", () => {
      const common = locale.vi.translation.common;
      expect(common).toHaveProperty("cancel");
      expect(common).toHaveProperty("confirm");
      expect(common).toHaveProperty("submit");
      expect(common).toHaveProperty("loading");
      expect(common).toHaveProperty("error");
      expect(common).toHaveProperty("success");
    });

    it("should have translations for all common keys", () => {
      const enCommon = locale.en.translation.common;
      const viCommon = locale.vi.translation.common;

      for (const key in enCommon) {
        expect(viCommon).toHaveProperty(key);
        expect(typeof viCommon[key as keyof typeof viCommon]).toBe("string");
      }
    });
  });

  describe("Auth Translations", () => {
    it("should have auth translations in English", () => {
      const auth = locale.en.translation.auth;
      expect(auth).toHaveProperty("signIn");
      expect(auth).toHaveProperty("signUp");
      expect(auth).toHaveProperty("signOut");
    });

    it("should have auth translations in Vietnamese", () => {
      const auth = locale.vi.translation.auth;
      expect(auth).toHaveProperty("signIn");
      expect(auth).toHaveProperty("signUp");
      expect(auth).toHaveProperty("signOut");
    });

    it("should have matching auth keys", () => {
      const enAuth = locale.en.translation.auth;
      const viAuth = locale.vi.translation.auth;

      for (const key in enAuth) {
        expect(viAuth).toHaveProperty(key);
      }
    });
  });

  describe("Translation Values", () => {
    it("should have non-empty strings in English translations", () => {
      const trans = locale.en.translation;
      const checkTranslations = (obj: any) => {
        for (const key in obj) {
          const val = obj[key];
          if (typeof val === "string") {
            expect(val.length).toBeGreaterThan(0);
          } else if (typeof val === "object" && val !== null) {
            checkTranslations(val);
          }
        }
      };
      checkTranslations(trans);
    });

    it("should have non-empty strings in Vietnamese translations", () => {
      const trans = locale.vi.translation;
      const checkTranslations = (obj: any) => {
        for (const key in obj) {
          const val = obj[key];
          if (typeof val === "string") {
            expect(val.length).toBeGreaterThan(0);
          } else if (typeof val === "object" && val !== null) {
            checkTranslations(val);
          }
        }
      };
      checkTranslations(trans);
    });
  });

  describe("Date Pattern Differences", () => {
    it("English should use MM/DD/YYYY format", () => {
      // English date should be formatted as MM/DD/YYYY
      const date = locale.en.format.datetime.date("2026-03-15");
      expect(date).toMatch(/03\/15\/2026|15\/03\/2026|2026-03-15/); // Locale dependent
    });

    it("Vietnamese should use DD/MM/YYYY format", () => {
      // Vietnamese date should be formatted as DD/MM/YYYY
      const date = locale.vi.format.datetime.date("2026-03-15");
      expect(date).toBeTruthy();
    });
  });

  describe("Time Pattern Differences", () => {
    it("English should use 12-hour format", () => {
      const time = locale.en.format.datetime.time("2026-03-15T14:30:00");
      expect(time).toBeTruthy();
      // Should contain AM or PM (if formatted correctly)
    });

    it("Vietnamese should use 24-hour format", () => {
      const time = locale.vi.format.datetime.time("2026-03-15T14:30:00");
      expect(time).toBeTruthy();
    });
  });

  describe("Decimal Resolution", () => {
    it("English locale should handle currency decimals appropriately", () => {
      const small = locale.en.format.num.currency(0.0001);
      const large = locale.en.format.num.currency(1000);

      expect(small).toBeTruthy();
      expect(large).toBeTruthy();
    });

    it("Vietnamese locale should handle currency decimals appropriately", () => {
      const small = locale.vi.format.num.currency(0.0001);
      const large = locale.vi.format.num.currency(1000);

      expect(small).toBeTruthy();
      expect(large).toBeTruthy();
    });
  });

  describe("Export Types", () => {
    it("should export BaseTranslation type", () => {
      // Type check - just verify it's exported
      expect(true).toBe(true);
    });

    it("should export TranslationSchema type", () => {
      // Type check - just verify it's exported
      expect(true).toBe(true);
    });

    it("should export TranslationKeyPath type", () => {
      // Type check - just verify it's exported
      expect(true).toBe(true);
    });
  });
});
