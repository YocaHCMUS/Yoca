import TabContainer from "@/components/tabContainer/tabContainer";
import { useEffect, useState } from "react";
import styles from "./profile.module.scss";
import { 
  getUserSubscription, 
  getUserSubscriptions,
  getUserPaymentHistory,
  cancelSubscription,
  upgradeSubscription,
  type Subscription, 
  type PaymentHistory 
} from "@/services/profile/subscriptionApi";
import { formatPrice, formatTimestamp } from "@/util/format";
import { Loading } from "@carbon/react";

type SubscriptionSubtab = "subscriptions" | "payment-history";

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
  const [activeSubtab, setActiveSubtab] = useState<SubscriptionSubtab>(
    "subscriptions"
  );
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
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
    return <div className={styles.emptyStateContainer}><Loading withOverlay={false} /></div>;
  }

  return (
    <div className={styles.subscriptionsTabContainer}>
      <TabContainer
        activeTab={subtabIndex}
        names={subtabs.map((tab) => tab.label)}
        tabs={[
          <SubscriptionsPanel key="subscriptions" subscription={subscription} subscriptions={subscriptions} onUpdate={fetchData} />,
          <PaymentHistoryPanel key="payment-history" history={history} subscriptions={subscriptions} />,
        ]}
        onTabChange={(index) => setActiveSubtab(subtabs[index].id)}
      />
    </div>
  );
}

import { Modal } from "@carbon/react";

function SubscriptionsPanel({ subscription, subscriptions, onUpdate }: { subscription: Subscription | null, subscriptions: Subscription[], onUpdate: () => void }) {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

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
            onClick={() => window.location.href = "/pricing"}
          >
            View Pricing Plans
          </button>
        </div>
      </div>
    );
  }

  const handleCancel = async () => {
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

  const handleUpgrade = async (newTier: "Lite" | "Plus" | "Pro") => {
    setIsUpgrading(true);
    try {
      const res = await upgradeSubscription(subscription.stripeSubscriptionId, newTier);
      if (res.clientSecret) {
        // Option A fallback: require further authentication via checkout
        // For now, redirect to a generic payment confirmation or show an alert.
        // A full implementation would redirect to the CheckoutForm with the clientSecret.
        window.location.href = `/pricing?payment_intent_client_secret=${res.clientSecret}&upgrade=true`;
      } else {
        alert("Subscription upgraded successfully!");
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to upgrade subscription", err);
      alert("Failed to upgrade subscription. Please try again.");
    } finally {
      setIsUpgrading(false);
    }
  };

  const availableUpgrades = ["Lite", "Plus", "Pro"].filter(
    tier => {
      const tiers = { Lite: 1, Plus: 2, Pro: 3 };
      return tiers[tier as keyof typeof tiers] > tiers[subscription.planTier as keyof typeof tiers];
    }
  );

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className={styles.emptyStateTitle}>Current Plan</h3>
        {subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
          <button 
            className={styles.primaryButton} 
            style={{ backgroundColor: "#ff4d4d", padding: "0.5rem 1rem", fontSize: "0.875rem" }}
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
            <th>Period End</th>
            {availableUpgrades.length > 0 && <th>Upgrade</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.metricValue} style={{ color: "#14F195" }}>{subscription.planTier}</td>
            <td>
              <span style={{ 
                textTransform: "uppercase", 
                fontSize: "12px", 
                fontWeight: "bold",
                color: subscription.status === "active" ? (subscription.cancelAtPeriodEnd ? "#f59e0b" : "#14F195") : "#64748b" 
              }}>
                {subscription.status} {subscription.cancelAtPeriodEnd && "(Cancels at end of period)"}
              </span>
            </td>
            <td>{formatTimestamp(subscription.currentPeriodStart)}</td>
            <td>{formatTimestamp(subscription.currentPeriodEnd)}</td>
            {availableUpgrades.length > 0 && (
              <td>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {availableUpgrades.map(tier => (
                    <button 
                      key={tier}
                      className={styles.primaryButton}
                      style={{ padding: "0.25rem 0.5rem", minHeight: "auto", fontSize: "0.75rem" }}
                      disabled={isUpgrading}
                      onClick={() => handleUpgrade(tier as any)}
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
                  <td>{formatTimestamp(item.currentPeriodStart)}</td>
                  <td>{formatTimestamp(item.currentPeriodEnd)}</td>
                  <td>{formatAbsoluteTimestamp(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

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
        <p style={{ marginBottom: '1rem', color: '#e0e0e0' }}>
          Are you sure you want to cancel your {subscription.planTier} subscription?
        </p>
        <p style={{ color: '#a8a29e' }}>
          You will continue to have access to all {subscription.planTier} features until the end of your current billing period on <strong>{formatTimestamp(subscription.currentPeriodEnd)}</strong>.
        </p>
      </Modal>
    </div>
  );
}

function PaymentHistoryPanel({ history, subscriptions }: { history: PaymentHistory[]; subscriptions: Subscription[] }) {
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

    if (item.subscriptionId) {
      const mappedPlan = planBySubscriptionId.get(item.subscriptionId);
      if (mappedPlan) return mappedPlan;
    }

    const amountCents = (item.amountCents ?? item.amount ?? 0) as number;
    if (amountCents === 3900) return "Lite";
    if (amountCents === 19900) return "Plus";
    if (amountCents === 49900) return "Pro";

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
              <td>{formatTimestamp(item.createdAt)}</td>
              <td>{resolvePlanLabel(item)}</td>
              <td className={styles.metricValue}>
                {formatPrice(((item.amountCents ?? item.amount ?? 0) as number) / 100)}
              </td>
              <td>
                <span style={{ 
                  textTransform: "uppercase", 
                  fontSize: "11px", 
                  fontWeight: "bold",
                  color: item.status === "succeeded" ? "#14F195" : "#ff4d4d" 
                }}>
                  {item.status}
                </span>
              </td>
              <td style={{ fontSize: "11px", color: "#64748b" }}>{paymentIdLabel(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProfileSubscriptionsTab;
