import type {
  TradingAlertConditionInsert,
  TradingAlertScopeInsert,
  UserAlertStatus,
  UserAlertTriggerMode,
} from "@sv/db/alerts.js";
import {
  alertDelivery,
  alertState,
  alerts,
  tradingAlertConditions,
  tradingAlertScopes,
} from "@sv/db/alerts.js";
import { db } from "@sv/db/index.js";
import { and, eq } from "drizzle-orm";

export type TradingAlertInput = {
  alertType: "trading";
  userId: string;
  triggerMode: UserAlertTriggerMode;
  expiresAt: Date | string;
  alertName: string;
  email: string | null;
  scopes: Array<Omit<TradingAlertScopeInsert, "id" | "alertId">>;
  conditions: Array<Omit<TradingAlertConditionInsert, "id" | "alertId">>;
};

export async function getTradingAlertDetails(alertId: string, userId: string) {
  const [core] = await db
    .select({
      alert: alerts,
      state: alertState,
    })
    .from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .limit(1);

  if (!core || core.alert.alertType != "trading") {
    return null;
  }

  const [deliveryRows, tradingScopeRows, tradingConditionRows] =
    await Promise.all([
      db.select().from(alertDelivery).where(eq(alertDelivery.alertId, alertId)),
      db
        .select()
        .from(tradingAlertScopes)
        .where(eq(tradingAlertScopes.alertId, alertId)),
      db
        .select()
        .from(tradingAlertConditions)
        .where(eq(tradingAlertConditions.alertId, alertId)),
    ]);

  return {
    alertId,
    alert: core.alert,
    state: core.state,
    delivery: deliveryRows,
    tradingScopes: tradingScopeRows,
    tradingConditions: tradingConditionRows,
  };
}

export async function getTradingAlertsByUser(userId: string) {
  const rows = await db
    .select({
      alertId: alerts.id,
    })
    .from(alerts)
    .where(eq(alerts.userId, userId));

  const details = (
    await Promise.all(
      rows.map((row) => getTradingAlertDetails(row.alertId, userId)),
    )
  ).filter((alert) => alert != null);

  return details;
}

export async function createTradingAlert(input: TradingAlertInput) {
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

    if (input.email) {
      await tx.insert(alertDelivery).values({
        alertId: alert.id,
        email: input.email,
      });
    }

    if (input.scopes.length > 0) {
      await tx.insert(tradingAlertScopes).values(
        input.scopes.map((scope) => ({
          alertId: alert.id,
          walletAddress: scope.walletAddress,
          tokenAddress: scope.tokenAddress,
          poolAddress: scope.poolAddress,
          counterpartyAddress: scope.counterpartyAddress,
          direction: scope.direction,
        })),
      );
    }

    await tx.insert(tradingAlertConditions).values(
      input.conditions.map((cond) => ({
        alertId: alert.id,
        aggregation: cond.aggregation,
        period: cond.period,
        conditionOp: cond.conditionOp,
        value: cond.value,
      })),
    );

    return alert.id;
  });
}

export async function updateTradingAlert(
  alertId: string,
  alert: TradingAlertInput,
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

    if (alert.email) {
      await tx.insert(alertDelivery).values({
        alertId,
        email: alert.email,
      });
    }

    await tx
      .delete(tradingAlertScopes)
      .where(eq(tradingAlertScopes.alertId, alertId));

    await tx
      .delete(tradingAlertConditions)
      .where(eq(tradingAlertConditions.alertId, alertId));

    if (alert.scopes.length > 0) {
      await tx.insert(tradingAlertScopes).values(
        alert.scopes.map((scope) => ({
          alertId,
          walletAddress: scope.walletAddress,
          tokenAddress: scope.tokenAddress,
          poolAddress: scope.poolAddress,
          counterpartyAddress: scope.counterpartyAddress,
          direction: scope.direction,
        })),
      );
    }

    await tx.insert(tradingAlertConditions).values(
      alert.conditions.map((cond) => ({
        alertId,
        aggregation: cond.aggregation,
        period: cond.period,
        conditionOp: cond.conditionOp,
        value: cond.value,
      })),
    );
  });
}

export async function setTradingAlertState(
  alertId: string,
  status: UserAlertStatus,
) {
  await db
    .update(alertState)
    .set({
      status: status,
    })
    .where(eq(alertState.alertId, alertId));
}

export async function deleteTradingAlert(alertId: string) {
  await db.delete(alerts).where(eq(alerts.id, alertId));
}
