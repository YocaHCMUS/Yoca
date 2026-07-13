import client from "@/api/main";
import type { AlertNotification } from "@/types/profile";

export type AlertHistoryResult = {
  notifications: AlertNotification[];
  page: number;
  limit: number;
  total: number;
  unreadCount: number;
};

export async function getAlertHistory(
  page: number = 1,
  limit: number = 20,
): Promise<AlertHistoryResult> {
  const response = await client.api.alerts.history.$get({
    query: { page: String(page), limit: String(limit) },
  });
  if (!response.ok) {
    throw new Error(`Failed to load alert history: ${response.status}`);
  }
  const payload = await response.json();
  return {
    notifications: payload.items.map((item) => ({
      id: item.id,
      timestamp: item.sentAt,
      title: item.alertName,
      message: item.message,
      severity:
        item.severity == "critical"
          ? "critical"
          : item.severity == "warning"
            ? "warning"
            : "info",
      readAt: item.readAt,
      source: item.source,
      walletAddress: item.walletAddress,
      eventSignature: item.eventSignature,
      emailSucceeded: item.emailSucceeded,
      discordSucceeded: item.discordSucceeded,
    })),
    page: payload.page,
    limit: payload.limit,
    total: payload.total,
    unreadCount: payload.unreadCount,
  };
}

export async function setAlertHistoryRead(
  historyId: string,
  read: boolean,
) {
  const response = await client.api.alerts.history[":historyId"].read.$patch({
    param: { historyId },
    json: { read },
  });
  if (!response.ok) {
    throw new Error(`Failed to update alert history: ${response.status}`);
  }
  return response.json();
}

export async function markAllAlertHistoryRead() {
  const response = await client.api.alerts.history["read-all"].$patch();
  if (!response.ok) {
    throw new Error(`Failed to mark alert history as read: ${response.status}`);
  }
  return response.json();
}
