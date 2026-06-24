import { db } from "@sv/db/index.js";
import { aiDailyUsage, subscriptions } from "@sv/db/schema.js";
import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";

export const AI_FEATURES = {
  AskYocaAi: "ask_yoca_ai",
  VolatilitySignalSummary: "volatility_signal_summary",
  WalletAiSwapSummary: "wallet_ai_swap_summary",
  GeneralAiChat: "general_ai_chat",
  TokenChartNewsSummary: "token_chart_news_summary",
  WalletAiAnalysis: "wallet_ai_analysis",
  WashTradingAiAnalysis: "wash_trading_ai_analysis",
} as const;

export type AiFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES];
export type AiTier = "Free" | "Lite" | "Plus" | "Pro";

const AI_DAILY_LIMITS: Record<AiFeature, Record<AiTier, number>> = {
  [AI_FEATURES.AskYocaAi]: {
    Free: 5,
    Lite: 20,
    Plus: 50,
    Pro: 100,
  },
  [AI_FEATURES.VolatilitySignalSummary]: {
    Free: 10,
    Lite: 25,
    Plus: 50,
    Pro: 100,
  },
  [AI_FEATURES.WalletAiSwapSummary]: {
    Free: 10,
    Lite: 20,
    Plus: 50,
    Pro: 100,
  },
  [AI_FEATURES.GeneralAiChat]: {
    Free: 5,
    Lite: 20,
    Plus: 50,
    Pro: 100,
  },
  [AI_FEATURES.TokenChartNewsSummary]: {
    Free: 5,
    Lite: 20,
    Plus: 50,
    Pro: 100,
  },
  [AI_FEATURES.WalletAiAnalysis]: {
    Free: 0,
    Lite: 0,
    Plus: 50,
    Pro: 100,
  },
  [AI_FEATURES.WashTradingAiAnalysis]: {
    Free: 0,
    Lite: 0,
    Plus: 50,
    Pro: 100,
  },
};

const AI_FEATURE_REQUIRED_TIER: Partial<Record<AiFeature, Exclude<AiTier, "Free">>> = {
  [AI_FEATURES.WalletAiAnalysis]: "Plus",
  [AI_FEATURES.WashTradingAiAnalysis]: "Plus",
};

const TIER_RANK: Record<AiTier, number> = {
  Free: 0,
  Lite: 1,
  Plus: 2,
  Pro: 3,
};

export interface AiUsageMetadata {
  feature: AiFeature;
  tier: AiTier;
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
  requiredTier?: Exclude<AiTier, "Free">;
}

export interface AiUsageReservation {
  allowed: boolean;
  usage: AiUsageMetadata;
  userId: string;
  usageDate: string;
}

export function getAiDailyLimit(feature: AiFeature, tier: AiTier) {
  return AI_DAILY_LIMITS[feature][tier];
}

export function getAiFeatureRequiredTier(feature: AiFeature) {
  return AI_FEATURE_REQUIRED_TIER[feature] ?? null;
}

export function isAiFeatureLocked(feature: AiFeature, tier: AiTier) {
  const requiredTier = getAiFeatureRequiredTier(feature);
  return Boolean(requiredTier && TIER_RANK[tier] < TIER_RANK[requiredTier]);
}

export function getUtcUsageWindow(now = new Date()) {
  const usageDate = now.toISOString().slice(0, 10);
  const resetsAt = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    ),
  ).toISOString();

  return { usageDate, resetsAt };
}

export function selectHighestTier(
  tiers: Array<Exclude<AiTier, "Free">>,
): AiTier {
  return tiers.reduce<AiTier>(
    (highest, tier) =>
      TIER_RANK[tier] > TIER_RANK[highest] ? tier : highest,
    "Free",
  );
}

async function getUserAiTier(userId: string, now: Date): Promise<AiTier> {
  const rows = await db
    .select({ planTier: subscriptions.planTier })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ["active", "trialing"]),
        or(
          isNull(subscriptions.currentPeriodEnd),
          gt(subscriptions.currentPeriodEnd, now),
        ),
      ),
    );

  return selectHighestTier(rows.map((row) => row.planTier));
}

function usageMetadata(
  feature: AiFeature,
  tier: AiTier,
  used: number,
  resetsAt: string,
): AiUsageMetadata {
  const limit = getAiDailyLimit(feature, tier);
  const requiredTier = getAiFeatureRequiredTier(feature) ?? undefined;
  return {
    feature,
    tier,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetsAt,
    ...(requiredTier ? { requiredTier } : {}),
  };
}

export async function getAiUsage(
  userId: string,
  feature: AiFeature,
  now = new Date(),
): Promise<AiUsageMetadata> {
  const tier = await getUserAiTier(userId, now);
  const { usageDate, resetsAt } = getUtcUsageWindow(now);
  const [current] = await db
    .select({ used: aiDailyUsage.usageCount })
    .from(aiDailyUsage)
    .where(
      and(
        eq(aiDailyUsage.userId, userId),
        eq(aiDailyUsage.feature, feature),
        eq(aiDailyUsage.usageDate, usageDate),
      ),
    )
    .limit(1);

  return usageMetadata(feature, tier, current?.used ?? 0, resetsAt);
}

export async function reserveAiUsage(
  userId: string,
  feature: AiFeature,
  now = new Date(),
): Promise<AiUsageReservation> {
  const tier = await getUserAiTier(userId, now);
  const limit = getAiDailyLimit(feature, tier);
  const { usageDate, resetsAt } = getUtcUsageWindow(now);

  if (isAiFeatureLocked(feature, tier)) {
    return {
      allowed: false,
      usage: usageMetadata(feature, tier, 0, resetsAt),
      userId,
      usageDate,
    };
  }

  const [reserved] = await db
    .insert(aiDailyUsage)
    .values({
      userId,
      feature,
      usageDate,
      usageCount: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        aiDailyUsage.userId,
        aiDailyUsage.feature,
        aiDailyUsage.usageDate,
      ],
      set: {
        usageCount: sql`${aiDailyUsage.usageCount} + 1`,
        updatedAt: now,
      },
      setWhere: lt(aiDailyUsage.usageCount, limit),
    })
    .returning({ used: aiDailyUsage.usageCount });

  if (reserved) {
    return {
      allowed: true,
      usage: usageMetadata(feature, tier, reserved.used, resetsAt),
      userId,
      usageDate,
    };
  }

  const [current] = await db
    .select({ used: aiDailyUsage.usageCount })
    .from(aiDailyUsage)
    .where(
      and(
        eq(aiDailyUsage.userId, userId),
        eq(aiDailyUsage.feature, feature),
        eq(aiDailyUsage.usageDate, usageDate),
      ),
    )
    .limit(1);

  return {
    allowed: false,
    usage: usageMetadata(feature, tier, current?.used ?? limit, resetsAt),
    userId,
    usageDate,
  };
}

export async function releaseAiUsage(
  reservation: AiUsageReservation,
  now = new Date(),
) {
  if (!reservation.allowed) return;

  await db
    .update(aiDailyUsage)
    .set({
      usageCount: sql`greatest(${aiDailyUsage.usageCount} - 1, 0)`,
      updatedAt: now,
    })
    .where(
      and(
        eq(aiDailyUsage.userId, reservation.userId),
        eq(aiDailyUsage.feature, reservation.usage.feature),
        eq(aiDailyUsage.usageDate, reservation.usageDate),
      ),
    );
}
