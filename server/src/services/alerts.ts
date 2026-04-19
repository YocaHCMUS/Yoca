import type {
  UserAlertConditionOp,
  UserAlertPeriod,
  UserAlertSelect,
  UserAlertTriggerMode,
  UserAlertType,
} from "@sv/db/alerts.js";
import { userAlertConditions, userAlerts } from "@sv/db/alerts.js";
import { db } from "@sv/db/index.js";
import { eq } from "drizzle-orm";

// Type aliases for local reusability
type AlertCondition = {
  period: UserAlertPeriod;
  alertType: UserAlertType;
  condition: UserAlertConditionOp;
  value: number;
};

export type CreateAlertInput = {
  userId: string;
  tokenAddress: string;
  triggerMode: UserAlertTriggerMode;
  expiresAt: string;
  alertName: string;
  email?: string;
  conditions: AlertCondition[];
};

export async function createAlert(input: CreateAlertInput) {
  if (input.conditions.length == 0) {
    return null;
  }

  let createdAlert: UserAlertSelect | null = null;
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

    createdAlert = alert;

    // Insert all conditions
    await tx.insert(userAlertConditions).values(
      input.conditions.map((cond) => ({
        alertId: alert.id,
        period: cond.period,
        alertType: cond.alertType,
        conditionOp: cond.condition,
        value: cond.value,
      })),
    );
  });
  return createdAlert;
}

export async function getAlertsByUser(userId: string) {
  return await db
    .select()
    .from(userAlerts)
    .where(eq(userAlerts.userId, userId));
}

export async function getAlertById(alertId: string) {
  const [row] = await db
    .select()
    .from(userAlerts)
    .where(eq(userAlerts.id, alertId))
    .limit(1);
  return row;
}

export async function updateAlert(
  alertId: string,
  conditions: {
    triggerMode: UserAlertTriggerMode;
    expiresAt: string;
    conditions: AlertCondition[];
  },
) {
  let updatedAlert: UserAlertSelect | null = null;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(userAlerts)
      .set({
        triggerMode: conditions.triggerMode,
        expiresAt: new Date(conditions.expiresAt),
      })
      .where(eq(userAlerts.id, alertId))
      .returning();

    updatedAlert = row;

    // Delete old conditions
    await tx
      .delete(userAlertConditions)
      .where(eq(userAlertConditions.alertId, alertId));

    // Insert new conditions
    await tx.insert(userAlertConditions).values(
      conditions.conditions.map((cond) => ({
        alertId,
        period: cond.period,
        alertType: cond.alertType,
        conditionOp: cond.condition,
        value: cond.value,
      })),
    );
  });
  return updatedAlert;
}

export async function deleteAlert(alertId: string) {
  await db.delete(userAlerts).where(eq(userAlerts.id, alertId));
}
