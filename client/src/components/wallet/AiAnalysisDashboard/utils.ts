import type { EvidenceLike, PersonaExplanation, RiskFactorExplanation, Severity } from "./types";

export function truncateMiddle(value: string, start = 6, end = 4): string {
  if (!value) return value;
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  const numeric = Number(value);
  const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percent)}%`;
}

export function formatRiskCode(code: string): string {
  const normalized = String(code || "Unknown").toUpperCase();
  const knownLabels: Record<string, string> = {
    HIGH_RISK_SPECULATOR: "High Risk Speculator",
    BOT_LIKE_TRADER: "Bot-like Trader",
    DEFI_TRADER: "DeFi Trader",
    MEMECOIN_TRADER: "Memecoin Trader",
    SMART_MONEY_LIKE: "Smart Money-like",
    WASH_TRADING_SUSPECT: "Wash Trading Suspect",
    LONG_TERM_HOLDER: "Long-term Holder",
    CASUAL_USER: "Casual User",
    AIRDROP_FARMER: "Airdrop Farmer",
    NFT_COLLECTOR: "NFT Collector",
    HIGH_FREQUENCY_ACTIVITY: "High Frequency Activity",
    SHORT_HOLDING_PERIOD: "Short Holding Period",
    NEGATIVE_PNL: "Negative PnL",
    LOW_WIN_RATE: "Low Win Rate",
    HIGH_TOKEN_DIVERSITY: "High Token Diversity",
    HIGH_PORTFOLIO_CONCENTRATION: "High Portfolio Concentration",
    WASH_TRADING_SUSPECTED: "Wash Trading Suspected",
    MISSING_DATA: "Missing Data",
  };
  if (knownLabels[normalized]) return knownLabels[normalized];

  return normalized
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return formatRiskCode(value);
}

export function getSeverityClass(severity: Severity): "high" | "medium" | "low" | "neutral" {
  const normalized = String(severity ?? "").toUpperCase();
  if (normalized === "HIGH") return "high";
  if (normalized === "MEDIUM") return "medium";
  if (normalized === "LOW") return "low";
  return "neutral";
}

export function getRiskLevelClass(riskLevel: string | null | undefined): "high" | "medium" | "low" | "neutral" {
  const normalized = String(riskLevel ?? "").toUpperCase();
  if (normalized === "HIGH" || normalized === "CRITICAL") return "high";
  if (normalized === "MEDIUM" || normalized === "MODERATE") return "medium";
  if (normalized === "LOW") return "low";
  return "neutral";
}

export function normalizeRiskLanguage(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/\bBOT_LIKE_TRADER\b/g, "Bot-like Trader")
    .replace(/\bHIGH_RISK_SPECULATOR\b/g, "High Risk Speculator")
    .replace(/\bDEFI_TRADER\b/g, "DeFi Trader")
    .replace(/\bMEMECOIN_TRADER\b/g, "Memecoin Trader")
    .replace(/\bSMART_MONEY_LIKE\b/g, "Smart Money-like")
    .replace(/\bWASH_TRADING_SUSPECT\b/g, "Wash Trading Suspect")
    .replace(/\bLONG_TERM_HOLDER\b/g, "Long-term Holder")
    .replace(/\bCASUAL_USER\b/g, "Casual User")
    .replace(/\bAIRDROP_FARMER\b/g, "Airdrop Farmer")
    .replace(/\bNFT_COLLECTOR\b/g, "NFT Collector")
    .replace(/\bHIGH_FREQUENCY_ACTIVITY\b/g, "High Frequency Activity")
    .replace(/\bSHORT_HOLDING_PERIOD\b/g, "Short Holding Period")
    .replace(/\bNEGATIVE_PNL\b/g, "Negative PnL")
    .replace(/\bLOW_WIN_RATE\b/g, "Low Win Rate")
    .replace(/\bHIGH_TOKEN_DIVERSITY\b/g, "High Token Diversity")
    .replace(/\bHIGH_PORTFOLIO_CONCENTRATION\b/g, "High Portfolio Concentration")
    .replace(/\bWASH_TRADING_SUSPECTED\b/g, "Wash Trading Suspected")
    .replace(/\bMISSING_DATA\b/g, "Missing Data")
    .replace(/\bbot\b(?!-like)/gi, "bot-like")
    .replace(/\bmanipulation\b/gi, "potentially suspicious market behavior")
    .replace(/\bfraud\b/gi, "suspicious behavior")
    .replace(/\bscammer\b/gi, "suspicious wallet");
}

export function getEvidenceId(evidence: EvidenceLike): string {
  return evidence.evidenceId ?? evidence.id ?? "evidence";
}

export function formatMetricValue(value: unknown): string {
  if (value == null || value === "") return "-";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  return String(value);
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

export function getSeverityTooltip(severity: Severity, context: "finding" | "risk" = "finding"): string {
  const normalized = String(severity ?? "").toUpperCase();
  if (context === "risk") {
    if (normalized === "HIGH") return "High severity means this factor adds 15 or more points to the Risk Score.";
    if (normalized === "MEDIUM") return "Medium severity means this factor adds 8 to 14 points to the Risk Score.";
    if (normalized === "LOW") return "Low severity means this factor adds 1 to 7 points to the Risk Score.";
    return "Severity is based on how many risk points this factor adds.";
  }

  if (normalized === "HIGH") return "Strong signal. Review this first. It is not proof of wrongdoing.";
  if (normalized === "MEDIUM") return "Meaningful signal that contributes to the interpretation.";
  if (normalized === "LOW") return "Contextual signal that is useful but not decisive alone.";
  return "Severity indicates how important this signal is in the current analysis.";
}

export const PERSONA_EXPLANATIONS: Record<string, PersonaExplanation> = {
  UNKNOWN: {
    label: "Unknown",
    meaning: "There is not enough clear behavior to assign a specific persona.",
    commonSignals: "Low transaction count, incomplete data, or mixed signals.",
    caution: "Unknown should not be interpreted as safe or risky by itself.",
  },
  LONG_TERM_HOLDER: {
    label: "Long-term Holder",
    meaning: "Wallet behavior resembles holding assets for longer periods.",
    commonSignals: "Low swap count, longer holding periods, low short-term trade ratio, concentrated holdings.",
    caution: "This describes observed behavior in the analyzed window only.",
  },
  CASUAL_USER: {
    label: "Casual User",
    meaning: "Wallet behavior resembles occasional, lower-intensity usage.",
    commonSignals: "Low or medium activity, fewer swaps, limited token diversity, few closed positions.",
    caution: "A casual label does not guarantee low risk outside the analyzed window.",
  },
  DEFI_TRADER: {
    label: "DeFi Trader",
    meaning: "Wallet frequently interacts with decentralized trading protocols.",
    commonSignals: "Many swaps, high DEX usage, multiple traded tokens, meaningful trading volume.",
    caution: "This label describes protocol usage and trading behavior, not trading skill.",
  },
  MEMECOIN_TRADER: {
    label: "Memecoin Trader",
    meaning: "Wallet behavior resembles speculative trading across volatile or narrative-driven tokens.",
    commonSignals: "High token diversity, short-term trades, heavy DEX usage, smaller average trade sizes.",
    caution: "Token category metadata may be incomplete, so this can rely on behavior proxies.",
  },
  NFT_COLLECTOR: {
    label: "NFT Collector",
    meaning: "Wallet behavior includes meaningful NFT-related activity.",
    commonSignals: "NFT holdings, NFT marketplace usage, repeated NFT transfer, purchase, or sale events.",
    caution: "NFT activity can be incomplete if marketplace or collection metadata is missing.",
  },
  AIRDROP_FARMER: {
    label: "Airdrop Farmer",
    meaning: "Wallet behavior resembles activity aimed at receiving or claiming token distributions.",
    commonSignals: "Repeated airdrop claims, many inbound token transfers, broad token coverage, burst activity.",
    caution: "This does not prove intent; it describes claim-like behavior.",
  },
  BOT_LIKE_TRADER: {
    label: "Bot-like Trader",
    meaning: "Wallet activity resembles automated or high-intensity trading behavior.",
    commonSignals: "Dense transaction bursts, short transaction gaps, high swap count, extreme activity level.",
    caution: "This does not prove the wallet is operated by a bot.",
  },
  HIGH_RISK_SPECULATOR: {
    label: "High Risk Speculator",
    meaning: "Wallet behavior resembles aggressive speculative trading.",
    commonSignals: "Short holding periods, high token diversity, low win rate, negative PnL, heavy DEX usage.",
    caution: "This describes behavior, not identity or intent.",
  },
  SMART_MONEY_LIKE: {
    label: "Smart Money-like",
    meaning: "Wallet shows stronger trading outcomes in the analyzed window.",
    commonSignals: "Positive realized PnL, higher win rate, profit factor above threshold, enough closed positions.",
    caution: "This does not guarantee future performance.",
  },
  WASH_TRADING_SUSPECT: {
    label: "Wash Trading Suspect",
    meaning: "Wallet shows patterns that can be associated with potentially suspicious market behavior.",
    commonSignals: "High suspicion score, repeated counterparties, circular or reciprocal flow signals.",
    caution: "This is not proof of wash trading or suspicious behavior.",
  },
};

export const RISK_FACTOR_EXPLANATIONS: Record<string, RiskFactorExplanation> = {
  HIGH_FREQUENCY_ACTIVITY: {
    label: "High Frequency Activity",
    meaning: "Activity is concentrated into dense or unusually fast transaction bursts.",
    whyItMatters: "Dense transaction bursts can indicate automated or high-intensity trading.",
  },
  SHORT_HOLDING_PERIOD: {
    label: "Short Holding Period",
    meaning: "Many positions appear to be opened and closed quickly.",
    whyItMatters: "Short holding can indicate speculative or rapid trading behavior.",
  },
  NEGATIVE_PNL: {
    label: "Negative PnL",
    meaning: "Closed positions in the analyzed window produced negative realized PnL.",
    whyItMatters: "Negative realized PnL means closed positions lost value in this analysis window.",
  },
  LOW_WIN_RATE: {
    label: "Low Win Rate",
    meaning: "The wallet has enough closed positions to estimate win rate, and that rate is low.",
    whyItMatters: "Low win rate matters only when there are enough closed positions.",
  },
  HIGH_TOKEN_DIVERSITY: {
    label: "High Token Diversity",
    meaning: "The wallet traded many different tokens in the analyzed window.",
    whyItMatters: "Trading many different tokens can indicate broad speculative behavior.",
  },
  HIGH_PORTFOLIO_CONCENTRATION: {
    label: "High Portfolio Concentration",
    meaning: "A large share of portfolio value appears concentrated in one or a few holdings.",
    whyItMatters: "Concentration can increase exposure to one asset or theme.",
  },
  WASH_TRADING_SUSPECTED: {
    label: "Wash Trading Suspected",
    meaning: "The wallet shows patterns that can be associated with potentially suspicious market behavior.",
    whyItMatters: "This can be a review-priority signal, but it is not proof of wash trading.",
  },
  MISSING_DATA: {
    label: "Missing Data",
    meaning: "Some data could not be fully parsed or valued.",
    whyItMatters: "This affects reliability, not wallet behavior itself.",
  },
};

export function getPersonaExplanation(persona: string | null | undefined): PersonaExplanation {
  return PERSONA_EXPLANATIONS[String(persona ?? "UNKNOWN").toUpperCase()] ?? PERSONA_EXPLANATIONS.UNKNOWN;
}

export function getRiskFactorExplanation(code: string | null | undefined): RiskFactorExplanation {
  const normalized = String(code ?? "").toUpperCase();
  return RISK_FACTOR_EXPLANATIONS[normalized] ?? {
    label: formatRiskCode(normalized || "UNKNOWN"),
    meaning: "This risk factor was generated from the wallet's analyzed behavior.",
    whyItMatters: "It contributes to the total Risk Score based on the rule that produced it.",
  };
}

export function buildDataCompletenessText(profile: any): string {
  const completeness = formatPercent(profile?.dataQuality?.completenessScore);
  const unsupported = Number(profile?.dataQuality?.unsupportedTransactionCount ?? 0);
  const missingPrices = Number(profile?.dataQuality?.missingPriceCount ?? 0);
  const txCount = Number(profile?.analysisWindow?.actualTransactionCount ?? profile?.analysisWindow?.transactionLimit ?? 0);

  const usability = Number(profile?.dataQuality?.completenessScore ?? 0) >= 70 ? "most" : "some";
  const parts = [`Data completeness is ${completeness}. This means ${usability} of the analyzed data was usable.`];
  if (txCount > 0 && unsupported > 0) parts.push(`${unsupported} unsupported out of ${txCount} analyzed transactions.`);
  if (missingPrices > 0) parts.push(`${missingPrices} transactions were missing price data.`);
  if (unsupported === 0 && missingPrices === 0) parts.push("No missing prices or unsupported transactions were detected in this analysis window.");
  return parts.join(" ");
}

export function getRiskLevelExplanation(riskScore: number | null | undefined, txCount: number | null | undefined): string {
  if (Number(txCount ?? 0) < 10) {
    return "Risk Level is UNKNOWN because fewer than 10 transactions were analyzed.";
  }
  return `Risk Level is assigned from total Risk Score. Current Risk Score is ${riskScore ?? "-"} / 100: LOW 0-19, MEDIUM 20-44, HIGH 45-74, CRITICAL 75-100.`;
}

export function getRiskScoreFromTrust(trustScore: number | null | undefined): number | null {
  if (trustScore == null || !Number.isFinite(Number(trustScore))) return null;
  return Math.max(0, Math.min(100, 100 - Math.round(Number(trustScore))));
}
