import type {
  TokenAlertConditionInsert,
  UserAlertPeriod,
  UserAlertStatus,
  UserAlertTriggerMode,
} from "@sv/db/alerts.js";
import {
  alertDelivery,
  alertState,
  alerts,
  tokenAlertConditions,
  tokenAlertTargets,
} from "@sv/db/alerts.js";
import { db } from "@sv/db/index.js";
import { and, eq } from "drizzle-orm";

export type TokenAlertInput = {
  alertType: "token";
  userId: string;
  triggerMode?: UserAlertTriggerMode;
  expiresAt: Date | string;
  alertName: string;
  email?: string;
  discord?: boolean;
  tokenAddress: string;
  conditions: Array<
    Omit<TokenAlertConditionInsert, "id" | "alertId"> & {
      period: UserAlertPeriod;
    }
  >;
};

export async function getTokenAlertDetails(alertId: string, userId: string) {
  const [core] = await db
    .select({
      alert: alerts,
      state: alertState,
    })
    .from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .where(
      and(
        eq(alerts.id, alertId),
        eq(alerts.userId, userId),
        eq(alerts.alertType, "token"),
      ),
    )
    .limit(1);

  if (!core) {
    return null;
  }

  const [deliveryRows, tokenTargetRows, tokenConditionRows] = await Promise.all(
    [
      db.select().from(alertDelivery).where(eq(alertDelivery.alertId, alertId)),
      db
        .select()
        .from(tokenAlertTargets)
        .where(eq(tokenAlertTargets.alertId, alertId))
        .limit(1),
      db
        .select()
        .from(tokenAlertConditions)
        .where(eq(tokenAlertConditions.alertId, alertId)),
    ],
  );

  return {
    alertId,
    alert: {
      ...core.alert,
      alertName: core.alert.name,
    },
    state: core.state,
    delivery: deliveryRows,
    tokenTarget: tokenTargetRows[0] ?? null,
    tokenConditions: tokenConditionRows,
  };
}

export async function getTokenAlertsByUser(userId: string) {
  const rows = await db
    .select({
      alertId: alerts.id,
    })
    .from(alerts)
    .where(eq(alerts.userId, userId));

  const details = (
    await Promise.all(
      rows.map((row) => getTokenAlertDetails(row.alertId, userId)),
    )
  ).filter((alert) => alert != null);

  return details;
}

export async function createTokenAlert(input: TokenAlertInput) {
  if (input.conditions.length == 0) {
    return null;
  }

  return await db.transaction(async (tx) => {
    const [alert] = await tx
      .insert(alerts)
      .values({
        userId: input.userId,
        alertType: input.alertType,
        triggerMode: input.triggerMode,
        expiresAt: new Date(input.expiresAt),
        name: input.alertName,
      })
      .returning();

    await tx.insert(alertState).values({
      alertId: alert.id,
      status: "running",
    });

    if (input.email || input.discord) {
      await tx.insert(alertDelivery).values({
        alertId: alert.id,
        email: input.email || null,
        discordEnabled: Boolean(input.discord),
      });
    }

    await tx.insert(tokenAlertTargets).values({
      alertId: alert.id,
      tokenAddress: input.tokenAddress,
    });

    await tx.insert(tokenAlertConditions).values(
      input.conditions.map((cond) => ({
        alertId: alert.id,
        period: cond.period,
        metric: cond.metric,
        conditionOp: cond.conditionOp,
        value: cond.value,
      })),
    );

    return alert.id;
  });
}

export async function updateTokenAlert(
  alertId: string,
  alert: TokenAlertInput,
) {
  if (alert.conditions.length == 0) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(alerts)
      .set({
        userId: alert.userId,
        alertType: alert.alertType,
        triggerMode: alert.triggerMode,
        expiresAt: new Date(alert.expiresAt),
        name: alert.alertName,
      })
      .where(eq(alerts.id, alertId));

    await tx.delete(alertDelivery).where(eq(alertDelivery.alertId, alertId));

    if (alert.email || alert.discord) {
      await tx.insert(alertDelivery).values({
        alertId,
        email: alert.email || null,
        discordEnabled: Boolean(alert.discord),
      });
    }

    await tx
      .delete(tokenAlertTargets)
      .where(eq(tokenAlertTargets.alertId, alertId));

    await tx
      .delete(tokenAlertConditions)
      .where(eq(tokenAlertConditions.alertId, alertId));

    await tx.insert(tokenAlertTargets).values({
      alertId,
      tokenAddress: alert.tokenAddress,
    });

    await tx.insert(tokenAlertConditions).values(
      alert.conditions.map((cond) => ({
        alertId,
        period: cond.period,
        metric: cond.metric,
        conditionOp: cond.conditionOp,
        value: cond.value,
      })),
    );
  });
}

export async function setTokenAlertState(
  alertId: string,
  status: UserAlertStatus,
) {
  await db
    .update(alertState)
    .set({
      status,
    })
    .where(eq(alertState.alertId, alertId));
}

export async function deleteTokenAlert(alertId: string) {
  await db.delete(alerts).where(eq(alerts.id, alertId));
}
