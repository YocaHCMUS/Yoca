
import {
  WALLET_AI_ANALYSIS_DEBUG,
  WALLET_AI_ANALYSIS_USE_ACMS,
} from "@sv/config/constants.js";
import { getWalletPortfolio } from "@sv/services/wallet/walletPortfolio.service.js";
import { getWalletFirstFund } from "@sv/services/wallet/walletFirstFund.service.js";
import { getWalletSwaps } from "@sv/services/wallet/walletTransfersSwaps.service.js";
import {
  WalletIdentityServiceError,
  getWalletIdentity,
  isValidSolanaAddress,
} from "@sv/services/wallet/walletIdentity.service.js";
import { callViaAcms } from "@sv/services/wallet/providers/adapters/index.js";
import {
  createWalletAiAnalysisCacheKey,
  getCachedWalletAiAnalysis,
  saveCachedWalletAiAnalysis,
} from "@sv/services/wallet/db/walletAnalysisCache.js";
import {
  walletAiAnalysisRequestSchema,
  type WalletAiAnalysisResponse,
  type WalletAnalysisErrorCode,
  type WalletAnalysisErrorDetails,
  type WalletAnalysisMissingDependency,
} from "@sv/services/wallet/dtos/walletAnalysisObjects.js";
import {
  createWalletAiAnalysisRequestId,
  isAbortError,
  normalizeWalletAiAnalysisWebhookPayload,
  normalizeWalletAiLanguage,
  resolveWalletAiAnalysisWebhookEndpoint,
} from "@sv/services/wallet/util/walletAnalysis.utils.js";
import { z } from "zod";

const WALLET_AI_ANALYSIS_TIMEOUT_MS = 180_000;

export class WalletAnalysisServiceError extends Error {
  readonly code: WalletAnalysisErrorCode;
  readonly status: number;
  readonly details?: WalletAnalysisErrorDetails;

  constructor(
    message: string,
    code: WalletAnalysisErrorCode,
    status: number,
    details?: WalletAnalysisErrorDetails,
  ) {
    super(message);
    this.name = "WalletAnalysisServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function checkDependencies(
  address: string,
): Promise<{ missing: WalletAnalysisMissingDependency[] }> {
  const [identityResult, firstFundResult, portfolioResult, swapsResult] =
    await Promise.allSettled([
      getWalletIdentity(address),
      getWalletFirstFund(address),
      getWalletPortfolio(address),
      getWalletSwaps(address),
    ]);

  const missing: WalletAnalysisMissingDependency[] = [];

  if (
    identityResult.status !== "fulfilled" ||
    identityResult.value.identity.status === "unavailable"
  ) {
    missing.push("identity");
  }

  if (firstFundResult.status !== "fulfilled" || firstFundResult.value == null) {
    missing.push("first_fund");
  }

  if (
    portfolioResult.status !== "fulfilled" ||
    !Array.isArray(portfolioResult.value) ||
    portfolioResult.value.length === 0
  ) {
    missing.push("portfolio");
  }

  if (
    swapsResult.status !== "fulfilled" ||
    !Array.isArray(swapsResult.value.swaps) ||
    swapsResult.value.swaps.length === 0
  ) {
    missing.push("swaps");
  }

  return { missing };
}

export async function getWalletAiAnalysis(
  address: string,
  language?: string,
): Promise<WalletAiAnalysisResponse> {
  const normalizedAddress = address.trim();
  const normalizedLanguage = normalizeWalletAiLanguage(language);
  const requestId = createWalletAiAnalysisRequestId();
  const modelVersion = process.env.WALLET_AI_MODEL_VERSION?.trim() || undefined;
  const promptVersion = process.env.WALLET_AI_PROMPT_VERSION?.trim() || undefined;

  if (!normalizedAddress || !isValidSolanaAddress(normalizedAddress)) {
    throw new WalletAnalysisServiceError(
      "Invalid Solana wallet address",
      "invalid_address",
      400,
      { requestId },
    );
  }

  const dependencyStatus = await checkDependencies(normalizedAddress);
  if (dependencyStatus.missing.length > 0) {
    throw new WalletAnalysisServiceError(
      "Wallet AI analysis dependencies are not ready",
      "dependency_not_ready",
      409,
      {
        missingDependencies: dependencyStatus.missing,
        requestId,
      },
    );
  }

  const endpoint = resolveWalletAiAnalysisWebhookEndpoint();
  const cacheKey = createWalletAiAnalysisCacheKey({
    address: normalizedAddress,
    language: normalizedLanguage,
    modelVersion,
    promptVersion,
  });

  const cached = await getCachedWalletAiAnalysis(cacheKey);
  if (cached) {
    if (WALLET_AI_ANALYSIS_DEBUG) {
      console.debug("[wallet-ai-analysis] cache hit", {
        requestId,
        address: normalizedAddress,
        language: normalizedLanguage,
        cacheKey,
      });
    }

    return cached;
  }

  const acmsParams = {
    address: normalizedAddress,
    language: normalizedLanguage,
    modelVersion,
    promptVersion,
  };

  const startedAt = Date.now();
  if (WALLET_AI_ANALYSIS_DEBUG) {
    console.debug("[wallet-ai-analysis] webhook request start", {
      requestId,
      address: normalizedAddress,
      language: normalizedLanguage,
      endpoint,
      timeoutMs: WALLET_AI_ANALYSIS_TIMEOUT_MS,
      useAcms: WALLET_AI_ANALYSIS_USE_ACMS,
    });
  }

  try {
    const payload = await callViaAcms(
      "n8n",
      "analyse-wallet",
      acmsParams,
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, WALLET_AI_ANALYSIS_TIMEOUT_MS);

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              address: normalizedAddress,
              language: normalizedLanguage,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new WalletAnalysisServiceError(
              `Wallet AI analysis webhook failed with status ${response.status}`,
              "provider_unavailable",
              502,
              { providerStatusCode: response.status, requestId },
            );
          }

          const responseJson: unknown = await response.json();
          return responseJson;
        } finally {
          clearTimeout(timeoutId);
        }
      },
      {
        requestSchema: walletAiAnalysisRequestSchema,
        useAcms: WALLET_AI_ANALYSIS_USE_ACMS,
      },
    );

    if (WALLET_AI_ANALYSIS_DEBUG) {
      console.debug("[wallet-ai-analysis] raw webhook payload", {
        requestId,
        payload,
      });
    }

    const normalized = normalizeWalletAiAnalysisWebhookPayload(payload);

    await saveCachedWalletAiAnalysis({
      key: cacheKey,
      address: normalizedAddress,
      language: normalizedLanguage,
      modelVersion,
      promptVersion,
      raw: payload,
      normalized,
    });

    if (WALLET_AI_ANALYSIS_DEBUG) {
      const latencyMs = Date.now() - startedAt;
      console.debug("[wallet-ai-analysis] webhook request success", {
        requestId,
        address: normalizedAddress,
        language: normalizedLanguage,
        latencyMs,
        source: WALLET_AI_ANALYSIS_USE_ACMS ? "acms-enabled" : "webhook-live",
      });
    }

    return normalized;
  } catch (error) {
    if (error instanceof WalletAnalysisServiceError) {
      if (WALLET_AI_ANALYSIS_DEBUG) {
        console.debug("[wallet-ai-analysis] webhook request failed", {
          requestId,
          address: normalizedAddress,
          language: normalizedLanguage,
          code: error.code,
          status: error.status,
          details: error.details,
        });
      }
      throw error;
    }

    if (error instanceof WalletIdentityServiceError) {
      throw new WalletAnalysisServiceError(
        "Wallet AI analysis dependency check failed",
        "dependency_not_ready",
        409,
        { missingDependencies: ["identity"], requestId },
      );
    }

    if (isAbortError(error)) {
      throw new WalletAnalysisServiceError(
        "Wallet AI analysis timed out",
        "provider_timeout",
        504,
        { requestId },
      );
    }

    if (error instanceof z.ZodError) {
      throw new WalletAnalysisServiceError(
        "Wallet AI analysis response payload is invalid",
        "provider_bad_payload",
        502,
        { requestId },
      );
    }

    throw new WalletAnalysisServiceError(
      "Failed to fetch wallet AI analysis",
      "provider_unknown",
      502,
      { requestId },
    );
  }
}