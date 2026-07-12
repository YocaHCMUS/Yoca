import { db } from "@sv/db/index.js";
import { subscriptions } from "@sv/db/schema.js";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

export type EffectivePlanTier = "Free" | "Lite" | "Plus" | "Pro";

export interface UserEntitlements {
  washTradingAi: boolean;
  walletAiAnalysis: boolean;
}

const TIER_RANK: Record<EffectivePlanTier, number> = {
  Free: 0,
  Lite: 1,
  Plus: 2,
  Pro: 3,
};

export async function getUserEffectivePlanTier(
  userId: string,
  now = new Date(),
): Promise<EffectivePlanTier> {
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

  return selectHighestEffectivePlanTier(rows.map((row) => row.planTier));
}

export function selectHighestEffectivePlanTier(
  planTiers: Array<Exclude<EffectivePlanTier, "Free">>,
): EffectivePlanTier {
  return planTiers.reduce<EffectivePlanTier>(
    (highest, planTier) =>
      TIER_RANK[planTier] > TIER_RANK[highest]
        ? planTier
        : highest,
    "Free",
  );
}

export function getEntitlementsForPlanTier(
  planTier: EffectivePlanTier,
): UserEntitlements {
  const hasPaidAiAccess =
    planTier == "Plus" || planTier == "Pro";

  return {
    washTradingAi: hasPaidAiAccess,
    walletAiAnalysis: hasPaidAiAccess,
  };
}
