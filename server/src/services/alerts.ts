import type {
  UserAlertConditionOp,
  UserAlertPeriod,
  UserAlertSelect,
  UserAlertType,
} from "@sv/db/alert.js";
import { userAlertConditions, userAlerts } from "@sv/db/alert.js";
import { db } from "@sv/db/index.js";
import { eq } from "drizzle-orm";

// Type aliases for local reusability
type AlertCondition = {
  condition: UserAlertConditionOp;
  value: number;
};

export type CreateAlertInput = {
  userId: string;
  tokenAddress: string;
  alertType: UserAlertType;
  period: UserAlertPeriod;
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
        alertType: input.alertType,
        period: input.period,
      })
      .returning();

    createdAlert = alert;

    // Insert all conditions
    await tx.insert(userAlertConditions).values(
      input.conditions.map((cond) => ({
        alertId: alert.id,
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
    alertType: UserAlertType;
    period: UserAlertPeriod;
    conditions: AlertCondition[];
  },
) {
  let updatedAlert: UserAlertSelect | null = null;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(userAlerts)
      .set({ alertType: conditions.alertType, period: conditions.period })
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
