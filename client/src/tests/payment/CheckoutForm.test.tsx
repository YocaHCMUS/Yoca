import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render as rtlRender, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutForm } from "@/components/payment/CheckoutForm";
import { LocalizationProvider } from "@/contexts/LocalizationContext";

// ---------------------------------------------------------------------------
// Module Mocks
// ---------------------------------------------------------------------------

// Mock Stripe hooks and elements — prevents real Stripe.js from loading
vi.mock("@stripe/react-stripe-js", () => ({
  useStripe: vi.fn(),
  useElements: vi.fn(),
  PaymentElement: ({ id }: { id?: string }) => (
    <div data-testid={id ?? "payment-element"} aria-label="Stripe Payment Element" />
  ),
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock SolanaPaymentFlow so we can assert when it is rendered
vi.mock("@/components/payment/SolanaPaymentFlow", () => ({
  SolanaPaymentFlow: ({
    tierName,
    onCancel,
    onSuccess,
  }: {
    tierName: string;
    onCancel: () => void;
    onSuccess: () => void;
  }) => (
    <div data-testid="solana-payment-flow">
      <span>Solana flow for {tierName}</span>
      <button onClick={onSuccess}>SolanaSuccess</button>
      <button onClick={onCancel}>SolanaCancel</button>
    </div>
  ),
}));

// Mock the Hono client — isolates from real network
vi.mock("@/api/main", () => ({
  default: {
    api: {
      payment: {
        "setup-intent": {
          $post: vi.fn(),
        },
        "activate-subscription": {
          $post: vi.fn(),
        },
      },
    },
  },
}));

import { useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import client from "@/api/main";

// ---------------------------------------------------------------------------
// Helper types & factories
// ---------------------------------------------------------------------------

interface MockResponse<T> {
  ok: boolean;
  json: () => Promise<T>;
}

function makeStripeSetupIntentResponse(overrides: { setupIntent?: Record<string, unknown>; error?: { message: string } } = {}) {
  return {
    setupIntent: { status: "succeeded", payment_method: "pm_test_123", ...overrides.setupIntent },
    error: overrides.error ?? undefined,
  };
}

const defaultProps = {
  tierName: "Plus Plan",
  tierPrice: "$29/mo",
  tierKey: "Plus" as const,
  activeMethod: "card" as const,
  onMethodChange: vi.fn(),
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

function render(ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(ui, { wrapper: LocalizationProvider });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("CheckoutForm Component", () => {
  let mockStripe: { confirmSetup: ReturnType<typeof vi.fn> };
  let mockElements: { getElement: ReturnType<typeof vi.fn>; submit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default Stripe mocks — succeed by default
    mockStripe = {
      confirmSetup: vi.fn().mockResolvedValue(makeStripeSetupIntentResponse()),
    };
    mockElements = {
      getElement: vi.fn(),
      submit: vi.fn().mockResolvedValue({ error: undefined }),
    };

    vi.mocked(useStripe).mockReturnValue(mockStripe as unknown as Stripe);
    vi.mocked(useElements).mockReturnValue(mockElements as unknown as StripeElements);

    // Default: backend setup-intent succeeds
    vi.mocked(client.api.payment["setup-intent"].$post).mockResolvedValue({
      ok: true,
      json: async () => ({
        clientSecret: "seti_secret_test",
        setupIntentId: "seti_123",
        publishableKey: "pk_test",
        tier: "Plus",
      }),
    } as any);

    // Default: activate-subscription succeeds
    vi.mocked(client.api.payment["activate-subscription"].$post).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        subscriptionId: "sub_test_123",
        status: "active",
      }),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────
  describe("Rendering & Initial State", () => {
    it("should render the order summary with tier name and price", () => {
      render(<CheckoutForm {...defaultProps} />);
      expect(screen.getByText("Plus Plan")).toBeInTheDocument();
      expect(screen.getByText("$29/mo")).toBeInTheDocument();
    });

    it("should render all three payment method buttons", () => {
      render(<CheckoutForm {...defaultProps} />);
      expect(screen.getByRole("button", { name: /card/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /bank/i })).toBeInTheDocument();
      // Wallet button (Solana) — uses aria fallback
      expect(screen.getByText("Wallet")).toBeInTheDocument();
    });

    it("should render the Stripe card form when activeMethod is 'card'", () => {
      render(<CheckoutForm {...defaultProps} activeMethod="card" />);
      expect(screen.getByTestId("stripe-payment-element-card")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /subscribe now/i })).toBeInTheDocument();
    });

    it("should render the Stripe bank form when activeMethod is 'bank'", () => {
      render(<CheckoutForm {...defaultProps} activeMethod="bank" />);
      expect(screen.getByTestId("stripe-payment-element-bank")).toBeInTheDocument();
    });

    it("should render the SolanaPaymentFlow when activeMethod is 'solana'", () => {
      render(<CheckoutForm {...defaultProps} activeMethod="solana" />);
      expect(screen.getByTestId("solana-payment-flow")).toBeInTheDocument();
      expect(screen.getByText("Solana flow for Plus Plan")).toBeInTheDocument();
    });

    it("should bubble Solana success to the parent checkout handler", async () => {
      const onSuccessMock = vi.fn();
      render(<CheckoutForm {...defaultProps} activeMethod="solana" onSuccess={onSuccessMock} />);

      await userEvent.click(screen.getByRole("button", { name: /solanasuccess/i }));

      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });

    it("should NOT render card or bank form when activeMethod is 'solana'", () => {
      render(<CheckoutForm {...defaultProps} activeMethod="solana" />);
      expect(screen.queryByTestId("stripe-payment-element-card")).not.toBeInTheDocument();
      expect(screen.queryByTestId("stripe-payment-element-bank")).not.toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tab / Method Switching
  // ─────────────────────────────────────────────────────────────────────────
  describe("Payment Method Switching", () => {
    it("should call onMethodChange('card') when Card button is clicked", async () => {
      const onMethodChangeMock = vi.fn();
      render(<CheckoutForm {...defaultProps} activeMethod="solana" onMethodChange={onMethodChangeMock} />);

      await userEvent.click(screen.getByRole("button", { name: /card/i }));
      expect(onMethodChangeMock).toHaveBeenCalledWith("card");
    });

    it("should call onMethodChange('bank') when Bank button is clicked", async () => {
      const onMethodChangeMock = vi.fn();
      render(<CheckoutForm {...defaultProps} activeMethod="card" onMethodChange={onMethodChangeMock} />);

      await userEvent.click(screen.getByRole("button", { name: /bank/i }));
      expect(onMethodChangeMock).toHaveBeenCalledWith("bank");
    });

    it("should call onMethodChange('solana') when Wallet button is clicked", async () => {
      const onMethodChangeMock = vi.fn();
      render(<CheckoutForm {...defaultProps} activeMethod="card" onMethodChange={onMethodChangeMock} />);

      // Wallet button is identified by the text "Wallet"
      const walletBtn = screen.getByText("Wallet").closest("button")!;
      await userEvent.click(walletBtn);
      expect(onMethodChangeMock).toHaveBeenCalledWith("solana");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Stripe Card — Happy Path
  // ─────────────────────────────────────────────────────────────────────────
  describe("Stripe Card — Happy Path", () => {
    it("should show 'Processing…' label while the form is being submitted", async () => {
      // Arrange — keep the request pending so only the in-progress state is asserted
      vi.mocked(client.api.payment["setup-intent"].$post).mockImplementation(
        () => new Promise(() => { /* never resolves */ })
      );

      render(<CheckoutForm {...defaultProps} />);

      // Act
      const form = screen.getByTestId("stripe-payment-element-card").closest("form")!;
      fireEvent.submit(form);

      // Assert — processing state is shown
      expect(await screen.findByText("Processing…")).toBeInTheDocument();
    });

    it("should call onSuccess after successful card setup + activation", async () => {
      render(<CheckoutForm {...defaultProps} />);

      const form = screen.getByTestId("stripe-payment-element-card").closest("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockElements.submit).toHaveBeenCalledTimes(1);
        expect(mockStripe.confirmSetup).toHaveBeenCalledTimes(1);
        expect(client.api.payment["activate-subscription"].$post).toHaveBeenCalledTimes(1);
        expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
      });

      expect(mockElements.submit.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(client.api.payment["setup-intent"].$post).mock.invocationCallOrder[0],
      );
    });

    it("should pass the paymentMethodId from the SetupIntent to activate-subscription", async () => {
      mockStripe.confirmSetup.mockResolvedValue(
        makeStripeSetupIntentResponse({ setupIntent: { status: "succeeded", payment_method: "pm_specific_123" } })
      );

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      await waitFor(() => {
        expect(client.api.payment["activate-subscription"].$post).toHaveBeenCalledWith(
          expect.objectContaining({
            json: expect.objectContaining({ paymentMethodId: "pm_specific_123" }),
          })
        );
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Stripe Edge Cases — Setup Intent backend failures
  // ─────────────────────────────────────────────────────────────────────────
  describe("Stripe Edge Cases — Backend Errors", () => {
    it("should show error message when backend returns 400 for setup-intent", async () => {
      // Arrange
      vi.mocked(client.api.payment["setup-intent"].$post).mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Invalid payment method type." }),
      } as any);

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      // Assert — error banner appears
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Invalid payment method type.");
      });
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    });

    it("should show generic error when backend returns 500 for setup-intent", async () => {
      // Arrange
      vi.mocked(client.api.payment["setup-intent"].$post).mockResolvedValue({
        ok: false,
        json: async () => ({ message: undefined }),
      } as any);

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Failed to create payment intent. Please try again."
        );
      });
    });

    it("should show error when backend returns a missing clientSecret", async () => {
      // Arrange
      vi.mocked(client.api.payment["setup-intent"].$post).mockResolvedValue({
        ok: true,
        json: async () => ({ clientSecret: null, setupIntentId: "seti_1", publishableKey: "pk_test" }),
      } as any);

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Payment setup failed. Please try again.");
      });
    });

    it("should surface a Stripe confirmSetup error (e.g. card declined)", async () => {
      // Arrange
      mockStripe.confirmSetup.mockResolvedValue({
        setupIntent: undefined,
        error: { message: "Your card was declined." },
      });

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Your card was declined.");
      });
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    });

    it("should surface an error when SetupIntent status is not succeeded", async () => {
      // Arrange — incomplete card details scenario
      mockStripe.confirmSetup.mockResolvedValue({
        setupIntent: { status: "requires_action", payment_method: "pm_123" },
        error: undefined,
      });

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Card setup did not complete. Please try again.");
      });
    });

    it("should show error when SetupIntent payment_method is missing", async () => {
      // Arrange
      mockStripe.confirmSetup.mockResolvedValue({
        setupIntent: { status: "succeeded", payment_method: null },
        error: undefined,
      });

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Could not retrieve payment method. Please try again."
        );
      });
    });

    it("should show error when activate-subscription returns 400", async () => {
      // Arrange
      vi.mocked(client.api.payment["activate-subscription"].$post).mockResolvedValue({
        ok: false,
        json: async () => ({ message: "No Stripe customer found." }),
      } as any);

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("No Stripe customer found.");
      });
    });

    it("should show generic error on unhandled network failure", async () => {
      // Arrange
      vi.mocked(client.api.payment["setup-intent"].$post).mockRejectedValue(
        new Error("Network Error")
      );

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "A network error occurred. Please try again."
        );
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Guard Rails
  // ─────────────────────────────────────────────────────────────────────────
  describe("Guard Rails", () => {
    it("should not submit if stripe is null (not yet loaded)", () => {
      vi.mocked(useStripe).mockReturnValue(null);

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      expect(client.api.payment["setup-intent"].$post).not.toHaveBeenCalled();
    });

    it("should not submit if elements is null (not yet loaded)", () => {
      vi.mocked(useElements).mockReturnValue(null);

      render(<CheckoutForm {...defaultProps} />);
      fireEvent.submit(screen.getByTestId("stripe-payment-element-card").closest("form")!);

      expect(client.api.payment["setup-intent"].$post).not.toHaveBeenCalled();
    });

    it("should disable the Subscribe button while processing", async () => {
      vi.mocked(client.api.payment["setup-intent"].$post).mockImplementation(
        () => new Promise(() => { /* never resolves */ })
      );

      render(<CheckoutForm {...defaultProps} />);
      const form = screen.getByTestId("stripe-payment-element-card").closest("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /processing/i })).toBeDisabled();
      });
    });

    it("should call onCancel when Cancel button is clicked", async () => {
      const onCancelMock = vi.fn();
      render(<CheckoutForm {...defaultProps} onCancel={onCancelMock} />);

      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });
  });
});
