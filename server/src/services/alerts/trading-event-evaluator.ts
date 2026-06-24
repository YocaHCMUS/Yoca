import {
  alertDelivery,
  alertHistory,
  alertState,
  alerts,
  tradingEventAlertConditions,
  tradingEventAlertTargets,
  type UserAlertTriggerMode,
  type UserTradingEventType,
} from "@sv/db/alerts.js";
import { db } from "@sv/db/index.js";
import { users } from "@sv/db/schema.js";
import { sendTradingEventAlertEmail } from "@sv/services/email.service.js";
import {
  sendDiscordWebhookPayload,
  type DiscordSendResult,
  type HeliusEnhancedTransaction,
} from "@sv/services/walletAlerts.service.js";
import { and, eq, gt, inArray } from "drizzle-orm";

const LAMPORTS_PER_SOL = 1_000_000_000;
const WSOL_MINT = "So11111111111111111111111111111111111111112";

export interface TradingEventAlertRuntime {
  id: string;
  userId: string;
  name: string;
  triggerMode: UserAlertTriggerMode;
  target: { tokenAddress: string; walletAddress: string | null };
  condition: { eventType: UserTradingEventType; minSolAmount: number | null };
  delivery: { email: string | null; discordEnabled: boolean };
  discordWebhookUrl: string | null;
}

export interface TradingEventMatch {
  alertId: string;
  matched: boolean;
  reason: string;
  eventType: UserTradingEventType;
  tokenMints: string[];
  involvedAddresses: string[];
  solAmount: number;
}

export interface TradingEventEvaluationSummary {
  signature: string | null;
  loaded: number;
  matched: number;
  delivered: number;
  duplicateSkipped: number;
  expiredStopped: number;
  results: TradingEventMatch[];
}

export interface TradingEventEvaluatorDependencies {
  stopExpiredAlerts(now: Date): Promise<number>;
  loadActiveAlerts(tokenMints: string[], now: Date): Promise<TradingEventAlertRuntime[]>;
  wasDelivered(alertId: string, signature: string): Promise<boolean>;
  recordDelivery(input: { alert: TradingEventAlertRuntime; signature: string; message: string; metadata: Record<string, unknown>; sentAt: Date }): Promise<void>;
  stopAlert(alertId: string): Promise<void>;
  sendDiscord(url: string, payload: unknown): Promise<DiscordSendResult>;
  sendEmail(email: string, input: TradingEventEmailInput): Promise<boolean>;
}

export interface TradingEventEmailInput {
  alertName: string;
  eventType: string;
  tokenAddress: string;
  walletAddress: string | null;
  solAmount: number;
  source: string | null;
  signature: string;
  emittedAt: string;
}

function log(message: string, payload: Record<string, unknown> = {}) {
  console.log(`[trading-alerts] ${message}`, JSON.stringify(payload));
}

function asNumber(value: unknown): number {
  const valueNumber = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(valueNumber) ? valueNumber : 0;
}

export function extractTradingTokenMints(tx: HeliusEnhancedTransaction): string[] {
  const mints = new Set<string>();
  for (const transfer of tx.tokenTransfers ?? []) if (transfer.mint?.trim()) mints.add(transfer.mint.trim());
  for (const account of tx.accountData ?? []) {
    for (const change of account.tokenBalanceChanges ?? []) if (change.mint?.trim()) mints.add(change.mint.trim());
  }
  const addSwapMint = (swap: NonNullable<HeliusEnhancedTransaction["events"]>["swap"] | undefined) => {
    if (!swap) return;
    for (const leg of [...(swap.tokenInputs ?? []), ...(swap.tokenOutputs ?? [])]) if (leg.mint?.trim()) mints.add(leg.mint.trim());
    for (const child of swap.innerSwaps ?? []) addSwapMint(child);
  };
  addSwapMint(tx.events?.swap);
  addSwapMint(tx.transactionEvents?.swap);
  return [...mints];
}

export function extractTradingInvolvedAddresses(tx: HeliusEnhancedTransaction): string[] {
  const values = new Set<string>();
  const add = (value: unknown) => { if (typeof value === "string" && value.trim()) values.add(value.trim()); };
  add(tx.feePayer);
  for (const transfer of tx.tokenTransfers ?? []) [transfer.fromUserAccount, transfer.toUserAccount, transfer.fromTokenAccount, transfer.toTokenAccount].forEach(add);
  for (const transfer of tx.nativeTransfers ?? []) [transfer.fromUserAccount, transfer.toUserAccount].forEach(add);
  for (const account of tx.accountData ?? []) {
    add(account.account);
    for (const change of account.tokenBalanceChanges ?? []) [change.userAccount, change.tokenAccount].forEach(add);
  }
  return [...values];
}

export function extractTradingSolAmount(tx: HeliusEnhancedTransaction): number {
  const native = (tx.nativeTransfers ?? []).map((transfer) => asNumber(transfer.amount) / LAMPORTS_PER_SOL);
  const wsol = (tx.tokenTransfers ?? []).filter((transfer) => transfer.mint === WSOL_MINT).map((transfer) => Math.abs(asNumber(transfer.tokenAmount)));
  return Math.max(0, ...native, ...wsol);
}

export function isSwapLikeTransaction(tx: HeliusEnhancedTransaction): boolean {
  const type = `${tx.type ?? ""} ${tx.source ?? ""}`.toUpperCase();
  return type.includes("SWAP") || Boolean(tx.events?.swap || tx.transactionEvents?.swap);
}

function eventTypeMatches(alert: TradingEventAlertRuntime, tx: HeliusEnhancedTransaction): boolean {
  const eventType = alert.condition.eventType;
  const swapLike = isSwapLikeTransaction(tx);
  if (eventType === "swap") return swapLike;
  if (eventType === "any_trade") return swapLike || `${tx.type ?? ""}`.toUpperCase().includes("TRADE");

  // Helius does not expose a universal buy/sell flag. Direction is best-effort:
  // the selected wallet (or fee payer) receiving the selected token is a buy;
  // sending it is a sell.
  const actor = alert.target.walletAddress ?? tx.feePayer ?? null;
  if (!actor) return false;
  const transfers = (tx.tokenTransfers ?? []).filter((transfer) => transfer.mint === alert.target.tokenAddress);
  return eventType === "buy"
    ? transfers.some((transfer) => transfer.toUserAccount === actor)
    : transfers.some((transfer) => transfer.fromUserAccount === actor);
}

export function evaluateTradingEventAlert(alert: TradingEventAlertRuntime, tx: HeliusEnhancedTransaction): TradingEventMatch {
  const tokenMints = extractTradingTokenMints(tx);
  const involvedAddresses = extractTradingInvolvedAddresses(tx);
  const solAmount = extractTradingSolAmount(tx);
  if (!tokenMints.includes(alert.target.tokenAddress)) {
    return { alertId: alert.id, matched: false, reason: "token mint mismatch", eventType: alert.condition.eventType, tokenMints, involvedAddresses, solAmount };
  }
  if (alert.target.walletAddress && !involvedAddresses.includes(alert.target.walletAddress)) {
    return { alertId: alert.id, matched: false, reason: "wallet mismatch", eventType: alert.condition.eventType, tokenMints, involvedAddresses, solAmount };
  }
  if (!eventTypeMatches(alert, tx)) {
    return { alertId: alert.id, matched: false, reason: "event type mismatch", eventType: alert.condition.eventType, tokenMints, involvedAddresses, solAmount };
  }
  if (alert.condition.minSolAmount != null && solAmount < alert.condition.minSolAmount) {
    return { alertId: alert.id, matched: false, reason: "SOL threshold not met", eventType: alert.condition.eventType, tokenMints, involvedAddresses, solAmount };
  }
  return { alertId: alert.id, matched: true, reason: "matching trading event", eventType: alert.condition.eventType, tokenMints, involvedAddresses, solAmount };
}

async function defaultStopExpiredAlerts(now: Date) {
  const rows = await db.select({ id: alerts.id }).from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .innerJoin(tradingEventAlertTargets, eq(tradingEventAlertTargets.alertId, alerts.id))
    .where(and(eq(alerts.alertType, "trading"), eq(alertState.status, "running"), gt(alerts.expiresAt, now)));
  if (rows.length) await db.update(alertState).set({ status: "stopped" }).where(inArray(alertState.alertId, rows.map((row) => row.id)));
  return rows.length;
}

async function defaultLoadActiveAlerts(tokenMints: string[], now: Date): Promise<TradingEventAlertRuntime[]> {
  if (tokenMints.length === 0) return [];
  const rows = await db.select({
    alert: alerts, target: tradingEventAlertTargets, condition: tradingEventAlertConditions,
    delivery: alertDelivery, discordWebhookUrl: users.discordWebhookUrl,
  }).from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .innerJoin(tradingEventAlertTargets, eq(tradingEventAlertTargets.alertId, alerts.id))
    .innerJoin(tradingEventAlertConditions, eq(tradingEventAlertConditions.alertId, alerts.id))
    .leftJoin(alertDelivery, eq(alertDelivery.alertId, alerts.id))
    .innerJoin(users, eq(users.id, alerts.userId))
    .where(and(eq(alerts.alertType, "trading"), eq(alertState.status, "running"), gt(alerts.expiresAt, now), inArray(tradingEventAlertTargets.tokenAddress, tokenMints)));
  return rows.map((row) => ({
    id: row.alert.id, userId: row.alert.userId, name: row.alert.name, triggerMode: row.alert.triggerMode,
    target: { tokenAddress: row.target.tokenAddress, walletAddress: row.target.walletAddress },
    condition: { eventType: row.condition.eventType, minSolAmount: row.condition.minSolAmount == null ? null : Number(row.condition.minSolAmount) },
    delivery: { email: row.delivery?.email ?? null, discordEnabled: Boolean(row.delivery?.discordEnabled) },
    discordWebhookUrl: row.discordWebhookUrl ?? null,
  }));
}

function defaultDependencies(): TradingEventEvaluatorDependencies {
  return {
    stopExpiredAlerts: defaultStopExpiredAlerts,
    loadActiveAlerts: defaultLoadActiveAlerts,
    wasDelivered: async (alertId, signature) => (await db.select({ id: alertHistory.id }).from(alertHistory).where(and(eq(alertHistory.alertId, alertId), eq(alertHistory.eventKey, signature))).limit(1)).length > 0,
    recordDelivery: async ({ alert, signature, message, metadata, sentAt }) => {
      await db.insert(alertHistory).values({ alertId: alert.id, userId: alert.userId, alertName: alert.name, message, metadata, eventKey: signature, sentAt });
    },
    stopAlert: async (alertId) => { await db.update(alertState).set({ status: "stopped" }).where(eq(alertState.alertId, alertId)); },
    sendDiscord: sendDiscordWebhookPayload,
    sendEmail: sendTradingEventAlertEmail,
  };
}

function messageFor(alert: TradingEventAlertRuntime, match: TradingEventMatch, tx: HeliusEnhancedTransaction) {
  return `${alert.name}: ${match.eventType} matched ${alert.target.tokenAddress}; ${match.solAmount.toFixed(6)} SOL observed from ${tx.source ?? "unknown source"}.`;
}

function discordPayload(alert: TradingEventAlertRuntime, match: TradingEventMatch, tx: HeliusEnhancedTransaction, emittedAt: string) {
  const signature = tx.signature ?? "unknown";
  return { username: "Yoca Alerts", embeds: [{ title: "Trading Event Alert Triggered", description: messageFor(alert, match, tx), color: 0x57f287,
    fields: [
      { name: "Alert", value: alert.name, inline: true }, { name: "Event", value: match.eventType, inline: true },
      { name: "Amount", value: `${match.solAmount.toFixed(6)} SOL`, inline: true }, { name: "Token mint", value: `\`${alert.target.tokenAddress}\``, inline: false },
      { name: "Wallet", value: alert.target.walletAddress ?? tx.feePayer ?? "any", inline: false },
      { name: "Transaction", value: `[\`${signature}\`](https://solscan.io/tx/${signature})`, inline: false },
    ], footer: { text: `source=${tx.source ?? "unknown"} | You received this because a trading event matched your configured alert.` }, timestamp: emittedAt }] };
}

export async function evaluateTradingEventTransaction(tx: HeliusEnhancedTransaction, options: { now?: Date; dependencies?: Partial<TradingEventEvaluatorDependencies> } = {}): Promise<TradingEventEvaluationSummary> {
  const now = options.now ?? new Date();
  const deps = { ...defaultDependencies(), ...options.dependencies };
  const signature = tx.signature?.trim() || null;
  const expiredStopped = await deps.stopExpiredAlerts(now);
  if (!signature) return { signature: null, loaded: 0, matched: 0, delivered: 0, duplicateSkipped: 0, expiredStopped, results: [] };
  const activeAlerts = await deps.loadActiveAlerts(extractTradingTokenMints(tx), now);
  const summary: TradingEventEvaluationSummary = { signature, loaded: activeAlerts.length, matched: 0, delivered: 0, duplicateSkipped: 0, expiredStopped, results: [] };
  for (const alert of activeAlerts) {
    const match = evaluateTradingEventAlert(alert, tx);
    summary.results.push(match);
    if (!match.matched) continue;
    summary.matched += 1;
    if (await deps.wasDelivered(alert.id, signature)) { summary.duplicateSkipped += 1; continue; }
    const emittedAt = now.toISOString();
    const message = messageFor(alert, match, tx);
    const [discord, email] = await Promise.all([
      alert.delivery.discordEnabled && alert.discordWebhookUrl ? deps.sendDiscord(alert.discordWebhookUrl, discordPayload(alert, match, tx, emittedAt)) : Promise.resolve<DiscordSendResult>({ ok: false, error: "Discord delivery not configured" }),
      alert.delivery.email ? deps.sendEmail(alert.delivery.email, { alertName: alert.name, eventType: match.eventType, tokenAddress: alert.target.tokenAddress, walletAddress: alert.target.walletAddress, solAmount: match.solAmount, source: tx.source ?? null, signature, emittedAt }) : Promise.resolve(false),
    ]);
    if (!discord.ok && !email) { log("delivery failed", { alertId: alert.id, signature }); continue; }
    await deps.recordDelivery({ alert, signature, message, sentAt: now, metadata: { eventType: match.eventType, tokenAddress: alert.target.tokenAddress, walletAddress: alert.target.walletAddress, solAmount: match.solAmount, source: tx.source ?? null, discordSent: discord.ok, emailSent: email } });
    if (alert.triggerMode === "once") await deps.stopAlert(alert.id);
    summary.delivered += 1;
    log("delivered", { alertId: alert.id, signature, triggerMode: alert.triggerMode, discordSent: discord.ok, emailSent: email });
  }
  return summary;
}
