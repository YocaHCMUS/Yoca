import { useLocalization } from "@/contexts/LocalizationContext";
import type { PersonaExplanation, RiskFactorExplanation, Severity } from "./types";
import { formatPercent } from "./utils";

function fallbackTitle(value: string): string {
  return String(value || "Unknown")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function useAiAnalysisI18n() {
  const { tr, fmt, lang } = useLocalization();
  const numberLocale = lang === "vi" ? "vi-VN" : "en-US";
  const formatCount = (value: number): string => new Intl.NumberFormat(numberLocale).format(value);
  const s = <T,>(value: T): string => String(value ?? "");

  const labelForCode = (code: string | null | undefined): string => {
    switch (String(code ?? "UNKNOWN").toUpperCase()) {
      case "LOW":
        return s(tr("aiAnalysisDashboard.labels.low"));
      case "MEDIUM":
      case "MODERATE":
        return s(tr("aiAnalysisDashboard.labels.medium"));
      case "HIGH":
        return s(tr("aiAnalysisDashboard.labels.high"));
      case "CRITICAL":
        return s(tr("aiAnalysisDashboard.labels.critical"));
      case "NEUTRAL":
        return s(tr("aiAnalysisDashboard.labels.neutral"));
      case "HIGH_RISK_SPECULATOR":
        return s(tr("aiAnalysisDashboard.labels.highRiskSpeculator"));
      case "BOT_LIKE_TRADER":
        return s(tr("aiAnalysisDashboard.labels.botLikeTrader"));
      case "DEFI_TRADER":
        return s(tr("aiAnalysisDashboard.labels.defiTrader"));
      case "MEMECOIN_TRADER":
        return s(tr("aiAnalysisDashboard.labels.memecoinTrader"));
      case "SMART_MONEY_LIKE":
        return s(tr("aiAnalysisDashboard.labels.smartMoneyLike"));
      case "WASH_TRADING_SUSPECT":
        return s(tr("aiAnalysisDashboard.labels.washTradingSuspect"));
      case "LONG_TERM_HOLDER":
        return s(tr("aiAnalysisDashboard.labels.longTermHolder"));
      case "CASUAL_USER":
        return s(tr("aiAnalysisDashboard.labels.casualUser"));
      case "AIRDROP_FARMER":
        return s(tr("aiAnalysisDashboard.labels.airdropFarmer"));
      case "NFT_COLLECTOR":
        return s(tr("aiAnalysisDashboard.labels.nftCollector"));
      case "HIGH_FREQUENCY_ACTIVITY":
        return s(tr("aiAnalysisDashboard.labels.highFrequencyActivity"));
      case "SHORT_HOLDING_PERIOD":
        return s(tr("aiAnalysisDashboard.labels.shortHoldingPeriod"));
      case "NEGATIVE_PNL":
        return s(tr("aiAnalysisDashboard.labels.negativePnl"));
      case "LOW_WIN_RATE":
        return s(tr("aiAnalysisDashboard.labels.lowWinRate"));
      case "HIGH_TOKEN_DIVERSITY":
        return s(tr("aiAnalysisDashboard.labels.highTokenDiversity"));
      case "HIGH_PORTFOLIO_CONCENTRATION":
        return s(tr("aiAnalysisDashboard.labels.highPortfolioConcentration"));
      case "WASH_TRADING_SUSPECTED":
        return s(tr("aiAnalysisDashboard.labels.washTradingSuspected"));
      case "MISSING_DATA":
        return s(tr("aiAnalysisDashboard.labels.missingData"));
      case "UNKNOWN":
      case "":
        return s(tr("aiAnalysisDashboard.labels.unknown"));
      default:
        return fallbackTitle(String(code));
    }
  };

  const personaExplanation = (persona: string | null | undefined): PersonaExplanation => {
    const label = labelForCode(persona);
    switch (String(persona ?? "UNKNOWN").toUpperCase()) {
      case "LONG_TERM_HOLDER":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.longTermHolder.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.longTermHolder.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.longTermHolder.caution")),
        };
      case "CASUAL_USER":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.casualUser.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.casualUser.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.casualUser.caution")),
        };
      case "DEFI_TRADER":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.defiTrader.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.defiTrader.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.defiTrader.caution")),
        };
      case "MEMECOIN_TRADER":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.memecoinTrader.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.memecoinTrader.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.memecoinTrader.caution")),
        };
      case "NFT_COLLECTOR":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.nftCollector.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.nftCollector.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.nftCollector.caution")),
        };
      case "AIRDROP_FARMER":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.airdropFarmer.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.airdropFarmer.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.airdropFarmer.caution")),
        };
      case "BOT_LIKE_TRADER":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.botLikeTrader.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.botLikeTrader.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.botLikeTrader.caution")),
        };
      case "HIGH_RISK_SPECULATOR":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.highRiskSpeculator.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.highRiskSpeculator.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.highRiskSpeculator.caution")),
        };
      case "SMART_MONEY_LIKE":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.smartMoneyLike.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.smartMoneyLike.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.smartMoneyLike.caution")),
        };
      case "WASH_TRADING_SUSPECT":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.washTradingSuspect.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.washTradingSuspect.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.washTradingSuspect.caution")),
        };
      default:
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.personaExplanations.unknown.meaning")),
          commonSignals: s(tr("aiAnalysisDashboard.personaExplanations.unknown.commonSignals")),
          caution: s(tr("aiAnalysisDashboard.personaExplanations.unknown.caution")),
        };
    }
  };

  const riskFactorExplanation = (code: string | null | undefined): RiskFactorExplanation => {
    const label = labelForCode(code);
    switch (String(code ?? "").toUpperCase()) {
      case "HIGH_FREQUENCY_ACTIVITY":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.riskFactorExplanations.highFrequencyActivity.meaning")),
          whyItMatters: s(tr("aiAnalysisDashboard.riskFactorExplanations.highFrequencyActivity.whyItMatters")),
        };
      case "SHORT_HOLDING_PERIOD":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.riskFactorExplanations.shortHoldingPeriod.meaning")),
          whyItMatters: s(tr("aiAnalysisDashboard.riskFactorExplanations.shortHoldingPeriod.whyItMatters")),
        };
      case "NEGATIVE_PNL":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.riskFactorExplanations.negativePnl.meaning")),
          whyItMatters: s(tr("aiAnalysisDashboard.riskFactorExplanations.negativePnl.whyItMatters")),
        };
      case "LOW_WIN_RATE":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.riskFactorExplanations.lowWinRate.meaning")),
          whyItMatters: s(tr("aiAnalysisDashboard.riskFactorExplanations.lowWinRate.whyItMatters")),
        };
      case "HIGH_TOKEN_DIVERSITY":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.riskFactorExplanations.highTokenDiversity.meaning")),
          whyItMatters: s(tr("aiAnalysisDashboard.riskFactorExplanations.highTokenDiversity.whyItMatters")),
        };
      case "HIGH_PORTFOLIO_CONCENTRATION":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.riskFactorExplanations.highPortfolioConcentration.meaning")),
          whyItMatters: s(tr("aiAnalysisDashboard.riskFactorExplanations.highPortfolioConcentration.whyItMatters")),
        };
      case "WASH_TRADING_SUSPECTED":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.riskFactorExplanations.washTradingSuspected.meaning")),
          whyItMatters: s(tr("aiAnalysisDashboard.riskFactorExplanations.washTradingSuspected.whyItMatters")),
        };
      case "MISSING_DATA":
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.riskFactorExplanations.missingData.meaning")),
          whyItMatters: s(tr("aiAnalysisDashboard.riskFactorExplanations.missingData.whyItMatters")),
        };
      default:
        return {
          label,
          meaning: s(tr("aiAnalysisDashboard.riskFactorExplanations.fallbackMeaning")),
          whyItMatters: s(tr("aiAnalysisDashboard.riskFactorExplanations.fallbackWhy")),
        };
    }
  };

  const severityLabel = (severity: Severity): string => labelForCode(String(severity ?? "UNKNOWN"));

  const severityTooltip = (severity: Severity, context: "finding" | "risk" = "finding"): string => {
    const normalized = String(severity ?? "").toUpperCase();
    if (context === "risk") {
      if (normalized === "HIGH") return s(tr("aiAnalysisDashboard.severityTooltips.riskHigh"));
      if (normalized === "MEDIUM") return s(tr("aiAnalysisDashboard.severityTooltips.riskMedium"));
      if (normalized === "LOW") return s(tr("aiAnalysisDashboard.severityTooltips.riskLow"));
      return s(tr("aiAnalysisDashboard.severityTooltips.riskNeutral"));
    }

    if (normalized === "HIGH") return s(tr("aiAnalysisDashboard.severityTooltips.findingHigh"));
    if (normalized === "MEDIUM") return s(tr("aiAnalysisDashboard.severityTooltips.findingMedium"));
    if (normalized === "LOW") return s(tr("aiAnalysisDashboard.severityTooltips.findingLow"));
    return s(tr("aiAnalysisDashboard.severityTooltips.findingNeutral"));
  };

  const normalizeUserText = (text: string | null | undefined): string => {
    if (!text) return "";
    const rawText = String(text).trim();
    const normalizedKnownNote = rawText.toLowerCase();
    if (
      normalizedKnownNote ===
      "risk score reflects observed behavior in the analyzed transaction window. it is not a legal, financial, or fraud verdict."
      || normalizedKnownNote ===
      "risk score reflects observed behavior in the analyzed transaction window. it is not a legal, financial, or suspicious behavior verdict."
    ) {
      return s(tr("aiAnalysisDashboard.caution.backendRiskVerdict"));
    }
    if (
      normalizedKnownNote ===
      "do not claim this analysis represents the wallet's full history unless the analysis window is full_history."
    ) {
      return s(tr("aiAnalysisDashboard.caution.backendFullHistory"));
    }
    if (
      normalizedKnownNote === "do not claim confirmed fraud or wash trading."
      || normalizedKnownNote === "do not claim confirmed suspicious behavior or wash trading."
    ) {
      return s(tr("aiAnalysisDashboard.caution.backendNoConfirmedSuspicious"));
    }
    if (normalizedKnownNote === "do not infer intent beyond the computed metrics.") {
      return s(tr("aiAnalysisDashboard.caution.backendNoIntent"));
    }

    return rawText
      .replace(/\bBOT_LIKE_TRADER\b/g, labelForCode("BOT_LIKE_TRADER"))
      .replace(/\bHIGH_RISK_SPECULATOR\b/g, labelForCode("HIGH_RISK_SPECULATOR"))
      .replace(/\bDEFI_TRADER\b/g, labelForCode("DEFI_TRADER"))
      .replace(/\bMEMECOIN_TRADER\b/g, labelForCode("MEMECOIN_TRADER"))
      .replace(/\bSMART_MONEY_LIKE\b/g, labelForCode("SMART_MONEY_LIKE"))
      .replace(/\bWASH_TRADING_SUSPECT\b/g, labelForCode("WASH_TRADING_SUSPECT"))
      .replace(/\bLONG_TERM_HOLDER\b/g, labelForCode("LONG_TERM_HOLDER"))
      .replace(/\bCASUAL_USER\b/g, labelForCode("CASUAL_USER"))
      .replace(/\bAIRDROP_FARMER\b/g, labelForCode("AIRDROP_FARMER"))
      .replace(/\bNFT_COLLECTOR\b/g, labelForCode("NFT_COLLECTOR"))
      .replace(/\bHIGH_FREQUENCY_ACTIVITY\b/g, labelForCode("HIGH_FREQUENCY_ACTIVITY"))
      .replace(/\bSHORT_HOLDING_PERIOD\b/g, labelForCode("SHORT_HOLDING_PERIOD"))
      .replace(/\bNEGATIVE_PNL\b/g, labelForCode("NEGATIVE_PNL"))
      .replace(/\bLOW_WIN_RATE\b/g, labelForCode("LOW_WIN_RATE"))
      .replace(/\bHIGH_TOKEN_DIVERSITY\b/g, labelForCode("HIGH_TOKEN_DIVERSITY"))
      .replace(/\bHIGH_PORTFOLIO_CONCENTRATION\b/g, labelForCode("HIGH_PORTFOLIO_CONCENTRATION"))
      .replace(/\bWASH_TRADING_SUSPECTED\b/g, labelForCode("WASH_TRADING_SUSPECTED"))
      .replace(/\bMISSING_DATA\b/g, labelForCode("MISSING_DATA"))
      .replace(/\bbot\b(?!-like)/gi, "bot-like")
      .replace(/\bmanipulation\b/gi, "potentially suspicious market behavior")
      .replace(/\bfraud\b/gi, "suspicious behavior")
      .replace(/\bscammer\b/gi, "suspicious wallet");
  };

  const dataCompletenessText = (profile: any): string => {
    const completeness = formatPercent(profile?.dataQuality?.completenessScore);
    const unsupported = Number(profile?.dataQuality?.unsupportedTransactionCount ?? 0);
    const missingPrices = Number(profile?.dataQuality?.missingPriceCount ?? 0);
    const txCount = Number(profile?.analysisWindow?.actualTransactionCount ?? profile?.analysisWindow?.transactionLimit ?? 0);
    const usability = Number(profile?.dataQuality?.completenessScore ?? 0) >= 70
      ? s(tr("aiAnalysisDashboard.dataCompleteness.most"))
      : s(tr("aiAnalysisDashboard.dataCompleteness.some"));
    const parts = [
      s(tr("aiAnalysisDashboard.dataCompleteness.summary", { completeness, usability })),
    ];
    if (txCount > 0 && unsupported > 0) {
      parts.push(s(tr("aiAnalysisDashboard.dataCompleteness.unsupported", {
        unsupported: formatCount(unsupported),
        txTotal: formatCount(txCount),
      })));
    }
    if (missingPrices > 0) {
      parts.push(s(tr("aiAnalysisDashboard.dataCompleteness.missingPrices", {
        count: missingPrices,
      })));
    }
    if (unsupported === 0 && missingPrices === 0) {
      parts.push(s(tr("aiAnalysisDashboard.dataCompleteness.none")));
    }
    return parts.join(" ");
  };

  const riskLevelExplanation = (
    riskScore: number | null | undefined,
    txCount: number | null | undefined,
  ): string => {
    if (Number(txCount ?? 0) < 10) {
      return s(tr("aiAnalysisDashboard.riskLevelExplanation.unknown"));
    }
    return s(tr("aiAnalysisDashboard.riskLevelExplanation.known", {
      score: riskScore == null ? "-" : String(riskScore),
    }));
  };

  return {
    tr,
    fmt,
    formatCount,
    labelForCode,
    personaExplanation,
    riskFactorExplanation,
    severityLabel,
    severityTooltip,
    normalizeUserText,
    dataCompletenessText,
    riskLevelExplanation,
  };
}
