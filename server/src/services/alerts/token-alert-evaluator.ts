import {
  alertDelivery,
  alertHistory,
  alertState,
  alerts,
  tokenAlertConditions,
  tokenAlertTargets,
  type UserAlertConditionOp,
  type UserAlertPeriod,
  type UserAlertTokenMetric,
  type UserAlertTriggerMode,
} from "@sv/db/alerts.js";
import { db } from "@sv/db/index.js";
import { tokenMeta, users } from "@sv/db/schema.js";
import { sendTokenAlertEmail } from "@sv/services/email.service.js";
import {
  sendDiscordWebhookPayload,
  type DiscordSendResult,
} from "@sv/services/walletAlerts.service.js";
import { get24hTokenMarketChart } from "@sv/services/tokens/token-chart.js";
import { and, desc, eq, gt, inArray, lte } from "drizzle-orm";

export interface TokenPricePoint {
  timestamp: number;
  price: number;
}

export interface TokenAlertConditionRuntime {
  id: string;
  period: UserAlertPeriod;
  metric: UserAlertTokenMetric;
  conditionOp: UserAlertConditionOp;
  value: number;
}

export interface TokenAlertRuntime {
  id: string;
  userId: string;
  name: string;
  triggerMode: UserAlertTriggerMode;
  expiresAt: Date;
  tokenAddress: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  conditions: TokenAlertConditionRuntime[];
  delivery: { email: string | null; discordEnabled: boolean };
  discordWebhookUrl: string | null;
}

export interface ConditionEvaluationResult {
  conditionId: string;
  metric: UserAlertTokenMetric;
  period: UserAlertPeriod;
  conditionOp: UserAlertConditionOp;
  expectedValue: number;
  actualValue: number | null;
  matched: boolean;
  unavailableReason?: string;
}

export interface TokenAlertEvaluationResult {
  alertId: string;
  tokenAddress: string;
  currentPriceUsd: number | null;
  matched: boolean;
  conditions: ConditionEvaluationResult[];
}

export interface TokenAlertCycleSummary {
  evaluatedAt: string;
  expiredStopped: number;
  loaded: number;
  matched: number;
  delivered: number;
  cooldownSkipped: number;
  unavailable: number;
  results: TokenAlertEvaluationResult[];
}

export interface TokenAlertEvaluatorDependencies {
  stopExpiredAlerts(now: Date): Promise<number>;
  loadRunningAlerts(now: Date): Promise<TokenAlertRuntime[]>;
  getChart(tokenAddress: string): Promise<TokenPricePoint[]>;
  getLastDeliveredAt(alertId: string): Promise<Date | null>;
  sendDiscord(discordUrl: string, payload: unknown): Promise<DiscordSendResult>;
  sendEmail(email: string, input: {
    alertName: string;
    tokenAddress: string;
    tokenLabel: string;
    message: string;
    currentPriceUsd: number;
    emittedAt: string;
  }): Promise<boolean>;
  recordDelivery(input: {
    alert: TokenAlertRuntime;
    message: string;
    metadata: Record<string, unknown>;
    sentAt: Date;
  }): Promise<void>;
  stopAlert(alertId: string): Promise<void>;
}

function log(message: string, payload: Record<string, unknown> = {}) {
  console.log(`[token-alerts] ${message}`, JSON.stringify(payload));
}

function periodMs(period: UserAlertPeriod): number {
  switch (period) {
    case "30m": return 30 * 60 * 1000;
    case "1h": return 60 * 60 * 1000;
    case "6h": return 6 * 60 * 60 * 1000;
    case "24h": return 24 * 60 * 60 * 1000;
  }
}

export function compareAlertValues(
  actual: number,
  expected: number,
  operator: UserAlertConditionOp,
): boolean {
  switch (operator) {
    case "gt": return actual > expected;
    case "gte": return actual >= expected;
    case "lt": return actual < expected;
    case "lte": return actual <= expected;
    case "eq": return Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-8);
  }
}

function latestPrice(points: TokenPricePoint[]): number | null {
  const point = points[points.length - 1];
  return point && Number.isFinite(point.price) ? point.price : null;
}

export function evaluateTokenAlert(
  alert: Pick<TokenAlertRuntime, "id" | "tokenAddress" | "conditions">,
  rawPoints: TokenPricePoint[],
  now = new Date(),
): TokenAlertEvaluationResult {
  const points = rawPoints
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.price))
    .sort((a, b) => a.timestamp - b.timestamp);
  const currentPriceUsd = latestPrice(points);

  const conditions = alert.conditions.map((condition): ConditionEvaluationResult => {
    let actualValue: number | null = null;
    let unavailableReason: string | undefined;

    if (currentPriceUsd == null) {
      unavailableReason = "current price unavailable";
    } else if (condition.metric === "price_usd") {
      actualValue = currentPriceUsd;
    } else {
      const targetTimestamp = now.getTime() - periodMs(condition.period);
      let baseline: TokenPricePoint | undefined;
      for (let index = points.length - 1; index >= 0; index -= 1) {
        if (points[index]!.timestamp <= targetTimestamp) {
          baseline = points[index];
          break;
        }
      }
      if (!baseline) {
        unavailableReason = `insufficient ${condition.period} price history`;
      } else if (baseline.price === 0) {
        unavailableReason = "invalid baseline price";
      } else {
        actualValue = ((currentPriceUsd - baseline.price) / baseline.price) * 100;
      }
    }

    return {
      conditionId: condition.id,
      metric: condition.metric,
      period: condition.period,
      conditionOp: condition.conditionOp,
      expectedValue: Number(condition.value),
      actualValue,
      matched: actualValue != null && compareAlertValues(actualValue, Number(condition.value), condition.conditionOp),
      unavailableReason,
    };
  });

  return {
    alertId: alert.id,
    tokenAddress: alert.tokenAddress,
    currentPriceUsd,
    matched: conditions.length > 0 && conditions.every((condition) => condition.matched),
    conditions,
  };
}

function cooldownMs(): number {
  const configured = Number(process.env.TOKEN_ALERT_NOTIFICATION_COOLDOWN_MS || 15 * 60 * 1000);
  return Number.isFinite(configured) && configured >= 0 ? configured : 15 * 60 * 1000;
}

function tokenLabel(alert: TokenAlertRuntime): string {
  return alert.tokenSymbol || alert.tokenName || alert.tokenAddress;
}

function resultMessage(alert: TokenAlertRuntime, result: TokenAlertEvaluationResult): string {
  const conditions = result.conditions
    .map((condition) => `${condition.metric} ${condition.conditionOp} ${condition.expectedValue} (actual ${condition.actualValue?.toFixed(6) ?? "unavailable"})`)
    .join("; ");
  return `${tokenLabel(alert)} matched ${alert.name}: ${conditions}. Current price: $${result.currentPriceUsd?.toFixed(8) ?? "unavailable"}.`;
}

function discordPayload(alert: TokenAlertRuntime, result: TokenAlertEvaluationResult, message: string, emittedAt: string) {
  return {
    username: "Yoca Alerts",
    embeds: [{
      title: `Token alert: ${alert.name}`,
      description: message,
      color: 0x57f287,
      fields: [
        { name: "Token", value: tokenLabel(alert), inline: true },
        { name: "Current price", value: `$${result.currentPriceUsd?.toFixed(8) ?? "unavailable"}`, inline: true },
        { name: "Mint", value: `\`${alert.tokenAddress}\``, inline: false },
      ],
      timestamp: emittedAt,
    }],
  };
}

async function defaultStopExpiredAlerts(now: Date): Promise<number> {
  const expired = await db.select({ alertId: alerts.id })
    .from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .where(and(eq(alerts.alertType, "token"), eq(alertState.status, "running"), lte(alerts.expiresAt, now)));
  if (expired.length === 0) return 0;
  await db.update(alertState).set({ status: "stopped" }).where(inArray(alertState.alertId, expired.map((row) => row.alertId)));
  return expired.length;
}

async function defaultLoadRunningAlerts(now: Date): Promise<TokenAlertRuntime[]> {
  const rows = await db.select({
    alert: alerts,
    target: tokenAlertTargets,
    condition: tokenAlertConditions,
    delivery: alertDelivery,
    discordWebhookUrl: users.discordWebhookUrl,
    tokenName: tokenMeta.name,
    tokenSymbol: tokenMeta.symbol,
  }).from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .innerJoin(tokenAlertTargets, eq(tokenAlertTargets.alertId, alerts.id))
    .innerJoin(tokenAlertConditions, eq(tokenAlertConditions.alertId, alerts.id))
    .leftJoin(alertDelivery, eq(alertDelivery.alertId, alerts.id))
    .innerJoin(users, eq(users.id, alerts.userId))
    .leftJoin(tokenMeta, eq(tokenMeta.address, tokenAlertTargets.tokenAddress))
    .where(and(eq(alerts.alertType, "token"), eq(alertState.status, "running"), gt(alerts.expiresAt, now)));

  const grouped = new Map<string, TokenAlertRuntime>();
  for (const row of rows) {
    const existing = grouped.get(row.alert.id);
    const condition: TokenAlertConditionRuntime = {
      id: row.condition.id,
      period: row.condition.period,
      metric: row.condition.metric,
      conditionOp: row.condition.conditionOp,
      value: Number(row.condition.value),
    };
    if (existing) {
      existing.conditions.push(condition);
      continue;
    }
    grouped.set(row.alert.id, {
      id: row.alert.id,
      userId: row.alert.userId,
      name: row.alert.name,
      triggerMode: row.alert.triggerMode,
      expiresAt: row.alert.expiresAt,
      tokenAddress: row.target.tokenAddress,
      tokenName: row.tokenName ?? null,
      tokenSymbol: row.tokenSymbol ?? null,
      conditions: [condition],
      delivery: { email: row.delivery?.email ?? null, discordEnabled: Boolean(row.delivery?.discordEnabled) },
      discordWebhookUrl: row.discordWebhookUrl ?? null,
    });
  }
  return [...grouped.values()];
}

function defaultDependencies(): TokenAlertEvaluatorDependencies {
  return {
    stopExpiredAlerts: defaultStopExpiredAlerts,
    loadRunningAlerts: defaultLoadRunningAlerts,
    getChart: async (tokenAddress) => (await get24hTokenMarketChart(tokenAddress)).map((point) => ({ timestamp: point.unixTimestampMs, price: Number(point.price) })),
    getLastDeliveredAt: async (alertId) => {
      const [row] = await db.select({ sentAt: alertHistory.sentAt }).from(alertHistory).where(eq(alertHistory.alertId, alertId)).orderBy(desc(alertHistory.sentAt)).limit(1);
      return row?.sentAt ?? null;
    },
    sendDiscord: sendDiscordWebhookPayload,
    sendEmail: sendTokenAlertEmail,
    recordDelivery: async ({ alert, message, metadata, sentAt }) => {
      await db.insert(alertHistory).values({ alertId: alert.id, userId: alert.userId, alertName: alert.name, message, metadata, sentAt });
    },
    stopAlert: async (alertId) => { await db.update(alertState).set({ status: "stopped" }).where(eq(alertState.alertId, alertId)); },
  };
}

export async function evaluateRunningTokenAlerts(options: {
  now?: Date;
  dependencies?: Partial<TokenAlertEvaluatorDependencies>;
} = {}): Promise<TokenAlertCycleSummary> {
  const now = options.now ?? new Date();
  const deps = { ...defaultDependencies(), ...options.dependencies };
  const summary: TokenAlertCycleSummary = {
    evaluatedAt: now.toISOString(), expiredStopped: await deps.stopExpiredAlerts(now), loaded: 0, matched: 0, delivered: 0, cooldownSkipped: 0, unavailable: 0, results: [],
  };
  const alertsToEvaluate = await deps.loadRunningAlerts(now);
  summary.loaded = alertsToEvaluate.length;
  const chartCache = new Map<string, Promise<TokenPricePoint[]>>();

  for (const alert of alertsToEvaluate) {
    try {
      const chart = chartCache.get(alert.tokenAddress) ?? deps.getChart(alert.tokenAddress);
      chartCache.set(alert.tokenAddress, chart);
      const result = evaluateTokenAlert(alert, await chart, now);
      summary.results.push(result);
      if (result.currentPriceUsd == null || result.conditions.some((condition) => condition.unavailableReason)) {
        summary.unavailable += 1;
        continue;
      }
      if (!result.matched) continue;
      summary.matched += 1;

      const lastDeliveredAt = await deps.getLastDeliveredAt(alert.id);
      if (alert.triggerMode === "always" && lastDeliveredAt && now.getTime() - lastDeliveredAt.getTime() < cooldownMs()) {
        summary.cooldownSkipped += 1;
        continue;
      }
      if (alert.triggerMode === "once" && lastDeliveredAt) {
        await deps.stopAlert(alert.id);
        continue;
      }

      const emittedAt = now.toISOString();
      const message = resultMessage(alert, result);
      const [discord, email] = await Promise.all([
        alert.delivery.discordEnabled && alert.discordWebhookUrl
          ? deps.sendDiscord(alert.discordWebhookUrl, discordPayload(alert, result, message, emittedAt))
          : Promise.resolve<DiscordSendResult>({ ok: false, error: "Discord delivery not configured" }),
        alert.delivery.email && result.currentPriceUsd != null
          ? deps.sendEmail(alert.delivery.email, { alertName: alert.name, tokenAddress: alert.tokenAddress, tokenLabel: tokenLabel(alert), message, currentPriceUsd: result.currentPriceUsd, emittedAt })
          : Promise.resolve(false),
      ]);
      const delivered = discord.ok || email;
      if (!delivered) {
        log("delivery failed", { alertId: alert.id, discordError: discord.error, emailConfigured: Boolean(alert.delivery.email) });
        continue;
      }

      await deps.recordDelivery({
        alert,
        message,
        sentAt: now,
        metadata: { tokenAddress: alert.tokenAddress, currentPriceUsd: result.currentPriceUsd, conditions: result.conditions, discordSent: discord.ok, emailSent: email },
      });
      if (alert.triggerMode === "once") await deps.stopAlert(alert.id);
      summary.delivered += 1;
      log("delivered", { alertId: alert.id, triggerMode: alert.triggerMode, discordSent: discord.ok, emailSent: email });
    } catch (error) {
      log("evaluation failed", { alertId: alert.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  log("cycle complete", { loaded: summary.loaded, matched: summary.matched, delivered: summary.delivered, unavailable: summary.unavailable });
  return summary;
}
