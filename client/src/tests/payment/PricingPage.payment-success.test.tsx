import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PricingPage from "@/pages/pricing";
import { LocalizationProvider } from "@/contexts/LocalizationContext";

vi.mock("@/components/landing", () => ({
  LandingFooter: () => <footer>Footer</footer>,
  LandingNavbar: () => <nav>Navbar</nav>,
}));

vi.mock("@/components/landing/tokens", () => ({
  LANDING_ACCENT_GLOW: "rgba(20,241,149,0.2)",
  btnPrimaryBase: "mock-primary",
  btnPrimaryEnter: vi.fn(),
  btnPrimaryLeave: vi.fn(),
  createLandingThemeStyles: () => ({}),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { userId: "user-1", displayName: "Test User" },
    refreshUser: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useUserTheme: () => ({ theme: "g100" }),
}));

vi.mock("@/components/payment", () => ({
  AuthReminderModal: () => null,
  PaymentModalWrapper: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess: () => void;
  }) =>
    open ? (
      <div data-testid="payment-modal">
        <button onClick={onSuccess}>Mock Solana Success</button>
      </div>
    ) : null,
  PaymentSuccessModal: ({
    open,
    tierName,
  }: {
    open: boolean;
    tierName: string;
  }) => (open ? <div role="dialog">Payment Successful for {tierName}</div> : null),
}));

function render(ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(ui, { wrapper: LocalizationProvider });
}

describe("PricingPage payment success state", () => {
  it("should close the payment modal and open the success modal after payment success", async () => {
    render(<PricingPage />);

    await userEvent.click(screen.getAllByRole("button", { name: /buy now/i })[0]);
    expect(screen.getByTestId("payment-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /mock solana success/i }));

    expect(screen.queryByTestId("payment-modal")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Payment Successful");
  });
});
