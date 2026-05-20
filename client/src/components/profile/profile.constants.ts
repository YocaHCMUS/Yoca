import type {
    ProfileAccountTier,
    ProfileAlertNav,
    ProfileActivityNav,
    ProfileWalletNav,
} from "@/types/profile";
import type { PlanTier } from "@/services/profile/subscriptionApi";

export const PROFILE_TABS = [
    { id: "overview", label: "Overview" },
    { id: "dashboard", label: "Dashboard" },
    { id: "alerts", label: "Alerts" },
    { id: "wallets", label: "Wallets" },
    { id: "watchlist", label: "Watchlist" },
    { id: "activity", label: "Activity" },
    { id: "subscriptions", label: "Subscriptions" },
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
    basic: "Lite",
    premium: "Plus",
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

// ─────────────────────────────────────────────────────────────────────────────
// Subscription Tier Mappings (for dynamic badge display)
// ─────────────────────────────────────────────────────────────────────────────

export type SubscriptionTierDisplay = "Standard" | PlanTier;

/**
 * Map subscription tier to display label
 * - null/undefined → "Standard" (free tier)
 * - "Lite" | "Plus" | "Pro" → as-is
 */
export const SUBSCRIPTION_TIER_LABELS: Record<PlanTier | "Standard", string> = {
    Standard: "Standard",
    Lite: "Lite",
    Plus: "Plus",
    Pro: "Pro",
};

/**
 * Map subscription tier to Carbon Tag color
 * - Standard (free) → gray (neutral)
 * - Lite → emerald (green)
 * - Plus → blue (cyan)
 * - Pro → purple
 */
export const SUBSCRIPTION_TIER_TAG_KIND: Record<
    PlanTier | "Standard",
    "gray" | "green" | "cyan" | "purple"
> = {
    Standard: "gray",
    Lite: "green",
    Plus: "cyan",
    Pro: "purple",
};
