import TabContainer from "@/components/tabContainer/tabContainer";
import { useEffect, useState } from "react";
import styles from "./profile.module.scss";
import { useLocalization } from "@/contexts/LocalizationContext";
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
import { Copy, Check } from "lucide-react";
import ProfileLoadingState from "@/components/profile/shared/ProfileLoadingState";

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

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function ProfileSubscriptionsTab() {
  useLocalization();
  const [activeSubtab, setActiveSubtab] =
    useState<SubscriptionSubtab>("subscriptions");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async (showLoading = true) => {
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
    } catch (err) {
      console.error("Failed to fetch subscription data", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const subtabs = [
    { id: "subscriptions" as const, label: "Subscriptions" },
    { id: "payment-history" as const, label: "Payment History" },
  ];

  const subtabIndex = subtabs.findIndex((tab) => tab.id === activeSubtab);

  if (loading) {
    return <ProfileLoadingState />;
  }

  return (
    <div className={styles.subscriptionsTabContainer}>
      <TabContainer
        activeTab={subtabIndex}
        names={subtabs.map((tab) => tab.label)}
        tabs={[
          <SubscriptionsPanel
            key="subscriptions"
            subscription={subscription}
            subscriptions={subscriptions}
            onUpdate={() => fetchData(false)}
          />,
          <PaymentHistoryPanel
            key="payment-history"
            history={history}
            subscriptions={subscriptions}
          />,
        ]}
        onTabChange={(index) => setActiveSubtab(subtabs[index].id)}
      />
    </div>
  );
}

import { InlineNotification, Modal } from "@carbon/react";

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
      <div className={styles.emptyStateContainer}>
        <div className={styles.emptyStateContent}>
          <h3 className={styles.emptyStateTitle}>No active subscriptions</h3>
          <p className={styles.emptyStateDescription}>
            No active subscriptions found. View pricing plans to upgrade.
          </p>
          <button
            className={styles.primaryButton}
            onClick={() => (window.location.href = "/pricing")}
          >
            View Pricing Plans
          </button>
        </div>
      </div>
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
  const statusColor =
    subscription.status === "active"
      ? subscription.cancelAtPeriodEnd
        ? "var(--cds-support-warning)"
        : "var(--cds-support-success)"
      : subscription.status === "past_due"
        ? "var(--cds-support-error)"
        : "var(--cds-text-secondary)";

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
      setUpgradeNotice({
        kind: "error",
        title: "Upgrade failed",
        subtitle: "No plan change was applied. Please check your payment method and try again.",
      });
    } finally {
      setIsUpgrading(false);
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
    <div className={styles.sectionCard}>
      {upgradeNotice && (
        <InlineNotification
          kind={upgradeNotice.kind}
          title={upgradeNotice.title}
          subtitle={upgradeNotice.subtitle}
          lowContrast
          onClose={() => setUpgradeNotice(null)}
          style={{ marginBottom: "1rem" }}
        />
      )}
      <div
        className={styles.sectionHeader}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 className={styles.emptyStateTitle}>Current Plan</h3>
        {canManageStripeSubscription && (
          <button
            className={styles.primaryButton}
            style={{
              backgroundColor: "#ff4d4d",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
            onClick={() => setIsCancelModalOpen(true)}
          >
            Cancel Subscription
          </button>
        )}
      </div>
      <table className={styles.simpleTable}>
        <thead>
          <tr>
            <th>Tier</th>
            <th>Status</th>
            <th>Period Start</th>
            <th>{isStripeManagedSubscription ? "Period End" : "Access Expires"}</th>
            {availableUpgrades.length > 0 && <th>Upgrade</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.metricValue} style={{ color: "#14F195" }}>
              {subscription.planTier}
            </td>
            <td>
              <span
                style={{
                  textTransform: "uppercase",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: statusColor,
                }}
              >
                {statusLabel}{" "}
                {subscription.cancelAtPeriodEnd && "(Cancels at end of period)"}
              </span>
            </td>
            <td>{fmt.datetime.datetime(subscription.currentPeriodStart)}</td>
            <td>{fmt.datetime.datetime(subscription.currentPeriodEnd)}</td>
            {availableUpgrades.length > 0 && (
              <td>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {availableUpgrades.map((tier) => (
                    <button
                      key={tier}
                      className={styles.primaryButton}
                      style={{
                        padding: "0.25rem 0.5rem",
                        minHeight: "auto",
                        fontSize: "0.75rem",
                      }}
                      disabled={isUpgrading}
                      onClick={() => openUpgradeConfirmation(tier)}
                    >
                      {isUpgrading ? "..." : `Upgrade to ${tier}`}
                    </button>
                  ))}
                </div>
              </td>
            )}
          </tr>
        </tbody>
      </table>

      {canceledSubscriptions.length > 0 ? (
        <>
          <div className={styles.sectionHeader} style={{ marginTop: "1.5rem" }}>
            <h3 className={styles.emptyStateTitle}>Canceled Plans</h3>
          </div>
          <table className={styles.simpleTable}>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Status</th>
                <th>Period Start</th>
                <th>Period End</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {canceledSubscriptions.map((item) => (
                <tr key={item.id}>
                  <td>{item.planTier}</td>
                  <td>
                    <span
                      style={{
                        textTransform: "uppercase",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#64748b",
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>{fmt.datetime.datetime(item.currentPeriodStart)}</td>
                  <td>{fmt.datetime.datetime(item.currentPeriodEnd)}</td>
                  <td>{formatAbsoluteTimestamp(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <Modal
        open={Boolean(upgradeTier && upgradePreview)}
        modalHeading={`Upgrade to ${upgradeTier ?? ""}`}
        primaryButtonText={isUpgrading ? "Upgrading..." : "Confirm upgrade"}
        secondaryButtonText="Not now"
        onRequestClose={() => {
          setUpgradeTier(null);
          setUpgradePreview(null);
        }}
        onRequestSubmit={handleUpgrade}
        primaryButtonDisabled={isUpgrading}
      >
        {upgradePreview && (
          <div style={{ display: "grid", gap: "0.75rem", color: "var(--cds-text-primary)" }}>
            <p>
              Stripe applies the unused value of your {subscription.planTier} plan
              toward the {upgradeTier} plan. You are not buying a full new plan.
            </p>
            <div style={{ display: "grid", gap: "0.5rem", padding: "1rem", background: "var(--cds-layer-02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Unused {subscription.planTier} credit</span>
                <span>-{formatMoney(upgradePreview.creditAmount, upgradePreview.currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{upgradeTier} for the remaining period</span>
                <span>{formatMoney(upgradePreview.chargeAmount, upgradePreview.currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--cds-border-subtle-02)", paddingTop: "0.75rem", fontWeight: 700 }}>
                <span>Amount due now</span>
                <span style={{ color: "var(--cds-support-success)" }}>
                  {formatMoney(upgradePreview.amountDue, upgradePreview.currency)}
                </span>
              </div>
            </div>
            <p style={{ color: "var(--cds-text-secondary)", fontSize: "0.875rem" }}>
              Your billing date remains {fmt.datetime.datetime(subscription.currentPeriodEnd)}.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={isCancelModalOpen}
        danger
        modalHeading="Cancel Subscription"
        primaryButtonText={isCanceling ? "Canceling..." : "Yes, cancel my plan"}
        secondaryButtonText="No, keep it"
        onRequestClose={() => setIsCancelModalOpen(false)}
        onRequestSubmit={handleCancel}
        primaryButtonDisabled={isCanceling}
      >
        <p style={{ marginBottom: "1rem", color: "var(--cds-text-primary)" }}>
          Are you sure you want to cancel your {subscription.planTier}{" "}
          subscription?
        </p>
        <p style={{ color: "var(--cds-text-secondary)" }}>
          You will continue to have access to all {subscription.planTier}{" "}
          features until the end of your current billing period on{" "}
          <strong>
            {fmt.datetime.datetime(subscription.currentPeriodEnd)}
          </strong>
          .
        </p>
      </Modal>
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
    // Prefer Stripe identifiers, but fall back to on-chain txId for Solana payments
    return (
      item.stripePaymentIntentId ??
      item.stripeInvoiceId ??
      // paymentMethodDetails may contain a Solana transfer object with txId
      ((item.paymentMethodDetails as any)?.txId as string | undefined) ??
      "-"
    );
  };

  const resolvePlanLabel = (item: PaymentHistory) => {
    const directPlan = item.planName ?? item.planTier;
    if (directPlan) return directPlan;

    const amountCents = (item.amountCents ?? item.amount ?? 0) as number;
    if (amountCents === 3900) return "Lite";
    if (amountCents === 19900) return "Plus";
    if (amountCents === 49900) return "Pro";

    if (item.subscriptionId) {
      const mappedPlan = planBySubscriptionId.get(item.subscriptionId);
      if (mappedPlan) return mappedPlan;
    }
    // If this was a Solana transfer, the backend stores transfer details
    // in `paymentMethodDetails` (type, txId, amount (SOL)). Try to map
    // the Solana tx -> subscription (stripeSubscriptionId = `solana-${txId}`)
    // to recover the planTier.
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
      <div className={styles.emptyStateContainer}>
        <div className={styles.emptyStateContent}>
          <h3 className={styles.emptyStateTitle}>No purchase history</h3>
          <p className={styles.emptyStateDescription}>
            No purchases found in your history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sectionCard}>
      <table className={styles.simpleTable}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Plan</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Payment ID</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item) => (
            <tr key={item.id}>
              <td>{fmt.datetime.datetime(item.createdAt)}</td>
              <td>{resolvePlanLabel(item)}</td>
              <td className={styles.metricValue}>
                {
                  // If Solana transfer, show SOL amount (more meaningful than tiny USD test values)
                  ((item.paymentMethodDetails as any)?.type === "solana_transfer" || (item.paymentMethodDetails as any)?.txId)
                    ? (() => {
                        const pm = item.paymentMethodDetails as any;
                        const solAmt = pm?.amount;
                        if (typeof solAmt === "number") return fmt.num.unit(solAmt, "SOL");
                        // fallback to USD if SOL amount missing
                        return fmt.num.currency((item.amountCents ?? item.amount ?? 0)  / 100);
                      })()
                    : fmt.num.currency((item.amountCents ?? item.amount ?? 0) / 100)
                }
              </td>
              <td>
                <span
                  style={{
                    textTransform: "uppercase",
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: item.status === "succeeded" ? "#14F195" : "#ff4d4d",
                  }}
                >
                  {item.status}
                </span>
              </td>
              <td>
                <PaymentIdCell paymentId={paymentIdLabel(item)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentIdCell({ paymentId }: { paymentId: string }) {
  const [isCopied, setIsCopied] = useState(false);

  if (!paymentId || paymentId === "-") return <span>-</span>;

  const masked =
    paymentId.length > 12
      ? `${paymentId.slice(0, 6)}...${paymentId.slice(-4)}`
      : paymentId;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(paymentId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn("Clipboard write failed", err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm" style={{ color: "#94a3b8" }}>
        {masked}
      </span>
      <button
        onClick={handleCopy}
        className="p-1 transition-colors hover:text-[#14F195]"
        style={{ color: isCopied ? "#14F195" : "#64748b" }}
        title="Copy Full ID"
      >
        {isCopied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export default ProfileSubscriptionsTab;
