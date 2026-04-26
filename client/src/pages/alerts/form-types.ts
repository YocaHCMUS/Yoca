import type {
  UserAlertConditionOp,
  UserAlertPeriod,
  UserAlertTokenMetric,
  UserAlertTriggerMode,
  UserTradeDirection,
  UserTradingAggregation,
} from "@/api/alerts";
import type { SelectedTokenValue } from "@/components/TokenSearch/TokenSearch";

export const alertTypes = [
  "technical-indicators",
  "token-stats",
  "trading-events",
  "market-movements",
] as const;

export type AlertType = (typeof alertTypes)[number];

export type AlertStep = "type-selection" | "configuration" | "notification";

export const alertPeriods = [
  "30m",
  "1h",
  "6h",
  "24h",
] as const satisfies readonly UserAlertPeriod[];
export const triggerModes = [
  "once",
  "always",
] as const satisfies readonly UserAlertTriggerMode[];
export const conditionOps = [
  "gt",
  "gte",
  "eq",
  "lt",
  "lte",
] as const satisfies readonly UserAlertConditionOp[];
export const tokenAlertMetrics = [
  "price_percentage",
  "price_usd",
] as const satisfies readonly UserAlertTokenMetric[];
export const tradingAggregations = [
  "volume_usd",
  "trade_count",
] as const satisfies readonly UserTradingAggregation[];
export const tradeDirections = [
  "buy",
  "sell",
  "both",
] as const satisfies readonly UserTradeDirection[];

export type TokenConditionFormRow = {
  id: string;
  period: UserAlertPeriod;
  metric: UserAlertTokenMetric;
  condition: UserAlertConditionOp;
  value: string;
};

export type TradingConditionFormRow = {
  id: string;
  period: UserAlertPeriod;
  aggregation: UserTradingAggregation;
  condition: UserAlertConditionOp;
  value: string;
};

export type TradingScopeForm = {
  walletAddress: string;
  tokenAddress: string;
  poolAddress: string;
  counterpartyAddress: string;
  direction: UserTradeDirection;
};

export type AlertFormValues = {
  type: AlertType | null;
  token: SelectedTokenValue | null;
  triggerMode: UserAlertTriggerMode;
  expiresAtDate: Date | null;
  expiresAtTime: string;
  tokenConditions: TokenConditionFormRow[];
  tradingConditions: TradingConditionFormRow[];
  tradingScope: TradingScopeForm;
  alertName: string;
  emailEnabled: boolean;
  email: string;
};

export function createTokenConditionRow(
  condition: UserAlertConditionOp = "gt",
): TokenConditionFormRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    period: "1h",
    metric: "price_percentage",
    condition,
    value: "",
  };
}

export function createTradingConditionRow(
  condition: UserAlertConditionOp = "gt",
): TradingConditionFormRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    period: "1h",
    aggregation: "volume_usd",
    condition,
    value: "",
  };
}

export function defaultConfig(type: AlertType | null = null): AlertFormValues {
  return {
    type,
    token: null,
    triggerMode: "once",
    expiresAtDate: null,
    expiresAtTime: "09:00",
    tokenConditions: [createTokenConditionRow()],
    tradingConditions: [createTradingConditionRow()],
    tradingScope: {
      walletAddress: "",
      tokenAddress: "",
      poolAddress: "",
      counterpartyAddress: "",
      direction: "both",
    },
    alertName: "",
    emailEnabled: true,
    email: "",
  };
}
