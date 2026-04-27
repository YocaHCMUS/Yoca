import { getDiscordUrlsForAddress } from "@sv/services/followedWallets.service.js";
import { Hono } from "hono";

interface HeliusTokenTransfer {
  mint?: string;
  tokenAmount?: number;
  fromUserAccount?: string;
  toUserAccount?: string;
}

interface HeliusNativeTransfer {
  amount?: number; // lamports
  fromUserAccount?: string;
  toUserAccount?: string;
}

interface HeliusAccountData {
  account?: string;
}

interface HeliusEnhancedTransaction {
  signature: string;
  type: string;
  description?: string;
  timestamp?: number;
  feePayer?: string;
  source?: string;
  tokenTransfers?: HeliusTokenTransfer[];
  nativeTransfers?: HeliusNativeTransfer[];
  accountData?: HeliusAccountData[];
}

interface NormalizedAlertEvent {
  signature: string;
  type: string;
  description: string;
  timestamp: number | null;
  feePayer: string | null;
  source: string | null;
  swapSolAmount: number;
  nativeTransferSolTotal: number;
  nativeTransferSolMax: number;
}

interface StructuredAlert {
  rule: string;
  severity: "low" | "medium" | "high";
  message: string;
  event: NormalizedAlertEvent;
  emittedAt: string;
}

const WEBHOOK_AUTH_KEY = "thisisphuonglekey";
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1_000_000_000;
const SWAP_ALERT_SOL_THRESHOLD = Number(
  process.env.WEBHOOK_SWAP_ALERT_SOL_THRESHOLD || 1,
);
const ALERT_FORWARD_WEBHOOK_URL = process.env.ALERT_FORWARD_WEBHOOK_URL || "";
const processedSignatures = new Set<string>();
const MAX_SIGNATURE_CACHE_SIZE = 10_000;

function toFixedAmount(num: number): number {
  return Number(num.toFixed(9));
}

function extractSwapSolAmount(tx: HeliusEnhancedTransaction): number {
  const tokenTransfers = tx.tokenTransfers || [];
  const solTokenAmounts = tokenTransfers
    .filter((t) => t.mint === WSOL_MINT && typeof t.tokenAmount === "number")
    .map((t) => Math.abs(t.tokenAmount as number));
  if (solTokenAmounts.length > 0) {
    return toFixedAmount(Math.max(...solTokenAmounts));
  }

  const nativeTransfers = tx.nativeTransfers || [];
  const lamports = nativeTransfers
    .map((t) => t.amount || 0)
    .filter((amount) => amount > 0);
  if (lamports.length === 0) {
    return 0;
  }
  return toFixedAmount(Math.max(...lamports) / LAMPORTS_PER_SOL);
}

function normalizeAlertEvent(tx: HeliusEnhancedTransaction): NormalizedAlertEvent {
  const nativeTransfers = tx.nativeTransfers || [];
  const nativeSolAmounts = nativeTransfers
    .map((t) => (t.amount || 0) / LAMPORTS_PER_SOL)
    .filter((amount) => amount > 0);
  const nativeTransferSolTotal = toFixedAmount(
    nativeSolAmounts.reduce((sum, amount) => sum + amount, 0),
  );
  const nativeTransferSolMax = toFixedAmount(
    nativeSolAmounts.length > 0 ? Math.max(...nativeSolAmounts) : 0,
  );

  return {
    signature: tx.signature,
    type: tx.type || "UNKNOWN",
    description: tx.description || "",
    timestamp: tx.timestamp ?? null,
    feePayer: tx.feePayer ?? null,
    source: tx.source ?? null,
    swapSolAmount: extractSwapSolAmount(tx),
    nativeTransferSolTotal,
    nativeTransferSolMax,
  };
}

function evaluateAlertRules(event: NormalizedAlertEvent): StructuredAlert[] {
  const alerts: StructuredAlert[] = [];

  if (event.type === "SWAP" && event.swapSolAmount >= SWAP_ALERT_SOL_THRESHOLD) {
    alerts.push({
      rule: "swap-sol-threshold",
      severity: event.swapSolAmount >= SWAP_ALERT_SOL_THRESHOLD * 5 ? "high" : "medium",
      message: `Large swap detected: ${event.swapSolAmount} SOL (threshold: ${SWAP_ALERT_SOL_THRESHOLD} SOL)`,
      event,
      emittedAt: new Date().toISOString(),
    });
  }

  return alerts;
}

/** Collect all unique addresses involved in a transaction. */
function extractInvolvedAddresses(tx: HeliusEnhancedTransaction): string[] {
  const addrs = new Set<string>();
  if (tx.feePayer) addrs.add(tx.feePayer);
  for (const a of tx.accountData || []) {
    if (a.account) addrs.add(a.account);
  }
  for (const t of tx.nativeTransfers || []) {
    if (t.fromUserAccount) addrs.add(t.fromUserAccount);
    if (t.toUserAccount) addrs.add(t.toUserAccount);
  }
  for (const t of tx.tokenTransfers || []) {
    if (t.fromUserAccount) addrs.add(t.fromUserAccount);
    if (t.toUserAccount) addrs.add(t.toUserAccount);
  }
  return [...addrs];
}

// ── Discord formatting ─────────────────────────────────────────────

function toSeverityColor(severity: StructuredAlert["severity"]): number {
  if (severity === "high") return 0xed4245;
  if (severity === "medium") return 0xfee75c;
  return 0x57f287;
}

function toDiscordPayload(alert: StructuredAlert) {
  const ts = alert.event.timestamp
    ? new Date(alert.event.timestamp * 1000).toISOString()
    : "unknown";
  const signature = alert.event.signature;
  const txUrl = `https://solscan.io/tx/${signature}`;

  return {
    username: "Yoca Alerts",
    embeds: [
      {
        title: `Alert: ${alert.rule}`,
        description: alert.message,
        color: toSeverityColor(alert.severity),
        fields: [
          { name: "Severity", value: alert.severity, inline: true },
          { name: "Type", value: alert.event.type || "UNKNOWN", inline: true },
          {
            name: "Swap (SOL)",
            value: String(alert.event.swapSolAmount),
            inline: true,
          },
          {
            name: "Fee Payer",
            value: alert.event.feePayer || "unknown",
            inline: false,
          },
          {
            name: "Signature",
            value: `[\`${signature}\`](${txUrl})`,
            inline: false,
          },
        ],
        footer: {
          text: `source=${alert.event.source || "unknown"} | tx_ts=${ts}`,
        },
        timestamp: alert.emittedAt,
      },
    ],
  };
}

async function sendToDiscordUrl(
  alert: StructuredAlert,
  discordUrl: string,
): Promise<void> {
  try {
    await fetch(discordUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toDiscordPayload(alert)),
    });
  } catch (error) {
    console.error("[alert] failed to send to Discord:", discordUrl, error);
  }
}

// ── Alert dispatch (fan-out + legacy global) ───────────────────────

async function dispatchAlert(
  alert: StructuredAlert,
  involvedAddresses: string[],
): Promise<void> {
  console.log("[alert]", JSON.stringify(alert));

  // Fan-out: per-user Discord URLs from DB
  const urlSet = new Set<string>();
  for (const addr of involvedAddresses) {
    const urls = await getDiscordUrlsForAddress(addr);
    for (const u of urls) urlSet.add(u);
  }
  const fanOutPromises = [...urlSet].map((url) => sendToDiscordUrl(alert, url));

  // Legacy global admin channel (env-based)
  if (ALERT_FORWARD_WEBHOOK_URL && !urlSet.has(ALERT_FORWARD_WEBHOOK_URL)) {
    const isDiscord = ALERT_FORWARD_WEBHOOK_URL.includes(
      "discord.com/api/webhooks/",
    );
    fanOutPromises.push(
      fetch(ALERT_FORWARD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isDiscord ? toDiscordPayload(alert) : alert),
      })
        .then(() => {})
        .catch((err) =>
          console.error("[alert] global forward failed:", err),
        ),
    );
  }

  await Promise.allSettled(fanOutPromises);
}

// ── Hono route ─────────────────────────────────────────────────────

const app = new Hono().post("/", async (c) => {
  const authorization = c.req.header("Authorization");
  if (authorization !== WEBHOOK_AUTH_KEY) {
    return c.text("Unauthorized", 401);
  }

  try {
    const transactions = await c.req.json<HeliusEnhancedTransaction[]>();
    if (Array.isArray(transactions)) {
      for (const tx of transactions) {
        if (!tx?.signature || processedSignatures.has(tx.signature)) {
          continue;
        }

        processedSignatures.add(tx.signature);
        if (processedSignatures.size > MAX_SIGNATURE_CACHE_SIZE) {
          const oldest = processedSignatures.values().next().value;
          if (oldest) processedSignatures.delete(oldest);
        }

        console.log(
          "[helius-webhook]",
          "signature:",
          tx.signature,
          "type:",
          tx.type,
          "description:",
          tx.description,
        );

        const event = normalizeAlertEvent(tx);
        const alerts = evaluateAlertRules(event);
        const involvedAddresses = extractInvolvedAddresses(tx);
        for (const alert of alerts) {
          await dispatchAlert(alert, involvedAddresses);
        }
      }
    }
  } catch (error) {
    console.error("[helius-webhook] failed to parse payload:", error);
  }

  return c.text("Webhook received", 200);
});

export default app;
