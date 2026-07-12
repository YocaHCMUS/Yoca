import type { AlertRuleRow } from "@sv/db/schema.js";
import {
  findActiveRulesForAddresses,
  markRuleOneShotFired,
  resolveRuleDelivery,
  type DeliveryResolution,
} from "@sv/services/alertRules.service.js";
import { sendAlertEmail } from "@sv/services/email.service.js";
import { recordAlertHistory } from "@sv/services/alertHistory.service.js";
import {
  findFollowedWalletDeliveryTargetsForAddresses,
  type FollowedWalletDeliveryTarget,
} from "@sv/services/followedWallets.service.js";

interface HeliusTokenTransfer {
  mint?: string;
  tokenAmount?: number | string;
  fromUserAccount?: string;
  toUserAccount?: string;
  fromTokenAccount?: string;
  toTokenAccount?: string;
}

interface HeliusNativeTransfer {
  amount?: number | string;
  fromUserAccount?: string;
  toUserAccount?: string;
}

interface HeliusTokenBalanceChange {
  userAccount?: string;
  tokenAccount?: string;
  mint?: string;
}

interface HeliusAccountData {
  account?: string;
  tokenBalanceChanges?: HeliusTokenBalanceChange[];
}

interface HeliusSwapNativeLeg {
  amount?: number | string;
  userAccount?: string;
  account?: string;
  source?: string;
  destination?: string;
}

interface HeliusSwapTokenLeg {
  mint?: string;
  tokenAmount?: number | string;
  amount?: number | string;
  userAccount?: string;
  tokenAccount?: string;
  fromUserAccount?: string;
  toUserAccount?: string;
  fromTokenAccount?: string;
  toTokenAccount?: string;
  source?: string;
  destination?: string;
  sourceTokenAccount?: string;
  destinationTokenAccount?: string;
}

interface HeliusSwapEvent {
  user?: string;
  userAccount?: string;
  source?: string;
  destination?: string;
  nativeInput?: HeliusSwapNativeLeg;
  nativeOutput?: HeliusSwapNativeLeg;
  tokenInputs?: HeliusSwapTokenLeg[];
  tokenOutputs?: HeliusSwapTokenLeg[];
  innerSwaps?: HeliusSwapEvent[];
}

export interface HeliusEnhancedTransaction {
  signature?: string;
  type?: string;
  description?: string;
  timestamp?: number;
  feePayer?: string;
  source?: string;
  tokenTransfers?: HeliusTokenTransfer[];
  nativeTransfers?: HeliusNativeTransfer[];
  accountData?: HeliusAccountData[];
  transactionEvents?: {
    swap?: HeliusSwapEvent;
  };
  events?: {
    swap?: HeliusSwapEvent;
  };
}

export interface NormalizedAlertEvent {
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

export interface StructuredAlert {
  rule: string;
  severity: "low" | "medium" | "high";
  message: string;
  event: NormalizedAlertEvent;
  emittedAt: string;
  displayTitle?: string;
}

export interface DiscordSendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export interface ChannelDispatchResult {
  channel: "discord" | "email";
  attempted: boolean;
  ok: boolean;
  dryRun: boolean;
  skippedReason?: string;
  status?: number;
  error?: string;
}

export interface DeliveryDispatchResult {
  scope: "rule" | "followed-wallet";
  userId: string;
  walletAddress: string;
  ruleId?: number;
  discord: ChannelDispatchResult;
  email: ChannelDispatchResult;
  anyAttempted: boolean;
  anySucceeded: boolean;
}

export interface AlertEventProcessingResult {
  signature: string | null;
  type: string;
  duplicate: boolean;
  involvedAddresses: string[];
  matchedFollowedWallets: Array<{
    userId: string;
    walletAddress: string;
    label: string | null;
  }>;
  matchedRules: Array<{
    ruleId: number;
    userId: string;
    walletAddress: string;
    actionType: AlertRuleRow["actionType"];
    delivered: boolean;
  }>;
  skippedRules: Array<{
    ruleId: number;
    reason: string;
    actionType: AlertRuleRow["actionType"];
    solNotional?: number;
    usdNotional?: number;
  }>;
  deliveries: DeliveryDispatchResult[];
}

export interface AlertProcessingSummary {
  received: number;
  processed: number;
  duplicates: number;
  invalid: number;
  rulesMatched: number;
  rulesDelivered: number;
  followedWalletMatches: number;
  followedWalletDelivered: number;
  dispatchFailures: number;
  dryRun: boolean;
  events: AlertEventProcessingResult[];
}

export interface WalletAlertPipelineDependencies {
  findActiveRulesForAddresses: typeof findActiveRulesForAddresses;
  findFollowedWalletDeliveryTargetsForAddresses: typeof findFollowedWalletDeliveryTargetsForAddresses;
  resolveRuleDelivery: typeof resolveRuleDelivery;
  markRuleOneShotFired: typeof markRuleOneShotFired;
  sendDiscord: (
    alert: StructuredAlert,
    discordUrl: string,
  ) => Promise<DiscordSendResult>;
  sendEmail: (email: string, alert: StructuredAlert) => Promise<boolean>;
  recordHistory: typeof recordAlertHistory;
}

export interface ProcessHeliusWebhookOptions {
  dryRun?: boolean;
  dedupe?: boolean;
  log?: boolean;
  dependencies?: Partial<WalletAlertPipelineDependencies>;
}

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1_000_000_000;
const MAX_SIGNATURE_CACHE_SIZE = 10_000;
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const processedSignatures = new Set<string>();

function webhookSolPriceUsd(): number {
  const configured = Number(process.env.WEBHOOK_SOL_PRICE_USD || "150");
  return Number.isFinite(configured) && configured > 0 ? configured : 150;
}

function logAlertPipeline(message: string, payload: Record<string, unknown>) {
  console.log(`[helius-alerts] ${message}`, JSON.stringify(payload));
}

function logAlertPipelineWarn(message: string, payload: Record<string, unknown>) {
  console.warn(`[helius-alerts] ${message}`, JSON.stringify(payload));
}

function shouldLog(options: ProcessHeliusWebhookOptions): boolean {
  return options.log !== false;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeAddress(value: unknown): string | null {
  const trimmed = normalizeString(value);
  if (!trimmed) return null;
  if (trimmed.length < 32 || trimmed.length > 44) return null;
  if (!SOLANA_BASE58_RE.test(trimmed)) return null;
  return trimmed;
}

function normalizeAddressList(values: string[]): string[] {
  return [...new Set(values.map(normalizeAddress).filter(Boolean) as string[])];
}

function addAddress(addrs: Set<string>, value: unknown) {
  const normalized = normalizeAddress(value);
  if (normalized) addrs.add(normalized);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function toFixedAmount(num: number): number {
  return Number(num.toFixed(9));
}

function nativeAmountToSol(value: unknown): number {
  const amount = toNumber(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount / LAMPORTS_PER_SOL;
}

function extractSwapEvents(tx: HeliusEnhancedTransaction): HeliusSwapEvent[] {
  const events: HeliusSwapEvent[] = [];
  if (tx.transactionEvents?.swap) events.push(tx.transactionEvents.swap);
  if (tx.events?.swap) events.push(tx.events.swap);
  return events;
}

function collectSwapAddresses(swap: HeliusSwapEvent | undefined, addrs: Set<string>) {
  if (!swap) return;
  addAddress(addrs, swap.user);
  addAddress(addrs, swap.userAccount);
  addAddress(addrs, swap.source);
  addAddress(addrs, swap.destination);

  for (const nativeLeg of [swap.nativeInput, swap.nativeOutput]) {
    if (!nativeLeg) continue;
    addAddress(addrs, nativeLeg.userAccount);
    addAddress(addrs, nativeLeg.account);
    addAddress(addrs, nativeLeg.source);
    addAddress(addrs, nativeLeg.destination);
  }

  for (const tokenLeg of [...(swap.tokenInputs || []), ...(swap.tokenOutputs || [])]) {
    addAddress(addrs, tokenLeg.userAccount);
    addAddress(addrs, tokenLeg.tokenAccount);
    addAddress(addrs, tokenLeg.fromUserAccount);
    addAddress(addrs, tokenLeg.toUserAccount);
    addAddress(addrs, tokenLeg.fromTokenAccount);
    addAddress(addrs, tokenLeg.toTokenAccount);
    addAddress(addrs, tokenLeg.source);
    addAddress(addrs, tokenLeg.destination);
    addAddress(addrs, tokenLeg.sourceTokenAccount);
    addAddress(addrs, tokenLeg.destinationTokenAccount);
  }

  for (const inner of swap.innerSwaps || []) {
    collectSwapAddresses(inner, addrs);
  }
}

function extractSwapSolAmountFromEvents(tx: HeliusEnhancedTransaction): number {
  const amounts: number[] = [];
  for (const swap of extractSwapEvents(tx)) {
    for (const nativeLeg of [swap.nativeInput, swap.nativeOutput]) {
      const sol = nativeAmountToSol(nativeLeg?.amount);
      if (sol > 0) amounts.push(sol);
    }
    for (const tokenLeg of [...(swap.tokenInputs || []), ...(swap.tokenOutputs || [])]) {
      if (tokenLeg.mint !== WSOL_MINT) continue;
      const amount = toNumber(tokenLeg.tokenAmount ?? tokenLeg.amount);
      if (Number.isFinite(amount) && amount > 0) amounts.push(amount);
    }
    for (const inner of swap.innerSwaps || []) {
      const innerAmount = extractSwapSolAmountFromEvents({ events: { swap: inner } });
      if (innerAmount > 0) amounts.push(innerAmount);
    }
  }
  return amounts.length > 0 ? toFixedAmount(Math.max(...amounts)) : 0;
}

export function extractSwapSolAmount(tx: HeliusEnhancedTransaction): number {
  const eventAmount = extractSwapSolAmountFromEvents(tx);
  if (eventAmount > 0) return eventAmount;

  const tokenTransfers = tx.tokenTransfers || [];
  const solTokenAmounts = tokenTransfers
    .filter((t) => t.mint === WSOL_MINT)
    .map((t) => Math.abs(toNumber(t.tokenAmount)))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  if (solTokenAmounts.length > 0) {
    return toFixedAmount(Math.max(...solTokenAmounts));
  }

  const nativeTransfers = tx.nativeTransfers || [];
  const solAmounts = nativeTransfers
    .map((t) => nativeAmountToSol(t.amount))
    .filter((amount) => amount > 0);
  if (solAmounts.length === 0) return 0;
  return toFixedAmount(Math.max(...solAmounts));
}

export function normalizeAlertEvent(
  tx: HeliusEnhancedTransaction,
): NormalizedAlertEvent {
  const nativeSolAmounts = (tx.nativeTransfers || [])
    .map((t) => nativeAmountToSol(t.amount))
    .filter((amount) => amount > 0);
  const nativeTransferSolTotal = toFixedAmount(
    nativeSolAmounts.reduce((sum, amount) => sum + amount, 0),
  );
  const nativeTransferSolMax = toFixedAmount(
    nativeSolAmounts.length > 0 ? Math.max(...nativeSolAmounts) : 0,
  );

  return {
    signature: tx.signature?.trim() || "",
    type: tx.type?.trim() || "UNKNOWN",
    description: tx.description || "",
    timestamp: tx.timestamp ?? null,
    feePayer: normalizeAddress(tx.feePayer),
    source: tx.source ?? null,
    swapSolAmount: extractSwapSolAmount(tx),
    nativeTransferSolTotal,
    nativeTransferSolMax,
  };
}

export function extractInvolvedAddresses(tx: HeliusEnhancedTransaction): string[] {
  const addrs = new Set<string>();
  addAddress(addrs, tx.feePayer);

  for (const a of tx.accountData || []) {
    addAddress(addrs, a.account);
    for (const change of a.tokenBalanceChanges || []) {
      addAddress(addrs, change.userAccount);
      addAddress(addrs, change.tokenAccount);
    }
  }

  for (const t of tx.nativeTransfers || []) {
    addAddress(addrs, t.fromUserAccount);
    addAddress(addrs, t.toUserAccount);
  }

  for (const t of tx.tokenTransfers || []) {
    addAddress(addrs, t.fromUserAccount);
    addAddress(addrs, t.toUserAccount);
    addAddress(addrs, t.fromTokenAccount);
    addAddress(addrs, t.toTokenAccount);
  }

  for (const swap of extractSwapEvents(tx)) {
    collectSwapAddresses(swap, addrs);
  }

  return [...addrs];
}

export function transactionMatchesActionType(
  txType: string,
  ruleAction: AlertRuleRow["actionType"],
): boolean {
  const t = (txType || "").trim().toUpperCase();
  if (ruleAction === "ALL") return true;
  if (ruleAction === "SWAP") return t === "SWAP" || t.includes("SWAP");
  if (ruleAction === "TRANSFER") {
    return t === "TRANSFER" || t.includes("TRANSFER");
  }
  return false;
}

export function solNotionalForRule(
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

export function volumePredicateMatches(
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

function buildStructuredRuleAlert(
  rule: AlertRuleRow,
  event: NormalizedAlertEvent,
  solNotional: number,
  usdNotional: number,
): StructuredAlert {
  const volStr =
    rule.volumeUnit === "SOL"
      ? `${solNotional.toFixed(4)} SOL`
      : `$${usdNotional.toFixed(2)} (~${solNotional.toFixed(4)} SOL)`;

  const title = rule.name?.trim() || `Rule #${rule.id}`;
  const message = `${title}: ${event.type} - notional ${volStr}`;
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

function buildFollowedWalletAlert(
  target: FollowedWalletDeliveryTarget,
  event: NormalizedAlertEvent,
): StructuredAlert {
  const label = target.label?.trim() || target.walletAddress;
  return {
    rule: `followed-wallet:${target.walletAddress}`,
    severity: "low",
    message: `${label}: ${event.type || "UNKNOWN"} activity detected`,
    event,
    emittedAt: new Date().toISOString(),
    displayTitle: `Wallet activity: ${label}`,
  };
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

export async function sendToDiscordUrl(
  alert: StructuredAlert,
  discordUrl: string,
): Promise<DiscordSendResult> {
  try {
    const res = await fetch(discordUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toDiscordPayload(alert)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 500) || `Discord HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function defaultDependencies(): WalletAlertPipelineDependencies {
  return {
    findActiveRulesForAddresses,
    findFollowedWalletDeliveryTargetsForAddresses,
    resolveRuleDelivery,
    markRuleOneShotFired,
    sendDiscord: sendToDiscordUrl,
    sendEmail: (email, alert) =>
      sendAlertEmail(email, {
        rule: alert.rule,
        severity: alert.severity,
        message: alert.message,
        signature: alert.event.signature,
        txType: alert.event.type,
        feePayer: alert.event.feePayer,
        source: alert.event.source,
        swapSolAmount: alert.event.swapSolAmount,
        emittedAt: alert.emittedAt,
      }),
    recordHistory: recordAlertHistory,
  };
}

function historySeverity(
  severity: StructuredAlert["severity"],
): "info" | "warning" | "critical" {
  if (severity == "high") return "critical";
  if (severity == "medium") return "warning";
  return "info";
}

async function persistSuccessfulDelivery(params: {
  userId: string;
  walletAddress: string;
  ruleId?: number;
  scope: DeliveryDispatchResult["scope"];
  alert: StructuredAlert;
  delivery: DeliveryDispatchResult;
  deps: WalletAlertPipelineDependencies;
}) {
  const { userId, walletAddress, ruleId, scope, alert, delivery, deps } = params;
  const scopeKey = ruleId == null ? walletAddress : String(ruleId);
  try {
    await deps.recordHistory({
      userId,
      advancedRuleId: ruleId ?? null,
      source: scope,
      eventKey: `${alert.event.signature}:${scope}:${scopeKey}`,
      eventSignature: alert.event.signature,
      walletAddress,
      alertName: alert.displayTitle?.trim() || alert.rule,
      message: alert.message,
      severity: historySeverity(alert.severity),
      emailAttempted: delivery.email.attempted,
      emailSucceeded: delivery.email.ok,
      discordAttempted: delivery.discord.attempted,
      discordSucceeded: delivery.discord.ok,
      sentAt: new Date(alert.emittedAt),
    });
  } catch (error) {
    console.error("[helius-alerts] failed to persist alert history", {
      userId,
      walletAddress,
      ruleId,
      eventSignature: alert.event.signature,
      error,
    });
  }
}

function dispatchResultSkipped(
  channel: ChannelDispatchResult["channel"],
  dryRun: boolean,
  skippedReason: string,
): ChannelDispatchResult {
  return { channel, attempted: false, ok: false, dryRun, skippedReason };
}

async function dispatchToResolvedTargets(params: {
  scope: "rule" | "followed-wallet";
  userId: string;
  walletAddress: string;
  ruleId?: number;
  alert: StructuredAlert;
  resolution: DeliveryResolution;
  options: ProcessHeliusWebhookOptions;
  deps: WalletAlertPipelineDependencies;
}): Promise<DeliveryDispatchResult> {
  const { scope, userId, walletAddress, ruleId, alert, resolution, options, deps } =
    params;
  const dryRun = Boolean(options.dryRun);
  const discordSkippedReason = resolution.skipReasons.find((reason) =>
    reason.startsWith("discord skipped:"),
  );
  const emailSkippedReason = resolution.skipReasons.find((reason) =>
    reason.startsWith("email skipped:"),
  );

  if (shouldLog(options)) {
    logAlertPipeline("delivery targets resolved", {
      scope,
      userId,
      walletAddress,
      ruleId,
      hasDiscord: Boolean(resolution.discordUrl),
      hasEmail: Boolean(resolution.email),
      skipReasons: resolution.skipReasons,
    });
  }

  let discord: ChannelDispatchResult;
  if (!resolution.discordUrl) {
    discord = dispatchResultSkipped(
      "discord",
      dryRun,
      discordSkippedReason || "discord skipped: missing webhook",
    );
  } else if (dryRun) {
    discord = { channel: "discord", attempted: true, ok: true, dryRun };
  } else {
    const sent = await deps.sendDiscord(alert, resolution.discordUrl);
    discord = {
      channel: "discord",
      attempted: true,
      ok: sent.ok,
      dryRun,
      status: sent.status,
      error: sent.error,
    };
  }

  let email: ChannelDispatchResult;
  if (!resolution.email) {
    email = dispatchResultSkipped(
      "email",
      dryRun,
      emailSkippedReason || "email skipped: no recipient",
    );
  } else if (dryRun) {
    email = { channel: "email", attempted: true, ok: true, dryRun };
  } else {
    const sent = await deps.sendEmail(resolution.email, alert);
    email = {
      channel: "email",
      attempted: true,
      ok: sent,
      dryRun,
      error: sent ? undefined : "email provider returned failure",
    };
  }

  const result: DeliveryDispatchResult = {
    scope,
    userId,
    walletAddress,
    ruleId,
    discord,
    email,
    anyAttempted: discord.attempted || email.attempted,
    anySucceeded: discord.ok || email.ok,
  };

  if (shouldLog(options)) {
    logAlertPipeline("dispatch result", {
      scope,
      userId,
      walletAddress,
      ruleId,
      discord: {
        attempted: discord.attempted,
        ok: discord.ok,
        status: discord.status,
        skippedReason: discord.skippedReason,
        error: discord.error,
      },
      email: {
        attempted: email.attempted,
        ok: email.ok,
        skippedReason: email.skippedReason,
        error: email.error,
      },
    });
  }

  return result;
}

function resolveFollowedWalletDelivery(
  target: FollowedWalletDeliveryTarget,
): DeliveryResolution {
  const skipReasons: string[] = [];
  const discordUrl = target.discordWebhookUrl?.trim() || null;
  if (!discordUrl) skipReasons.push("discord skipped: missing webhook");

  let email: string | null = null;
  if (!target.emailAlertsEnabled) {
    skipReasons.push("email skipped: disabled");
  } else {
    email =
      (target.emailAlertsAddress?.trim() || target.registeredEmail || "").trim() ||
      null;
    if (!email) skipReasons.push("email skipped: no recipient");
  }

  return { discordUrl, email, skipReasons };
}

function addProcessedSignature(signature: string) {
  processedSignatures.add(signature);
  if (processedSignatures.size > MAX_SIGNATURE_CACHE_SIZE) {
    const oldest = processedSignatures.values().next().value;
    if (oldest) processedSignatures.delete(oldest);
  }
}

function ruleKey(userId: string, walletAddress: string, signature: string): string {
  return `${userId}:${walletAddress}:${signature}`;
}

function buildEmptyEventResult(
  tx: HeliusEnhancedTransaction,
): AlertEventProcessingResult {
  return {
    signature: tx.signature?.trim() || null,
    type: tx.type?.trim() || "UNKNOWN",
    duplicate: false,
    involvedAddresses: [],
    matchedFollowedWallets: [],
    matchedRules: [],
    skippedRules: [],
    deliveries: [],
  };
}

export function resetProcessedWebhookSignaturesForTests(): void {
  processedSignatures.clear();
}

export async function processHeliusWebhookTransactions(
  transactions: HeliusEnhancedTransaction[],
  options: ProcessHeliusWebhookOptions = {},
): Promise<AlertProcessingSummary> {
  const deps = { ...defaultDependencies(), ...options.dependencies };
  const dryRun = Boolean(options.dryRun);
  const dedupe = options.dedupe ?? !dryRun;
  const summary: AlertProcessingSummary = {
    received: transactions.length,
    processed: 0,
    duplicates: 0,
    invalid: 0,
    rulesMatched: 0,
    rulesDelivered: 0,
    followedWalletMatches: 0,
    followedWalletDelivered: 0,
    dispatchFailures: 0,
    dryRun,
    events: [],
  };

  if (shouldLog(options)) {
    logAlertPipeline("received webhook batch", {
      eventCount: transactions.length,
      dryRun,
      dedupe,
    });
  }

  for (const tx of transactions) {
    const eventResult = buildEmptyEventResult(tx);
    summary.events.push(eventResult);

    const signature = tx.signature?.trim();
    if (!signature) {
      summary.invalid += 1;
      if (shouldLog(options)) {
        logAlertPipelineWarn("event skipped: missing signature", {
          type: tx.type || "UNKNOWN",
        });
      }
      continue;
    }

    if (dedupe && processedSignatures.has(signature)) {
      summary.duplicates += 1;
      eventResult.duplicate = true;
      if (shouldLog(options)) {
        logAlertPipeline("event skipped: duplicate signature", { signature });
      }
      continue;
    }
    if (dedupe) addProcessedSignature(signature);

    summary.processed += 1;
    const event = normalizeAlertEvent(tx);
    const involvedAddresses = extractInvolvedAddresses(tx);
    const involvedAddressSet = new Set(normalizeAddressList(involvedAddresses));
    eventResult.involvedAddresses = [...involvedAddressSet];

    const [followedMatches, candidateRules] = await Promise.all([
      deps.findFollowedWalletDeliveryTargetsForAddresses([...involvedAddressSet]),
      deps.findActiveRulesForAddresses([...involvedAddressSet]),
    ]);

    eventResult.matchedFollowedWallets = followedMatches.map((match) => ({
      userId: match.userId,
      walletAddress: match.walletAddress,
      label: match.label,
    }));
    summary.followedWalletMatches += followedMatches.length;

    if (shouldLog(options)) {
      logAlertPipeline("event inspection", {
        signature,
        type: event.type,
        involvedAddresses: eventResult.involvedAddresses,
        matchingFollowedWallets: eventResult.matchedFollowedWallets,
        candidateRuleIds: candidateRules.map((rule) => rule.id),
      });
    }

    const ruleDeliveryKeys = new Set<string>();
    for (const rule of candidateRules) {
      const ruleWallet = normalizeAddress(rule.walletAddress);
      const solNotional = solNotionalForRule(event, rule.actionType);
      const usdNotional = solNotional * webhookSolPriceUsd();

      if (!ruleWallet || !involvedAddressSet.has(ruleWallet)) {
        eventResult.skippedRules.push({
          ruleId: rule.id,
          reason: "rule skipped: wallet address mismatch",
          actionType: rule.actionType,
        });
        continue;
      }

      if (!transactionMatchesActionType(event.type, rule.actionType)) {
        const skipped = {
          ruleId: rule.id,
          reason: "rule skipped: action type mismatch",
          actionType: rule.actionType,
          solNotional,
          usdNotional,
        };
        eventResult.skippedRules.push(skipped);
        if (shouldLog(options)) {
          logAlertPipeline("rule skipped: action type mismatch", {
            signature,
            type: event.type,
            ruleId: rule.id,
            actionType: rule.actionType,
          });
        }
        continue;
      }

      if (!volumePredicateMatches(rule, solNotional, usdNotional)) {
        const skipped = {
          ruleId: rule.id,
          reason: "rule skipped: threshold not met",
          actionType: rule.actionType,
          solNotional,
          usdNotional,
        };
        eventResult.skippedRules.push(skipped);
        if (shouldLog(options)) {
          logAlertPipeline("rule skipped: threshold not met", {
            signature,
            ruleId: rule.id,
            actionType: rule.actionType,
            volumeUnit: rule.volumeUnit,
            minVolume: rule.minVolume,
            maxVolume: rule.maxVolume,
            solNotional,
            usdNotional,
          });
        }
        continue;
      }

      const structured = buildStructuredRuleAlert(
        rule,
        event,
        solNotional,
        usdNotional,
      );
      const resolution = await deps.resolveRuleDelivery(rule);
      const delivery = await dispatchToResolvedTargets({
        scope: "rule",
        userId: rule.userId,
        walletAddress: ruleWallet,
        ruleId: rule.id,
        alert: structured,
        resolution,
        options,
        deps,
      });

      eventResult.deliveries.push(delivery);
      summary.rulesMatched += 1;
      eventResult.matchedRules.push({
        ruleId: rule.id,
        userId: rule.userId,
        walletAddress: ruleWallet,
        actionType: rule.actionType,
        delivered: delivery.anySucceeded,
      });

      if (delivery.anyAttempted) {
        ruleDeliveryKeys.add(ruleKey(rule.userId, ruleWallet, signature));
      }
      if (delivery.anySucceeded) {
        summary.rulesDelivered += 1;
        if (!dryRun) {
          await persistSuccessfulDelivery({
            userId: rule.userId,
            walletAddress: ruleWallet,
            ruleId: rule.id,
            scope: "rule",
            alert: structured,
            delivery,
            deps,
          });
        }
        if (!dryRun && rule.triggerType === "ONCE") {
          await deps.markRuleOneShotFired(rule.id);
        }
      } else if (delivery.anyAttempted) {
        summary.dispatchFailures += 1;
      }
    }

    for (const target of followedMatches) {
      const walletAddress = normalizeAddress(target.walletAddress);
      if (!walletAddress) continue;
      if (ruleDeliveryKeys.has(ruleKey(target.userId, walletAddress, signature))) {
        if (shouldLog(options)) {
          logAlertPipeline("followed-wallet skipped: rule delivery already attempted", {
            signature,
            userId: target.userId,
            walletAddress,
          });
        }
        continue;
      }

      const alert = buildFollowedWalletAlert(target, event);
      const delivery = await dispatchToResolvedTargets({
        scope: "followed-wallet",
        userId: target.userId,
        walletAddress,
        alert,
        resolution: resolveFollowedWalletDelivery(target),
        options,
        deps,
      });
      eventResult.deliveries.push(delivery);
      if (delivery.anySucceeded) {
        summary.followedWalletDelivered += 1;
        if (!dryRun) {
          await persistSuccessfulDelivery({
            userId: target.userId,
            walletAddress,
            scope: "followed-wallet",
            alert,
            delivery,
            deps,
          });
        }
      } else if (delivery.anyAttempted) {
        summary.dispatchFailures += 1;
      }
    }
  }

  if (shouldLog(options)) {
    logAlertPipeline("batch processed", {
      received: summary.received,
      processed: summary.processed,
      duplicates: summary.duplicates,
      invalid: summary.invalid,
      rulesMatched: summary.rulesMatched,
      rulesDelivered: summary.rulesDelivered,
      followedWalletMatches: summary.followedWalletMatches,
      followedWalletDelivered: summary.followedWalletDelivered,
      dispatchFailures: summary.dispatchFailures,
      dryRun: summary.dryRun,
    });
  }

  return summary;
}
