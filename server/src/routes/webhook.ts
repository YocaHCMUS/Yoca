/**
 * Helius → single enhanced-tx stream (observable). We query `alert_rules` and
 * evaluate predicates per row before notifying — Observer pattern + predicate filtering.
 */
import { sendAlertEmail } from "@sv/services/email.service.js";
import {
  findActiveRulesForAddresses,
  markRuleOneShotFired,
  resolveRuleDelivery,
} from "@sv/services/alertRules.service.js";
import type { AlertRuleRow } from "@sv/db/schema.js";
import { Hono } from "hono";

interface HeliusTokenTransfer {
  mint?: string;
  tokenAmount?: number;
  fromUserAccount?: string;
  toUserAccount?: string;
}

interface HeliusNativeTransfer {
  amount?: number;
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
  /** Optional: user-defined label for embeds (rule name). */
  displayTitle?: string;
}

const WEBHOOK_AUTH_KEY = "thisisphuonglekey";
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1_000_000_000;
/** Implied USD/SOL for converting Helius native amounts to USD when rules use `volumeUnit: USD`. */
const WEBHOOK_SOL_PRICE_USD = Number(process.env.WEBHOOK_SOL_PRICE_USD || "150");

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

function transactionMatchesActionType(
  txType: string,
  ruleAction: AlertRuleRow["actionType"],
): boolean {
  const t = (txType || "").toUpperCase();
  if (ruleAction === "ALL") return true;
  if (ruleAction === "SWAP") {
    return t === "SWAP" || t.includes("SWAP");
  }
  if (ruleAction === "TRANSFER") {
    return t === "TRANSFER" || t.includes("TRANSFER");
  }
  return false;
}

/**
 * Choose a single comparable SOL notional for predicate evaluation.
 * Aligned with `actionType`: swap-heavy paths use swap + wrapped SOL; transfers stress SOL legs.
 */
function solNotionalForRule(
  event: NormalizedAlertEvent,
  ruleAction: AlertRuleRow["actionType"],
): number {
  if (ruleAction === "TRANSFER") {
    return Math.max(event.nativeTransferSolMax, event.nativeTransferSolTotal);
  }
  if (ruleAction === "SWAP") {
    return Math.max(event.swapSolAmount, event.nativeTransferSolMax);
  }
  return Math.max(
    event.swapSolAmount,
    event.nativeTransferSolMax,
    event.nativeTransferSolTotal,
  );
}

function volumePredicateMatches(
  rule: AlertRuleRow,
  valueSol: number,
  valueUsd: number,
): boolean {
  const min = Number(rule.minVolume);
  const max = rule.maxVolume == null ? null : Number(rule.maxVolume);
  const v = rule.volumeUnit === "SOL" ? valueSol : valueUsd;
  if (Number.isNaN(v) || !Number.isFinite(v)) return false;
  if (v < min) return false;
  if (max != null && v > max) return false;
  return true;
}

function buildStructuredAlert(
  rule: AlertRuleRow,
  event: NormalizedAlertEvent,
  solNotional: number,
  usdNotional: number,
): StructuredAlert {
  const volStr =
    rule.volumeUnit === "SOL"
      ? `${solNotional.toFixed(4)} SOL`
      : `$${usdNotional.toFixed(2)} (≈${solNotional.toFixed(4)} SOL)`;

  const title = rule.name?.trim() || `Rule #${rule.id}`;
  const message = `${title}: ${event.type} · notion ${volStr}`;

  const severity: StructuredAlert["severity"] =
    rule.volumeUnit === "SOL" && solNotional >= 50 ? "high" : "medium";

  return {
    rule: `alert-rule:${rule.id}`,
    severity,
    message,
    event,
    emittedAt: new Date().toISOString(),
    displayTitle: title,
  };
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
  const title = alert.displayTitle || alert.rule;

  return {
    username: "Yoca Alerts",
    embeds: [
      {
        title,
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
): Promise<boolean> {
  try {
    const res = await fetch(discordUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toDiscordPayload(alert)),
    });
    return res.ok;
  } catch (error) {
    console.error("[alert] failed to send to Discord:", discordUrl, error);
    return false;
  }
}

/** Observer + predicate filter: notify only when DB rule predicates match. */
async function dispatchRuleAlert(
  rule: AlertRuleRow,
  alert: StructuredAlert,
): Promise<boolean> {
  console.log("[alert-rule]", JSON.stringify({ ruleId: rule.id, ...alert }));

  const { discordUrl, email } = await resolveRuleDelivery(rule);
  let ok = false;

  if (discordUrl) {
    const sent = await sendToDiscordUrl(alert, discordUrl);
    if (sent) ok = true;
  }

  if (email) {
    const mailOk = await sendAlertEmail(email, {
      rule: alert.rule,
      severity: alert.severity,
      message: alert.message,
      signature: alert.event.signature,
      txType: alert.event.type,
      feePayer: alert.event.feePayer,
      source: alert.event.source,
      swapSolAmount: alert.event.swapSolAmount,
      emittedAt: alert.emittedAt,
    });
    if (mailOk) ok = true;
  }

  if (!discordUrl && !email) {
    console.warn(
      "[alert-rule] no delivery channel resolved for rule",
      rule.id,
      "user",
      rule.userId,
    );
  }

  return ok;
}

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
        const involvedAddresses = extractInvolvedAddresses(tx);
        const rules = await findActiveRulesForAddresses(involvedAddresses);

        for (const rule of rules) {
          if (!involvedAddresses.includes(rule.walletAddress)) continue;
          if (!transactionMatchesActionType(tx.type || "", rule.actionType)) {
            continue;
          }

          const solNotional = solNotionalForRule(event, rule.actionType);
          const usdNotional = solNotional * WEBHOOK_SOL_PRICE_USD;

          if (!volumePredicateMatches(rule, solNotional, usdNotional)) {
            continue;
          }

          const structured = buildStructuredAlert(rule, event, solNotional, usdNotional);
          const delivered = await dispatchRuleAlert(rule, structured);

          if (delivered && rule.triggerType === "ONCE") {
            await markRuleOneShotFired(rule.id);
          }
        }
      }
    }
  } catch (error) {
    console.error("[helius-webhook] failed to parse payload:", error);
  }

  return c.text("Webhook received", 200);
});

export default app;
