import {
  alertDelivery,
  alertState,
  alerts,
  tradingEventAlertConditions,
  tradingEventAlertTargets,
  type UserAlertStatus,
  type UserAlertTriggerMode,
  type UserTradingEventType,
} from "@sv/db/alerts.js";
import { db } from "@sv/db/index.js";
import { and, eq, gt, inArray, lte } from "drizzle-orm";

export interface TradingEventAlertInput {
  userId: string;
  triggerMode: UserAlertTriggerMode;
  expiresAt: Date | string;
  name: string;
  delivery: { email: string | null; discordEnabled: boolean };
  target: { tokenAddress: string; walletAddress: string | null };
  condition: { eventType: UserTradingEventType; minSolAmount: number | null };
}

export interface TradingEventAlertRuntime extends TradingEventAlertInput {
  id: string;
  discordWebhookUrl: string | null;
}

export async function getTradingEventAlertDetails(alertId: string, userId: string) {
  const [core] = await db
    .select({ alert: alerts, state: alertState })
    .from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId), eq(alerts.alertType, "trading")))
    .limit(1);
  if (!core) return null;

  const [[target], [condition], [delivery]] = await Promise.all([
    db.select().from(tradingEventAlertTargets).where(eq(tradingEventAlertTargets.alertId, alertId)).limit(1),
    db.select().from(tradingEventAlertConditions).where(eq(tradingEventAlertConditions.alertId, alertId)).limit(1),
    db.select().from(alertDelivery).where(eq(alertDelivery.alertId, alertId)).limit(1),
  ]);
  if (!target || !condition) return null;

  return {
    alertId,
    alert: core.alert,
    state: core.state,
    target,
    condition,
    delivery: delivery ?? { email: null, discordEnabled: false },
  };
}

export async function getTradingEventAlertsByUser(userId: string) {
  const rows = await db.select({ id: alerts.id }).from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.alertType, "trading")));
  return (await Promise.all(rows.map((row) => getTradingEventAlertDetails(row.id, userId))))
    .filter((row): row is NonNullable<typeof row> => row != null);
}

export async function createTradingEventAlert(input: TradingEventAlertInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [alert] = await tx.insert(alerts).values({
      userId: input.userId,
      alertType: "trading",
      triggerMode: input.triggerMode,
      expiresAt: new Date(input.expiresAt),
      name: input.name,
    }).returning({ id: alerts.id });
    await tx.insert(alertState).values({ alertId: alert.id, status: "running" });
    await tx.insert(alertDelivery).values({
      alertId: alert.id,
      email: input.delivery.email,
      discordEnabled: input.delivery.discordEnabled,
    });
    await tx.insert(tradingEventAlertTargets).values({
      alertId: alert.id,
      tokenAddress: input.target.tokenAddress,
      walletAddress: input.target.walletAddress,
    });
    await tx.insert(tradingEventAlertConditions).values({
      alertId: alert.id,
      eventType: input.condition.eventType,
      minSolAmount: input.condition.minSolAmount,
    });
    return alert.id;
  });
}

export async function updateTradingEventAlert(alertId: string, input: TradingEventAlertInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(alerts).set({ triggerMode: input.triggerMode, expiresAt: new Date(input.expiresAt), name: input.name })
      .where(eq(alerts.id, alertId));
    await tx.update(alertDelivery).set({ email: input.delivery.email, discordEnabled: input.delivery.discordEnabled })
      .where(eq(alertDelivery.alertId, alertId));
    await tx.update(tradingEventAlertTargets).set({ tokenAddress: input.target.tokenAddress, walletAddress: input.target.walletAddress })
      .where(eq(tradingEventAlertTargets.alertId, alertId));
    await tx.update(tradingEventAlertConditions).set({ eventType: input.condition.eventType, minSolAmount: input.condition.minSolAmount })
      .where(eq(tradingEventAlertConditions.alertId, alertId));
  });
}

export async function setTradingEventAlertState(alertId: string, status: UserAlertStatus) {
  await db.update(alertState).set({ status }).where(eq(alertState.alertId, alertId));
}

export async function deleteTradingEventAlert(alertId: string) {
  await db.delete(alerts).where(eq(alerts.id, alertId));
}

export async function stopExpiredTradingEventAlerts(now = new Date()): Promise<number> {
  const expired = await db.select({ id: alerts.id }).from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .innerJoin(tradingEventAlertTargets, eq(tradingEventAlertTargets.alertId, alerts.id))
    .where(and(eq(alerts.alertType, "trading"), eq(alertState.status, "running"), lte(alerts.expiresAt, now)));
  if (expired.length === 0) return 0;
  await db.update(alertState).set({ status: "stopped" })
    .where(inArray(alertState.alertId, expired.map((row) => row.id)));
  return expired.length;
}

/** Addresses supplied to the shared Helius managed-webhook union. */
export async function getActiveTradingEventMonitoredAddresses(now = new Date()): Promise<string[]> {
  const rows = await db.select({ tokenAddress: tradingEventAlertTargets.tokenAddress, walletAddress: tradingEventAlertTargets.walletAddress })
    .from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .innerJoin(tradingEventAlertTargets, eq(tradingEventAlertTargets.alertId, alerts.id))
    .where(and(eq(alerts.alertType, "trading"), eq(alertState.status, "running"), gt(alerts.expiresAt, now)));
  return [...new Set(rows.flatMap((row) => [row.tokenAddress, row.walletAddress].filter((value): value is string => Boolean(value))))];
}
