import { evaluateRunningTokenAlerts } from "@sv/services/alerts/token-alert-evaluator.js";

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

function pollingIntervalMs(): number {
  const configured = Number(process.env.TOKEN_ALERT_POLL_INTERVAL_MS || 60_000);
  return Number.isFinite(configured) && configured >= 10_000 ? configured : 60_000;
}

export async function pollTokenPrices() {
  if (isPolling) {
    console.log("[token-alerts] cycle skipped: previous cycle still running");
    return null;
  }

  isPolling = true;
  try {
    return await evaluateRunningTokenAlerts();
  } catch (error) {
    console.error("[token-alerts] polling cycle failed", error);
    return null;
  } finally {
    isPolling = false;
  }
}

export async function startTokenPolling() {
  if (pollingTimer) {
    console.log("[token-alerts] polling already started");
    return;
  }

  const intervalMs = pollingIntervalMs();
  console.log("[token-alerts] polling started", { intervalMs });
  void pollTokenPrices();
  pollingTimer = setInterval(() => void pollTokenPrices(), intervalMs);
}

export function stopTokenPolling() {
  if (!pollingTimer) return;
  clearInterval(pollingTimer);
  pollingTimer = null;
  console.log("[token-alerts] polling stopped");
}
