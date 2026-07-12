import type { TimePeriod } from "@/types/chart-filters.types";
import type { WalletSwap, WalletTransfer } from "@/services/wallet/walletApi";

export type ProfileAccountTier = "basic" | "premium" | "pro" | "enterprise";

export interface ProfileOverviewData {
    avatarUrl: string;
    displayName: string;
    userId?: string;
    accountTier: ProfileAccountTier;
    period: TimePeriod;
    totalNetWorthUsd: number;
    tradeOrTxCount: number;
    pnlUsd: number;
    pnlPct: number;
    linkedWalletCount: number;
    authWalletCount: number;
}

export interface DashboardKpi {
    id: string;
    label: string;
    value: string;
    tone?: "positive" | "negative" | "neutral";
}

export interface DashboardDistributionItem {
    label: string;
    valueUsd: number;
    pct: number;
}

export interface DashboardRiskMetric {
    id: string;
    label: string;
    value: string;
}

export interface DashboardAnomaly {
    id: string;
    title: string;
    description: string;
    timestamp: string;
}

export interface ProfileDashboardData {
    kpis: DashboardKpi[];
    concentration: DashboardDistributionItem[];
    risk: DashboardRiskMetric[];
    anomalies: DashboardAnomaly[];
}

export type ProfileAlertNav = "list" | "editor";

export interface AlertRule {
    id: string;
    tokenSymbol: string;
    alertType: "price" | "volume" | "drawdown" | "custom";
    conditionText: string;
    status: "active" | "paused" | "triggered";
    updatedAt: string;
}

export interface AlertNotification {
    id: string;
    timestamp: string;
    message: string;
    severity: "info" | "warning" | "critical";
    title?: string;
    readAt?: string | null;
    source?: string;
    walletAddress?: string | null;
    eventSignature?: string | null;
    emailSucceeded?: boolean;
    discordSucceeded?: boolean;
}

export interface ProfileAlertsData {
    leftNavItems: ProfileAlertNav[];
    selectedNav: ProfileAlertNav;
    alerts: AlertRule[];
    notifications: AlertNotification[];
}

export type ProfileWalletNav =
    | "portfolio-table"
    | "linked-wallets"
    | "balance-chart"
    | "drawdown-chart";

export interface WalletPortfolioRow {
    walletId: string;
    walletLabel: string;
    netWorthUsd: number;
    pnlUsd: number;
    pnlPct: number;
    tradeCount: number;
}

export interface LinkedWalletRow {
    walletId: string;
    walletAddress: string;
    walletLabel: string;
    netWorthUsd: number;
    lastActiveAt: string;
    status: "connected" | "inactive";
}

export interface ProfileWalletsData {
    leftNavItems: ProfileWalletNav[];
    selectedNav: ProfileWalletNav;
    portfolioRows: WalletPortfolioRow[];
    linkedWalletRows: LinkedWalletRow[];
    selectedComparisonWalletIds: string[];
    walletDetailRouteTemplate: string;
    comparisonTargetRoute: string;
}

export interface ProfilePortfolioData {
    overviewData: ProfileOverviewData;
    linkedWalletsData: ProfileWalletsData;
}

export type ProfileActivityNav =
    | "swaps-table"
    | "transfers-table"
    | "wallet-overview-cards"
    | "trade-frequency-heatmap";

export interface ActivityRow {
    id: string;
    walletId: string;
    walletLabel: string;
    type: "swap" | "transfer";
    pairOrToken: string;
    amountUsd: number;
    timestamp: string;
    side?: "buy" | "sell" | "in" | "out";
    exchange?: string;
    soldToken?: string;
    boughtToken?: string;
    baseQuotePrice?: number;
    txHash?: string;
    fromAddress?: string;
    toAddress?: string;
    amount?: number;
    tokenSymbol?: string;
    signature?: string;
}

export interface WalletActivityCard {
    walletId: string;
    walletLabel: string;
    walletAddress: string;
    totalAssetValueUsd: number;
    unrealizedPnlInPeriodUsd: number;
    tradingVolumeUsd: number;
    buyTradingVolumeUsd: number;
    sellTradingVolumeUsd: number;
    buyTransactionCount: number;
    sellTransactionCount: number;
    tokenAmountTraded: number;
    tokenAmountHolding: number;
    totalPnlUsd: number;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
}

export interface ActivityHeatmapCell {
    date: string;
    count: number;
}

export interface ActivityHeatmapData {
    cells: ActivityHeatmapCell[];
    maxCount: number;
}

export interface ProfileActivityData {
    leftNavItems: ProfileActivityNav[];
    selectedNav: ProfileActivityNav;
    swapTransferRows: ActivityRow[];
    swapsRaw?: WalletSwap[];
    transfersRaw?: WalletTransfer[];
    walletCards: WalletActivityCard[];
    heatmap: ActivityHeatmapData;
}

export interface ProfilePageData {
    overview: ProfileOverviewData;
    dashboard: ProfileDashboardData;
    alerts: ProfileAlertsData;
    wallets: ProfileWalletsData;
    activity: ProfileActivityData;
}
