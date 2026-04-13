import type {
    ProfileAccountTier,
    ProfileAlertNav,
    ProfileActivityNav,
    ProfileWalletNav,
} from "@/types/profile";

export const PROFILE_TABS = [
    { id: "overview", label: "Overview" },
    { id: "dashboard", label: "Dashboard" },
    { id: "alerts", label: "Alerts" },
    { id: "wallets", label: "Wallets" },
    { id: "activity", label: "Activity" },
    { id: "settings", label: "Settings" },
] as const;

export type ProfileTabId = (typeof PROFILE_TABS)[number]["id"];

export const PROFILE_ALERT_NAV_LABELS: Record<ProfileAlertNav, string> = {
    list: "Alert list",
    editor: "Editor",
};

export const PROFILE_WALLET_NAV_LABELS: Record<ProfileWalletNav, string> = {
    "portfolio-table": "Portfolio table",
    "linked-wallets": "Linked wallets",
    "balance-chart": "Balance chart",
    "drawdown-chart": "Drawdown chart",
};

export const PROFILE_ACTIVITY_NAV_LABELS: Record<ProfileActivityNav, string> = {
    "swaps-table": "Swaps table",
    "transfers-table": "Transfers table",
    "wallet-overview-cards": "Wallet overview cards",
    "trade-frequency-heatmap": "Trade frequency heatmap",
};

export const ACCOUNT_TIER_LABELS: Record<ProfileAccountTier, string> = {
    basic: "Basic",
    premium: "Premium",
    pro: "Pro",
    enterprise: "Enterprise",
};

export const ACCOUNT_TIER_TAG_KIND: Record<
    ProfileAccountTier,
    "gray" | "green" | "cyan" | "purple"
> = {
    basic: "gray",
    premium: "green",
    pro: "cyan",
    enterprise: "purple",
};
