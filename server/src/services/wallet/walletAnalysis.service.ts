
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
import { z } from "zod";

const WALLET_AI_ANALYSIS_TIMEOUT_MS = 180_000;
const DEFAULT_WALLET_AI_ANALYSIS_WEBHOOK_URL =
  "http://localhost:5678/webhook/analyse-wallet";

const walletAiAnalysisRequestSchema = z.object({
  address: z.string().trim().min(1),
});

const walletAiAnalysisRiskSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase());

const walletAiAnalysisResponseSchema = z.object({
  wallet_address: z.string().trim().min(1),
  classification: z.object({
    primary_type: z.string().trim().min(1),
    confidence_percentage: z.number(),
    supporting_signals: z.array(z.string().trim().min(1)).default([]),
  }),
  strategy: z.object({
    primary_strategy: z.string().trim().min(1),
    secondary_strategies: z.array(z.string().trim().min(1)).default([]),
    evidence: z.array(z.string().trim().min(1)).default([]),
  }),
  behavior_metrics: z.object({
    trade_frequency: z.string().trim().min(1),
    avg_holding_time: z.string().trim().min(1),
    portfolio_concentration: z.string().trim().min(1),
    win_loss_estimate: z.string().trim().min(1),
    token_distribution: z.string().trim().min(1),
  }),
  first_funder_analysis: z.object({
    funder_type: z.string().trim().min(1),
    risk_signal: walletAiAnalysisRiskSchema,
    notes: z.string().trim().min(1),
  }),
  wallet_age: z.object({
    age_category: z.string().trim().min(1),
    first_seen: z.string().trim().min(1),
    consistency_assessment: z.string().trim().min(1),
  }),
  risk_assessment: z.object({
    overall_risk: walletAiAnalysisRiskSchema,
    flags: z.array(z.string().trim().min(1)).default([]),
  }),
  summary: z.string().trim().min(1),
});

const walletAiAnalysisWebhookPayloadSchema = z.union([
  walletAiAnalysisResponseSchema,
  z.array(walletAiAnalysisResponseSchema).min(1),
]);

type WalletAiAnalysisResponse = z.infer<typeof walletAiAnalysisResponseSchema>;

type WalletAnalysisErrorCode =
  | "invalid_address"
  | "dependency_not_ready"
  | "provider_timeout"
  | "provider_unavailable"
  | "provider_bad_payload"
  | "provider_unknown";

type WalletAnalysisMissingDependency =
  | "identity"
  | "first_fund"
  | "portfolio"
  | "swaps";

type WalletAnalysisErrorDetails = {
  missingDependencies?: WalletAnalysisMissingDependency[];
  providerStatusCode?: number;
  requestId?: string;
};

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

function createRequestId(): string {
  return `wai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function resolveWebhookEndpoint(): string {
  const configured = process.env.WALLET_AI_ANALYSIS_WEBHOOK_URL?.trim();
  return configured && configured.length > 0
    ? configured
    : DEFAULT_WALLET_AI_ANALYSIS_WEBHOOK_URL;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value != null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unwrapWebhookPayload(payload: unknown): unknown {
  let current: unknown = payload;

  if (Array.isArray(current)) {
    current = current[0];
  }

  const asObject = asRecord(current);
  if (asObject?.output !== undefined) {
    current = asObject.output;
  }

  if (Array.isArray(current)) {
    current = current[0];
  }

  return current;
}

function normalizeWebhookPayload(payload: unknown): WalletAiAnalysisResponse {
  const unwrappedPayload = unwrapWebhookPayload(payload);
  const parsedPayload = walletAiAnalysisWebhookPayloadSchema.parse(unwrappedPayload);
  const normalized = Array.isArray(parsedPayload)
    ? parsedPayload[0]
    : parsedPayload;

  return walletAiAnalysisResponseSchema.parse(normalized);
}

async function checkDependencies(
  address: string,
): Promise<{ missing: WalletAnalysisMissingDependency[] }> {
  const [identityResult, firstFundResult, portfolioResult, swapsResult] =
    await Promise.allSettled([
      getWalletIdentity(address),
      getWalletFirstFund(address),
      getWalletPortfolio(address),
      getWalletSwaps(address, { limit: 1 }),
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
): Promise<WalletAiAnalysisResponse> {
  const normalizedAddress = address.trim();
  const requestId = createRequestId();

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

  const endpoint = resolveWebhookEndpoint();
  const acmsParams = {
    address: normalizedAddress,
    modelVersion: process.env.WALLET_AI_MODEL_VERSION?.trim() || undefined,
    promptVersion: process.env.WALLET_AI_PROMPT_VERSION?.trim() || undefined,
  };

  const startedAt = Date.now();
  if (WALLET_AI_ANALYSIS_DEBUG) {
    console.debug("[wallet-ai-analysis] webhook request start", {
      requestId,
      address: normalizedAddress,
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
            body: JSON.stringify({ address: normalizedAddress }),
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

    const normalized = normalizeWebhookPayload(payload);

    if (WALLET_AI_ANALYSIS_DEBUG) {
      const latencyMs = Date.now() - startedAt;
      console.debug("[wallet-ai-analysis] webhook request success", {
        requestId,
        address: normalizedAddress,
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