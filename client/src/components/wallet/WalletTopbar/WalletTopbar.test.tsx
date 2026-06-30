import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletTopbar } from "./WalletTopbar";

const mocks = vi.hoisted(() => ({
  getFollowedWallets: vi.fn(),
  postFollowedWallet: vi.fn(),
  deleteFollowedWallet: vi.fn(),
  fetchWalletIntelligence: vi.fn(),
  fetchWalletTags: vi.fn(),
  saveWalletTags: vi.fn(),
  toggleWallet: vi.fn(),
  useAuth: vi.fn(),
  useWatchlist: vi.fn(),
  navigate: vi.fn(),
}));

const translations: Record<string, string> = {
  "wallet.followWallet": "Follow wallet",
  "wallet.unfollowWallet": "Unfollow wallet",
  "wallet.walletFollowed": "Wallet followed",
  "wallet.walletUnfollowed": "Wallet unfollowed",
  "wallet.walletAlreadyFollowed": "Wallet already followed",
  "wallet.followWalletNotFound": "Wallet was not followed",
  "wallet.followWalletFailed": "Failed to follow wallet",
  "wallet.unfollowWalletFailed": "Failed to unfollow wallet",
  "wallet.followWalletSuccessHint": "Manage alerts and delivery settings from Alerts.",
  "wallet.manageAlerts": "Manage alerts",
  "wallet.bookmarked": "Bookmarked",
  "wallet.bookmarkWallet": "Bookmark this wallet",
  "wallet.compareWallet": "Compare this wallet",
  "wallet.shareWallet": "Share this wallet",
  "walletPage.defaultWalletName": "Wallet",
  "walletPage.walletAgeUnitDay": "day",
  "walletPage.walletAgeUnitMonth": "month",
  "walletPage.walletAgeUnitYear": "year",
  "walletPage.unknownEntity": "Unknown",
  "walletPage.firstFunderTag": "First funder",
};

vi.mock("@/api/main", () => ({
  default: {
    api: {
      alerts: {
        index: {
          $get: mocks.getFollowedWallets,
          $post: mocks.postFollowedWallet,
        },
        ":id": {
          $delete: mocks.deleteFollowedWallet,
        },
      },
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/contexts/LocalizationContext", () => ({
  useLocalization: () => ({
    tr: (key: string) => translations[key] ?? key,
    fmt: {},
  }),
}));

vi.mock("@/contexts/WatchlistContext", () => ({
  useWatchlist: mocks.useWatchlist,
}));

vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/services/wallet/walletApi", () => ({
  fetchWalletIntelligence: mocks.fetchWalletIntelligence,
}));

vi.mock("@/services/wallet/walletTagsApi", () => ({
  fetchWalletTags: mocks.fetchWalletTags,
  saveWalletTags: mocks.saveWalletTags,
}));

vi.mock("@/components/common/PeriodSelector/PeriodSelector", () => ({
  PeriodSelector: () => <div data-testid="period-selector" />,
}));

vi.mock("@/components/wallet/WalletLabelModal/WalletLabelModal", () => ({
  WalletLabelModal: () => null,
}));

vi.mock("@/components/wallet/WalletTagsModal/WalletTagsModal", () => ({
  WalletTagsModal: () => null,
}));

vi.mock("@carbon/react", () => ({
  InlineNotification: ({
    title,
    subtitle,
    onClose,
  }: {
    title: string;
    subtitle?: string;
    onClose?: () => void;
  }) => (
    <div role="status">
      <strong>{title}</strong>
      {subtitle ? <span>{subtitle}</span> : null}
      {onClose ? <button onClick={onClose}>Close</button> : null}
    </div>
  ),
  Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const walletAddress = "3nMNd89AxwHUa1AFvQGqohRkxFEQsTsgiEyEyqXFHyyH";

function renderTopbar() {
  return render(
    <WalletTopbar
      address={walletAddress}
      onAiAnalysisOpen={vi.fn()}
      onAuditOpen={vi.fn()}
      onExportData={vi.fn()}
      onExportCharts={vi.fn()}
      onExportPdf={vi.fn()}
      isExporting={false}
      currentPeriod="24H"
      onPeriodChange={vi.fn()}
    />,
  );
}

describe("WalletTopbar followed wallet bell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.fetchWalletIntelligence.mockResolvedValue(null);
    mocks.fetchWalletTags.mockResolvedValue([]);
    mocks.useAuth.mockReturnValue({
      user: { userId: "user-1", displayName: "User" },
      isUserLoading: false,
      setUser: vi.fn(),
      refreshUser: vi.fn(),
      signOut: vi.fn(),
    });
    mocks.useWatchlist.mockReturnValue({
      tokenWatchlist: [],
      walletWatchlist: [],
      isLoading: false,
      tokenPending: {},
      walletPending: {},
      refetch: vi.fn(),
      addToken: vi.fn(),
      removeToken: vi.fn(),
      toggleToken: vi.fn(),
      addWallet: vi.fn(),
      removeWallet: vi.fn(),
      toggleWallet: mocks.toggleWallet,
    });
  });

  it("follows the current wallet through the followed-wallet API", async () => {
    mocks.getFollowedWallets.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    mocks.postFollowedWallet.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        wallet: {
          id: 42,
          address: walletAddress,
          label: null,
          createdAt: new Date().toISOString(),
        },
        heliusSync: { ok: true, status: 200 },
      }),
    });

    renderTopbar();

    const followButton = await screen.findByRole("button", {
      name: "Follow wallet",
    });
    expect(followButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(followButton);

    await waitFor(() => {
      expect(mocks.postFollowedWallet).toHaveBeenCalledWith({
        json: { address: walletAddress },
      });
    });
    expect(mocks.deleteFollowedWallet).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Wallet followed",
    );
    expect(
      screen.getByRole("button", { name: "Unfollow wallet" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows followed state and supports unfollowing from the bell", async () => {
    mocks.getFollowedWallets.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 7,
          address: walletAddress,
          label: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    mocks.deleteFollowedWallet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        deleted: true,
        heliusSync: { ok: true, status: 200 },
      }),
    });

    renderTopbar();

    const unfollowButton = await screen.findByRole("button", {
      name: "Unfollow wallet",
    });
    expect(unfollowButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(unfollowButton);

    await waitFor(() => {
      expect(mocks.deleteFollowedWallet).toHaveBeenCalledWith({
        param: { id: "7" },
      });
    });
    expect(mocks.postFollowedWallet).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Wallet unfollowed",
    );
    expect(
      screen.getByRole("button", { name: "Follow wallet" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
