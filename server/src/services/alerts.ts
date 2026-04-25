import type {
  AlertDeliveryInsert,
  AlertInsert,
  TokenAlertConditionInsert,
  TradingAlertConditionInsert,
  TradingAlertScopeInsert,
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
  tradingAlertConditions,
  tradingAlertScopes,
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
  tokenAddress: string;
  conditions: Array<
    Omit<TokenAlertConditionInsert, "id" | "alertId"> & {
      period: UserAlertPeriod;
    }
  >;
};

export type TradingAlertInput = {
  alertType: "trading";
  userId: string;
  triggerMode?: UserAlertTriggerMode;
  expiresAt: Date | string;
  alertName: string;
  email?: string;
  scopes: Array<Omit<TradingAlertScopeInsert, "id" | "alertId">>;
  conditions: Array<Omit<TradingAlertConditionInsert, "id" | "alertId">>;
};

export type CreateAlertInput = TokenAlertInput | TradingAlertInput;

type AlertDetails = {
  alertId: string;
  alert: AlertInsert & { id: string; alertName: string };
  state: {
    alertId: string;
    status: UserAlertStatus;
    updatedAt: Date;
  };
  delivery: AlertDeliveryInsert[];
  tokenTarget: typeof tokenAlertTargets.$inferSelect | null;
  tokenConditions: (typeof tokenAlertConditions.$inferSelect)[];
  tradingScopes: (typeof tradingAlertScopes.$inferSelect)[];
  tradingConditions: (typeof tradingAlertConditions.$inferSelect)[];
};

async function getAlertDetails(alertId: string, userId?: string) {
  const whereClause = userId
    ? and(eq(alerts.id, alertId), eq(alerts.userId, userId))
    : eq(alerts.id, alertId);

  const [core] = await db
    .select({
      alert: alerts,
      state: alertState,
    })
    .from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .where(whereClause)
    .limit(1);

  if (!core) {
    return null;
  }

  const [
    deliveryRows,
    tokenTargetRows,
    tokenConditionRows,
    tradingScopeRows,
    tradingConditionRows,
  ] = await Promise.all([
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
    db
      .select()
      .from(tradingAlertScopes)
      .where(eq(tradingAlertScopes.alertId, alertId)),
    db
      .select()
      .from(tradingAlertConditions)
      .where(eq(tradingAlertConditions.alertId, alertId)),
  ]);

  const detail: AlertDetails = {
    alertId,
    alert: {
      ...core.alert,
      alertName: core.alert.name,
    },
    state: core.state,
    delivery: deliveryRows,
    tokenTarget: tokenTargetRows[0] ?? null,
    tokenConditions: tokenConditionRows,
    tradingScopes: tradingScopeRows,
    tradingConditions: tradingConditionRows,
  };

  return detail;
}

export async function createAlert(
  input: CreateAlertInput,
): Promise<string | null> {
  if (input.conditions.length == 0) {
    return null;
  }

  let createdAlertId: string | null = null;
  await db.transaction(async (tx) => {
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

    createdAlertId = alert.id;

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

    if (input.alertType == "token") {
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
      return;
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
  });

  return createdAlertId;
}

export async function getAlertsByUser(userId: string) {
  const rows = await db
    .select({
      alertId: alerts.id,
    })
    .from(alerts)
    .where(eq(alerts.userId, userId));

  const details = await Promise.all(
    rows.map((row) => getAlertDetails(row.alertId, userId)),
  );

  return details.filter((item) => item !== null);
}

export async function getAlertById(alertId: string, userId: string) {
  return await getAlertDetails(alertId, userId);
}

export async function updateAlert(alertId: string, alert: CreateAlertInput) {
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
      .delete(tokenAlertTargets)
      .where(eq(tokenAlertTargets.alertId, alertId));

    await tx
      .delete(tokenAlertConditions)
      .where(eq(tokenAlertConditions.alertId, alertId));

    await tx
      .delete(tradingAlertScopes)
      .where(eq(tradingAlertScopes.alertId, alertId));

    await tx
      .delete(tradingAlertConditions)
      .where(eq(tradingAlertConditions.alertId, alertId));

    if (alert.alertType == "token") {
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

      return;
    }

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

export async function setAlertState(alertId: string, status: UserAlertStatus) {
  await db
    .insert(alertState)
    .values({
      alertId,
      status,
    })
    .onConflictDoUpdate({
      target: alertState.alertId,
      set: {
        status,
      },
    });
}

export async function stopAlert(alertId: string) {
  return await setAlertState(alertId, "stopped");
}

export async function deleteAlert(alertId: string) {
  await db.delete(alerts).where(eq(alerts.id, alertId));
}
