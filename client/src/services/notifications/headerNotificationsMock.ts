import type { AlertNotification } from "@/types/profile";

const TODAY = "2026-04-07";

export const headerNotificationsMockData: AlertNotification[] = [
    {
        id: "global-note-1",
        timestamp: `${TODAY}T10:25:00Z`,
        message: "SOL breached your $210 target.",
        severity: "warning",
    },
    {
        id: "global-note-2",
        timestamp: `${TODAY}T09:55:00Z`,
        message: "Portfolio drawdown crossed 8.0%.",
        severity: "critical",
    },
    {
        id: "global-note-3",
        timestamp: `${TODAY}T08:44:00Z`,
        message: "New high-volume signal detected for JUP.",
        severity: "info",
    },
];