import type {
  UserAlertConditionInsert,
  UserAlertInsert,
  UserAlertStatus,
} from "@sv/db/alerts.js";
import {
  userAlertConditions,
  userAlertState,
  userAlerts,
} from "@sv/db/alerts.js";
import { db } from "@sv/db/index.js";
import { and, eq } from "drizzle-orm";

export type CreateAlertInput = UserAlertInsert & {
  conditions: Omit<UserAlertConditionInsert, "alertId">[];
};

export async function createAlert(input: CreateAlertInput) {
  if (input.conditions.length == 0) {
    return null;
  }

  let createdAlertId: string | null = null;
  await db.transaction(async (tx) => {
    const [alert] = await tx
      .insert(userAlerts)
      .values({
        userId: input.userId,
        tokenAddress: input.tokenAddress,
        triggerMode: input.triggerMode,
        expiresAt: new Date(input.expiresAt),
        alertName: input.alertName,
        email: input.email,
      })
      .returning();

    createdAlertId = alert.id;

    await tx.insert(userAlertState).values({
      alertId: alert.id,
      status: "running",
    });

    // Insert all conditions
    await tx.insert(userAlertConditions).values(
      input.conditions.map((cond) => ({
        alertId: alert.id,
        period: cond.period,
        alertType: cond.alertType,
        conditionOp: cond.conditionOp,
        value: cond.value,
      })),
    );
  });

  return createdAlertId;
}

export async function getAlertsByUser(userId: string) {
  const alertDetails = await db
    .select({
      alertId: userAlerts.id,
      alert: userAlerts,
      state: userAlertState,
    })
    .from(userAlerts)
    .innerJoin(userAlertState, eq(userAlertState.alertId, userAlerts.id))
    .where(eq(userAlerts.userId, userId));

  return alertDetails;
}

export async function getAlertById(alertId: string, userId: string) {
  const [alertDetail] = await db
    .select({
      alertId: userAlerts.id,
      alert: userAlerts,
      state: userAlertState,
    })
    .from(userAlerts)
    .innerJoin(userAlertState, eq(userAlertState.alertId, userAlerts.id))
    .where(and(eq(userAlerts.userId, userId), eq(userAlerts.id, alertId)))
    .limit(1);

  return alertDetail || null;
}

export async function updateAlert(alertId: string, alert: CreateAlertInput) {
  if (alert.conditions.length == 0) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(userAlerts)
      .set({
        userId: alert.userId,
        tokenAddress: alert.tokenAddress,
        triggerMode: alert.triggerMode,
        expiresAt: new Date(alert.expiresAt),
        alertName: alert.alertName,
        email: alert.email,
      })
      .where(eq(userAlerts.id, alertId));

    // Delete old conditions
    await tx
      .delete(userAlertConditions)
      .where(eq(userAlertConditions.alertId, alertId));

    // Recreate conditions
    await tx.insert(userAlertConditions).values(
      alert.conditions.map((cond) => ({
        alertId,
        period: cond.period,
        alertType: cond.alertType,
        conditionOp: cond.conditionOp,
        value: cond.value,
      })),
    );
  });
}

export async function setAlertState(alertId: string, status: UserAlertStatus) {
  await db
    .insert(userAlertState)
    .values({
      alertId,
      status,
    })
    .onConflictDoUpdate({
      target: userAlertState.alertId,
      set: {
        status,
      },
    });
}

export async function stopAlert(alertId: string) {
  return await setAlertState(alertId, "stopped");
}

export async function deleteAlert(alertId: string) {
  await db.delete(userAlerts).where(eq(userAlerts.id, alertId));
}
