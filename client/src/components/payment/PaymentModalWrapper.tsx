import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useEffect, useState } from "react";
import { CheckoutForm } from "./CheckoutForm";
import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";

type Tier = {
  name: string;
  price: string;
};

type PaymentMethod = "card" | "bank" | "solana";

type PaymentModalWrapperProps = {
  open: boolean;
  tier: Tier | null;
  onClose: () => void;
  onSuccess: () => void;
};

type IntentState =
  | { status: "idle" }
  | { status: "ready"; tier: string; stripePromise: ReturnType<typeof loadStripe> }
  | { status: "error"; message: string };

/**
 * Wraps the Stripe Elements provider using Deferred Intent Creation.
 * 
 * Instead of creating the SetupIntent upfront:
 *   1. Load Stripe immediately
 *   2. Create Elements without clientSecret (deferred mode)
 *   3. User selects a payment method card
 *   4. On "Subscribe Now", CheckoutForm creates the SetupIntent with the selected paymentMethodTypes
 *   5. CheckoutForm then confirms with confirmSetup()
 *   6. On success → CheckoutForm calls POST /api/payment/activate-subscription
 */
export function PaymentModalWrapper({
  open,
  tier,
  onClose,
  onSuccess,
}: PaymentModalWrapperProps) {
  const { tr } = useLocalization();
  const [intentState, setIntentState] = useState<IntentState>({ status: "idle" });
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>("card");

  useEffect(() => {
    if (!open || !tier) {
      setIntentState({ status: "idle" });
      return;
    }

    setActiveMethod("card");

    const paidTiers = ["Lite", "Plus", "Pro"];
    if (!paidTiers.includes(tier.name)) return;

    try {
      // Load Stripe immediately (no need to wait for SetupIntent)
      const stripePromise = loadStripe(
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string || "",
      );

      setIntentState({
        status: "ready",
        tier: tier.name,
        stripePromise,
      });

      console.log("[PaymentModalWrapper] Stripe loaded for deferred intent creation");
    } catch (err) {
      console.error("[PaymentModalWrapper]", err);
      setIntentState({
        status: "error",
        message: tr("payment.errors.loadStripe"),
      });
    }
  }, [open, tier]);

  if (!open || !tier) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-xl bg-[#0f0f17] border border-white/5 shadow-[0_0_80px_rgba(20,241,149,0.12)] rounded-none overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="!px-6 !py-6 sm:!px-10 sm:!py-8 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b] mb-1">
                  {tr("payment.modal.eyebrow")}
                </p>
                <h2
                  id="payment-modal-title"
                  className="text-white font-bold text-xl tracking-tight"
                >
                  {tr("payment.modal.title", { tierName: tier.name })}
                </h2>
              </div>
              <button
                id="payment-modal-close-btn"
                type="button"
                onClick={onClose}
                className="text-[#64748b] hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
                aria-label={tr("payment.modal.close")}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="!px-6 !py-6 sm:!px-10 sm:!py-8 overflow-y-auto custom-scrollbar">
            {intentState.status === "error" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-red-400 text-sm">{intentState.message}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-[#78a9ff] hover:underline"
                >
                  {tr("payment.shared.close")}
                </button>
              </div>
            )}

            {intentState.status === "ready" && (
              <Elements
                key={`elements-${activeMethod === "bank" ? "bank" : "card"}`}
                stripe={intentState.stripePromise}
                options={{
                  mode: "setup",
                  currency: "usd",
                  locale: "en",
                  paymentMethodTypes:
                    activeMethod === "bank" ? ["us_bank_account"] : ["card"],
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#14F195",
                      colorBackground: "#0f0f17",
                      colorText: "#f8fafc",
                      colorDanger: "#f87171",
                      fontFamily: "Inter, sans-serif",
                      borderRadius: "12px",
                      spacingUnit: "5px",
                    },
                  },
                }}
              >
                <CheckoutForm
                  tierName={tier.name}
                  tierPrice={tier.price}
                  tierKey={intentState.tier as "Lite" | "Plus" | "Pro"}
                  activeMethod={activeMethod}
                  onMethodChange={setActiveMethod}
                  onSuccess={onSuccess}
                  onCancel={onClose}
                />
              </Elements>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
