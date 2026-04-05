export type PeriodKey = "24H" | "7D" | "30D" | "90D" | "All";
export type PeriodLabelKey =
  | "wallet.filter24h"
  | "wallet.filter7d"
  | "wallet.filter30d"
  | "wallet.filter90d"
  | "wallet.filterAll";
export type PeriodOption = {
  key: PeriodKey;
  labelKey: PeriodLabelKey;
};

export const PERIOD_OPTIONS: PeriodOption[] = [
  { key: "24H", labelKey: "wallet.filter24h" },
  { key: "7D", labelKey: "wallet.filter7d" },
  { key: "30D", labelKey: "wallet.filter30d" },
  { key: "90D", labelKey: "wallet.filter90d" },
  { key: "All", labelKey: "wallet.filterAll" },
];

export default PERIOD_OPTIONS;
