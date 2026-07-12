import { db } from "@sv/db/index.js";
import { alertHistory, type AlertHistoryInsert } from "@sv/db/alerts.js";
import { and, count, desc, eq, isNull } from "drizzle-orm";

export type AlertHistoryPage = {
  items: Array<{
    id: string;
    source: string;
    advancedRuleId: number | null;
    alertId: string | null;
    eventSignature: string | null;
    walletAddress: string | null;
    alertName: string;
    message: string;
    severity: string;
    emailAttempted: boolean;
    emailSucceeded: boolean;
    discordAttempted: boolean;
    discordSucceeded: boolean;
    sentAt: Date;
    readAt: Date | null;
  }>;
  page: number;
  limit: number;
  total: number;
  unreadCount: number;
};

export async function recordAlertHistory(value: AlertHistoryInsert) {
  const [inserted] = await db
    .insert(alertHistory)
    .values(value)
    .onConflictDoNothing({
      target: [alertHistory.userId, alertHistory.eventKey],
    })
    .returning();
  return inserted ?? null;
}

export async function listAlertHistory(
  userId: string,
  page: number,
  limit: number,
): Promise<AlertHistoryPage> {
  const offset = (page - 1) * limit;
  const [items, [totalRow], [unreadRow]] = await Promise.all([
    db
      .select({
        id: alertHistory.id,
        source: alertHistory.source,
        advancedRuleId: alertHistory.advancedRuleId,
        alertId: alertHistory.alertId,
        eventSignature: alertHistory.eventSignature,
        walletAddress: alertHistory.walletAddress,
        alertName: alertHistory.alertName,
        message: alertHistory.message,
        severity: alertHistory.severity,
        emailAttempted: alertHistory.emailAttempted,
        emailSucceeded: alertHistory.emailSucceeded,
        discordAttempted: alertHistory.discordAttempted,
        discordSucceeded: alertHistory.discordSucceeded,
        sentAt: alertHistory.sentAt,
        readAt: alertHistory.readAt,
      })
      .from(alertHistory)
      .where(eq(alertHistory.userId, userId))
      .orderBy(desc(alertHistory.sentAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(alertHistory)
      .where(eq(alertHistory.userId, userId)),
    db
      .select({ value: count() })
      .from(alertHistory)
      .where(
        and(eq(alertHistory.userId, userId), isNull(alertHistory.readAt)),
      ),
  ]);

  return {
    items,
    page,
    limit,
    total: totalRow?.value ?? 0,
    unreadCount: unreadRow?.value ?? 0,
  };
}

export async function setAlertHistoryReadState(
  userId: string,
  historyId: string,
  read: boolean,
) {
  const [updated] = await db
    .update(alertHistory)
    .set({ readAt: read ? new Date() : null })
    .where(
      and(eq(alertHistory.id, historyId), eq(alertHistory.userId, userId)),
    )
    .returning({ id: alertHistory.id, readAt: alertHistory.readAt });
  return updated ?? null;
}

export async function markAllAlertHistoryRead(userId: string) {
  return db
    .update(alertHistory)
    .set({ readAt: new Date() })
    .where(and(eq(alertHistory.userId, userId), isNull(alertHistory.readAt)))
    .returning({ id: alertHistory.id });
}
