import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@carbon/react", () => ({
  Modal: ({
    open,
    children,
    primaryButtonText,
    secondaryButtonText,
    onRequestClose,
    onRequestSubmit,
    primaryButtonDisabled,
  }: any) =>
    open ? (
      <div role="dialog">
        {children}
        <button onClick={onRequestSubmit} disabled={primaryButtonDisabled}>
          {primaryButtonText}
        </button>
        <button onClick={onRequestClose}>{secondaryButtonText}</button>
      </div>
    ) : null,
}));

vi.mock("@/contexts/LocalizationContext", () => ({
  useLocalization: () => ({
    fmt: {
      datetime: {
        datetime: (value: string | null) => (value ? `formatted:${value}` : "-"),
      },
      num: {
        currency: (value: number) => `$${value}`,
        unit: (value: number, unit: string) => `${value} ${unit}`,
      },
      text: {},
    },
  }),
}));

vi.mock("@/components/profile/shared/ProfileLoadingState", () => ({
  default: () => <div>Loading subscriptions</div>,
}));

vi.mock("@/services/profile/subscriptionApi", () => ({
  getUserSubscription: vi.fn(),
  getUserSubscriptions: vi.fn(),
  getUserPaymentHistory: vi.fn(),
  cancelSubscription: vi.fn(),
  upgradeSubscription: vi.fn(),
}));

import { ProfileSubscriptionsTab } from "@/components/profile/ProfileSubscriptionsTab";
import {
  cancelSubscription,
  getUserPaymentHistory,
  getUserSubscription,
  getUserSubscriptions,
  type Subscription,
} from "@/services/profile/subscriptionApi";

const stripeSubscription: Subscription = {
  id: "local-sub-1",
  userId: "user-1",
  stripeSubscriptionId: "sub_123",
  stripeCustomerId: "cus_123",
  planTier: "Lite",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodStart: "2026-06-08T00:00:00.000Z",
  currentPeriodEnd: "2026-07-08T00:00:00.000Z",
  createdAt: "2026-06-08T00:00:00.000Z",
  updatedAt: "2026-06-08T00:00:00.000Z",
};

const solanaSubscription: Subscription = {
  ...stripeSubscription,
  id: "local-solana-sub-1",
  stripeSubscriptionId: "solana-tx-123",
  stripeCustomerId: "solana-user-1",
};

function mockSubscriptionData(subscription: Subscription) {
  vi.mocked(getUserSubscription).mockResolvedValue(subscription);
  vi.mocked(getUserSubscriptions).mockResolvedValue([subscription]);
  vi.mocked(getUserPaymentHistory).mockResolvedValue([]);
}

describe("ProfileSubscriptionsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders cancel and upgrade actions for Stripe-managed subscriptions", async () => {
    mockSubscriptionData(stripeSubscription);

    render(<ProfileSubscriptionsTab />);

    expect(await screen.findByRole("button", { name: "Cancel Subscription" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Plus" })).toBeInTheDocument();
  });

  it("hides management actions and shows access expiry for Solana subscriptions", async () => {
    mockSubscriptionData(solanaSubscription);

    render(<ProfileSubscriptionsTab />);

    expect(await screen.findByText("Access Expires")).toBeInTheDocument();
    expect(screen.getByText("formatted:2026-07-08T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Subscription" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upgrade to/i })).not.toBeInTheDocument();
  });

  it("calls cancelSubscription only from the Stripe confirmation flow", async () => {
    mockSubscriptionData(stripeSubscription);
    vi.mocked(cancelSubscription).mockResolvedValue({
      success: true,
      status: "active",
      cancel_at_period_end: true,
      subscription: {
        ...stripeSubscription,
        cancelAtPeriodEnd: true,
      },
    });

    render(<ProfileSubscriptionsTab />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel Subscription" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel my plan" }));

    await waitFor(() => {
      expect(cancelSubscription).toHaveBeenCalledWith("sub_123");
    });
  });
});
