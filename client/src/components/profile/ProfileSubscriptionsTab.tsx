import { useEffect, useState } from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import {
    getUserSubscription,
    getUserSubscriptions,
    getUserPaymentHistory,
    cancelSubscription,
    previewSubscriptionUpgrade,
    upgradeSubscription,
    type Subscription,
    type PaymentHistory,
} from "@/services/profile/subscriptionApi";
import ProfileLoadingState from "@/components/profile/shared/ProfileLoadingState";
import Tble, { type TblRw } from "@/components/Tble";
import { Card } from "@/components/common/Card/Card";
import { EmptyState } from "@/components/common/EmptyState/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge/StatusBadge";
import { PillTabs } from "@/components/common/PillTabs/PillTabs";
import { CpyBtn } from "@/components/CpyBtn";
import { Flex } from "@/components/Flex";
import { Txt } from "@/components/Txt";
import { SubscriptionUpgradeModal } from "./SubscriptionUpgradeModal/SubscriptionUpgradeModal";
import { SubscriptionCancelModal } from "./SubscriptionCancelModal/SubscriptionCancelModal";
import styles from "./ProfileSubscriptionsTab.module.scss";

type SubscriptionSubtab = "subscriptions" | "payment-history";
type PlanTier = "Lite" | "Plus" | "Pro";
type UpgradePreview = {
    amountDue: number;
    creditAmount: number;
    chargeAmount: number;
    currency: string;
    prorationDate: number;
};

function formatAbsoluteTimestamp(time: string | null | undefined) {
  if (!time) return "\u2013";
  const date = new Date(time);
  if (isNaN(date.getTime())) return "\u2013";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function ProfileSubscriptionsTab() {
  const { refreshUser } = useAuth();
    const [activeSubtab, setActiveSubtab] = useState<SubscriptionSubtab>("subscriptions");
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [history, setHistory] = useState<PaymentHistory[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async (showLoading = true, refreshSession = false) => {
        try {
            if (showLoading) setLoading(true);
            const [sub, subs, hist] = await Promise.all([
                getUserSubscription(),
                getUserSubscriptions(),
                getUserPaymentHistory(),
            ]);
            setSubscription(sub);
            setSubscriptions(subs);
            setHistory(hist);
            if (refreshSession) {
                await refreshUser();
            }
        } catch (err) {
            console.error("Failed to fetch subscription data", err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return <ProfileLoadingState />;
    }

    return (
        <div className={styles.root}>
            <PillTabs
                options={[
                    { label: "Subscriptions", value: "subscriptions" },
                    { label: "Payment History", value: "payment-history" },
                ]}
                value={activeSubtab}
                onChange={(val) => setActiveSubtab(val as SubscriptionSubtab)}
            />
            {activeSubtab === "subscriptions" ? (
                <SubscriptionsPanel
                    subscription={subscription}
                    subscriptions={subscriptions}
                    onUpdate={() => fetchData(false, true)}
                />
            ) : (
                <PaymentHistoryPanel history={history} subscriptions={subscriptions} />
            )}
        </div>
    );
}

function SubscriptionsPanel({
    subscription,
    subscriptions,
    onUpdate,
}: {
    subscription: Subscription | null;
    subscriptions: Subscription[];
    onUpdate: () => void | Promise<void>;
}) {
    const { fmt } = useLocalization();
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [upgradeTier, setUpgradeTier] = useState<PlanTier | null>(null);
    const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null);
    const [upgradeNotice, setUpgradeNotice] = useState<{
        kind: "success" | "error";
        title: string;
        subtitle: string;
    } | null>(null);

    const canceledSubscriptions = subscriptions.filter(
        (item) => item.status === "canceled" && item.id !== subscription?.id,
    );

    if (!subscription) {
        return (
            <EmptyState
                title="No active subscriptions"
                message="No active subscriptions found. View pricing plans to upgrade."
                action={{ label: "View Pricing Plans", onClick: () => (window.location.href = "/pricing") }}
            />
        );
    }

    const isStripeManagedSubscription =
        subscription.stripeSubscriptionId.startsWith("sub_");
    const canManageStripeSubscription =
        isStripeManagedSubscription &&
        subscription.status === "active" &&
        !subscription.cancelAtPeriodEnd;
    const statusLabel =
        subscription.status === "past_due"
            ? "Payment overdue"
            : subscription.status.replaceAll("_", " ");

    const handleCancel = async () => {
        if (!isStripeManagedSubscription) return;

        setIsCanceling(true);
        try {
            await cancelSubscription(subscription.stripeSubscriptionId);
            onUpdate();
            setIsCancelModalOpen(false);
        } catch (err) {
            console.error("Failed to cancel subscription", err);
            alert("Failed to cancel subscription. Please try again.");
        } finally {
            setIsCanceling(false);
        }
    };

    const openUpgradeConfirmation = async (newTier: PlanTier) => {
        if (!isStripeManagedSubscription) return;

        setUpgradeNotice(null);
        setIsUpgrading(true);
        try {
            const preview = await previewSubscriptionUpgrade(
                subscription.stripeSubscriptionId,
                newTier,
            );
            setUpgradeTier(newTier);
            setUpgradePreview(preview);
        } catch (err) {
            console.error("Failed to preview subscription upgrade", err);
            setUpgradeNotice({
                kind: "error",
                title: "Could not calculate upgrade",
                subtitle: "Please try again in a moment.",
            });
        } finally {
            setIsUpgrading(false);
        }
    };

    const handleUpgrade = async () => {
        if (!isStripeManagedSubscription || !upgradeTier || !upgradePreview) return;

        setIsUpgrading(true);
        try {
            const res = await upgradeSubscription(
                subscription.stripeSubscriptionId,
                upgradeTier,
                upgradePreview.prorationDate,
            );
            if (res.applied) {
                const upgradedTier = upgradeTier;
                setUpgradeTier(null);
                setUpgradePreview(null);
                setIsUpgrading(false);
                await onUpdate();
                setUpgradeNotice({
                    kind: "success",
                    title: res.processing ? "Upgrade submitted" : "Upgrade complete",
                    subtitle: res.processing
                        ? `Your ${upgradedTier} upgrade is active while the bank payment is processing.`
                        : `Your subscription is now on the ${upgradedTier} plan.`,
                });
            } else {
                setUpgradeTier(null);
                setUpgradePreview(null);
                setIsUpgrading(false);
                setUpgradeNotice({
                    kind: "error",
                    title: "Payment not completed",
                    subtitle: res.clientSecret
                        ? "Your bank requires additional payment authentication. The previous plan remains active."
                        : "Stripe could not collect the prorated amount. The previous plan remains active.",
                });
            }
        } catch (err) {
            console.error("Failed to upgrade subscription", err);
            setUpgradeTier(null);
            setUpgradePreview(null);
            setIsUpgrading(false);
            setUpgradeNotice({
                kind: "error",
                title: "Upgrade failed",
                subtitle: "No plan change was applied. Please check your payment method and try again.",
            });
        }
    };

    const availableUpgrades: PlanTier[] = canManageStripeSubscription
        ? (["Lite", "Plus", "Pro"] as PlanTier[]).filter((tier) => {
            const tiers = { Lite: 1, Plus: 2, Pro: 3 };
            return (
                tiers[tier as keyof typeof tiers] >
                tiers[subscription.planTier as keyof typeof tiers]
            );
        })
        : [];

    return (
        <div>
            {upgradeNotice && (
                <div className={`${styles.notification} ${upgradeNotice.kind === "error" ? styles.notificationError : styles.notificationSuccess}`} role="status">
                    <div className={styles.notificationContent}>
                        <span className={styles.notificationTitle}>{upgradeNotice.title}</span>
                        {': '}
                        <span>{upgradeNotice.subtitle}</span>
                    </div>
                    <button
                        type="button"
                        className={styles.notificationClose}
                        onClick={() => setUpgradeNotice(null)}
                        aria-label="Dismiss"
                    >
                        &times;
                    </button>
                </div>
            )}

            <Card
                title="Current Plan"
                actions={canManageStripeSubscription ? (
                    <button type="button" className={styles.dangerBtn} onClick={() => setIsCancelModalOpen(true)}>
                        Cancel Subscription
                    </button>
                ) : undefined}
            >
                <Tble
                    headers={[
                        { key: "tier", header: "Tier" },
                        { key: "status", header: "Status" },
                        { key: "periodStart", header: "Period Start" },
                        { key: "periodEnd", header: isStripeManagedSubscription ? "Period End" : "Access Expires" },
                        ...(availableUpgrades.length > 0 ? [{ key: "upgrade", header: "Upgrade" }] : []),
                    ]}
                    rows={[{
                        id: subscription.stripeSubscriptionId || "current",
                        tier: subscription.planTier,
                        status: statusLabel,
                        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                        periodStart: fmt.datetime.datetime(subscription.currentPeriodStart),
                        periodEnd: fmt.datetime.datetime(subscription.currentPeriodEnd),
                    } as TblRw]}
                    cellRenderers={{
                        tier: (value: unknown) => (
                            <span style={{ color: "var(--yoca-accent)", fontWeight: 600 }}>{String(value)}</span>
                        ),
                        status: (_value: unknown, row: TblRw) => (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <StatusBadge
                                    variant={subscription.cancelAtPeriodEnd ? "warning" : subscription.status === "active" ? "success" : subscription.status === "past_due" ? "error" : "neutral"}
                                    label={String(statusLabel)}
                                />
                                {row.cancelAtPeriodEnd ? <span style={{ color: "var(--yoca-text-muted)", fontSize: "0.75rem" }}>(Cancels at end of period)</span> : null}
                            </span>
                        ),
                        ...(availableUpgrades.length > 0 ? {
                            upgrade: () => (
                                <Flex gap={2} align="center">
                                    {availableUpgrades.map((tier) => (
                                        <button
                                            key={tier}
                                            type="button"
                                            className={styles.primaryBtn}
                                            disabled={isUpgrading}
                                            onClick={() => openUpgradeConfirmation(tier)}
                                        >
                                            {isUpgrading ? "..." : `Upgrade to ${tier}`}
                                        </button>
                                    ))}
                                </Flex>
                            ),
                        } : {}),
                    }}
                    boxed
                />
            </Card>

            <SubscriptionCancelModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={handleCancel}
                isLoading={isCanceling}
                planTier={subscription.planTier}
                periodEnd={fmt.datetime.datetime(subscription.currentPeriodEnd)}
            />

            <SubscriptionUpgradeModal
                isOpen={Boolean(upgradeTier && upgradePreview)}
                onClose={() => {
                    setUpgradeTier(null);
                    setUpgradePreview(null);
                }}
                onConfirm={handleUpgrade}
                isLoading={isUpgrading}
                currentTier={subscription.planTier}
                upgradeTier={upgradeTier ?? ""}
                upgradePreview={upgradePreview}
                periodEnd={fmt.datetime.datetime(subscription.currentPeriodEnd)}
            />

            {canceledSubscriptions.length > 0 ? (
                <Card title="Canceled Plans" style={{ marginTop: "1.5rem" }}>
                    <Tble
                        headers={[
                            { key: "tier", header: "Tier" },
                            { key: "status", header: "Status" },
                            { key: "periodStart", header: "Period Start" },
                            { key: "periodEnd", header: "Period End" },
                            { key: "updated", header: "Updated" },
                        ]}
                        rows={canceledSubscriptions.map((item) => ({
                            id: item.id,
                            tier: item.planTier,
                            status: item.status,
                            periodStart: fmt.datetime.datetime(item.currentPeriodStart),
                            periodEnd: fmt.datetime.datetime(item.currentPeriodEnd),
                            updated: formatAbsoluteTimestamp(item.updatedAt),
                        } as TblRw))}
                        cellRenderers={{
                            status: (value: unknown) => (
                                <StatusBadge variant="neutral" label={String(value)} />
                            ),
                        }}
                        boxed
                    />
                </Card>
            ) : null}
        </div>
    );
}

function PaymentHistoryPanel({
    history,
    subscriptions,
}: {
    history: PaymentHistory[];
    subscriptions: Subscription[];
}) {
    const { fmt } = useLocalization();
    const planBySubscriptionId = new Map(
        subscriptions.map((sub) => [sub.id, sub.planTier]),
    );

    const paymentIdLabel = (item: PaymentHistory) => {
        return (
            item.stripePaymentIntentId ??
            item.stripeInvoiceId ??
            ((item.paymentMethodDetails as any)?.txId as string | undefined) ??
            "-"
        );
    };

    const resolvePlanLabel = (item: PaymentHistory) => {
        const directPlan = item.planName ?? item.planTier;
        if (directPlan) return directPlan;

        const amountCents = (item.amountCents ?? item.amount ?? 0) as number;
        if (amountCents === 3900 || amountCents === 39000) return "Lite";
        if (amountCents === 7900 || amountCents === 79000) return "Plus";
        if (amountCents === 14900 || amountCents === 149000) return "Pro";

        if (item.subscriptionId) {
            const mappedPlan = planBySubscriptionId.get(item.subscriptionId);
            if (mappedPlan) return mappedPlan;
        }

        const pm = item.paymentMethodDetails as any;
        const solTxId = pm?.txId;
        if (solTxId) {
            const solSub = subscriptions.find((s) => s.stripeSubscriptionId === `solana-${solTxId}`);
            if (solSub) return solSub.planTier;
        }

        return "-";
    };

    if (history.length === 0) {
        return (
            <EmptyState
                title="No purchase history"
                message="No purchases found in your history."
            />
        );
    }

    return (
        <Card>
            <Tble
                headers={[
                    { key: "date", header: "Date" },
                    { key: "plan", header: "Plan" },
                    { key: "amount", header: "Amount" },
                    { key: "status", header: "Status" },
                    { key: "paymentId", header: "Payment ID" },
                ]}
                rows={history.map((item) => ({
                    id: item.id,
                    date: fmt.datetime.datetime(item.createdAt),
                    plan: resolvePlanLabel(item),
                    amount: item,
                    status: item.status,
                    paymentId: paymentIdLabel(item),
                } as TblRw))}
                cellRenderers={{
                    amount: (value: unknown) => {
                        const item = value as PaymentHistory;
                        if ((item.paymentMethodDetails as any)?.type === "solana_transfer" || (item.paymentMethodDetails as any)?.txId) {
                            const pm = item.paymentMethodDetails as any;
                            const solAmt = pm?.amount;
                            if (typeof solAmt === "number") return <span>{fmt.num.unit(solAmt, "SOL")}</span>;
                            return <span>{fmt.num.currency((item.amountCents ?? item.amount ?? 0) / 100)}</span>;
                        }
                        return <span>{fmt.num.currency((item.amountCents ?? item.amount ?? 0) / 100)}</span>;
                    },
                    status: (value: unknown) => (
                        <StatusBadge
                            variant={String(value) === "succeeded" ? "success" : "error"}
                            label={String(value)}
                        />
                    ),
                    paymentId: (_value: unknown, row: TblRw) => (
                        <PaymentIdCell paymentId={String(row.paymentId)} />
                    ),
                }}
                boxed
            />
        </Card>
    );
}

function PaymentIdCell({ paymentId }: { paymentId: string }) {
    if (!paymentId || paymentId === "-") return <span>-</span>;

    const masked =
        paymentId.length > 12
            ? `${paymentId.slice(0, 6)}...${paymentId.slice(-4)}`
            : paymentId;

    return (
        <Flex align="center" gap={2}>
            <Txt size="sm" mono secondary>
                {masked}
            </Txt>
            <CpyBtn size="sm" copyWhat={paymentId} />
        </Flex>
    );
}

export default ProfileSubscriptionsTab;
