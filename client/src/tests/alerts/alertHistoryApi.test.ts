import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getHistory: vi.fn(),
  setRead: vi.fn(),
  readAll: vi.fn(),
}));

vi.mock("@/api/main", () => ({
  default: {
    api: {
      alerts: {
        history: {
          $get: apiMocks.getHistory,
          ":historyId": { read: { $patch: apiMocks.setRead } },
          "read-all": { $patch: apiMocks.readAll },
        },
      },
    },
  },
}));

import {
  getAlertHistory,
  markAllAlertHistoryRead,
  setAlertHistoryRead,
} from "@/services/notifications/alertHistoryApi";

describe("alertHistoryApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps server history into profile notifications", async () => {
    apiMocks.getHistory.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "history-1",
            source: "rule",
            advancedRuleId: 12,
            alertId: null,
            eventSignature: "signature-1",
            walletAddress: "wallet-1",
            alertName: "Large swap",
            message: "Observed a large swap",
            severity: "high-from-legacy-source",
            emailAttempted: true,
            emailSucceeded: true,
            discordAttempted: true,
            discordSucceeded: false,
            sentAt: "2026-07-12T08:00:00.000Z",
            readAt: null,
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        unreadCount: 1,
      }),
    });

    const result = await getAlertHistory();

    expect(apiMocks.getHistory).toHaveBeenCalledWith({
      query: { page: "1", limit: "20" },
    });
    expect(result.notifications[0]).toEqual({
      id: "history-1",
      timestamp: "2026-07-12T08:00:00.000Z",
      title: "Large swap",
      message: "Observed a large swap",
      severity: "info",
      readAt: null,
      source: "rule",
      walletAddress: "wallet-1",
      eventSignature: "signature-1",
      emailSucceeded: true,
      discordSucceeded: false,
    });
    expect(result.unreadCount).toBe(1);
  });

  it("updates read state and mark-all through authenticated API routes", async () => {
    apiMocks.setRead.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "history-1", readAt: "2026-07-12T09:00:00.000Z" }),
    });
    apiMocks.readAll.mockResolvedValue({
      ok: true,
      json: async () => ({ updatedCount: 3 }),
    });

    await expect(setAlertHistoryRead("history-1", true)).resolves.toEqual({
      id: "history-1",
      readAt: "2026-07-12T09:00:00.000Z",
    });
    expect(apiMocks.setRead).toHaveBeenCalledWith({
      param: { historyId: "history-1" },
      json: { read: true },
    });
    await expect(markAllAlertHistoryRead()).resolves.toEqual({ updatedCount: 3 });
  });

  it("rejects non-success history responses", async () => {
    apiMocks.getHistory.mockResolvedValue({ ok: false, status: 500 });
    await expect(getAlertHistory()).rejects.toThrow("Failed to load alert history: 500");
  });
});
