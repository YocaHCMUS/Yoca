import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useEffect, useState } from "react";
import { CheckoutForm } from "./CheckoutForm";
import client from "@/api/main";

type Tier = {
  name: string;
  price: string;
};

type PaymentModalWrapperProps = {
  open: boolean;
  tier: Tier | null;
  onClose: () => void;
  onSuccess: () => void;
};

type IntentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; clientSecret: string; stripePromise: ReturnType<typeof loadStripe> }
  | { status: "error"; message: string };

/**
 * Wraps the Stripe Elements provider.
 * Fetches a PaymentIntent clientSecret from the backend, then renders
 * CheckoutForm inside the Elements context.
 */
export function PaymentModalWrapper({
  open,
  tier,
  onClose,
  onSuccess,
}: PaymentModalWrapperProps) {
  const [intentState, setIntentState] = useState<IntentState>({ status: "idle" });

  useEffect(() => {
    if (!open || !tier) {
      setIntentState({ status: "idle" });
      return;
    }

    // Only fetch if tier is one that requires payment
    const paidTiers = ["Lite", "Plus", "Pro"];
    if (!paidTiers.includes(tier.name)) return;

    let cancelled = false;
    setIntentState({ status: "loading" });

    async function fetchIntent() {
      try {
        const resp = await client.api.payment["create-intent"].$post({
          json: {
            tier: tier!.name as "Lite" | "Plus" | "Pro",
            saveCard: false,
          },
        });

        if (cancelled) return;

        if (!resp.ok) {
          const body = await resp.json();
          const msg =
            (body as { message?: string }).message ??
            "Failed to initialise payment. Please try again.";
          setIntentState({ status: "error", message: msg });
          return;
        }

        const data = await resp.json() as { clientSecret: string; publishableKey: string };

        const stripePromise = loadStripe(
          data.publishableKey ||
          (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string) ||
          "",
        );

        setIntentState({
          status: "ready",
          clientSecret: data.clientSecret,
          stripePromise,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("[PaymentModalWrapper]", err);
        setIntentState({
          status: "error",
          message: "A network error occurred. Please try again.",
        });
      }
    }

    fetchIntent();

    return () => {
      cancelled = true;
    };
  }, [open, tier]);

  if (!open || !tier) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-xl bg-[#0f0f17] border border-white/10 shadow-[0_0_80px_rgba(20,241,149,0.12)] rounded-none overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header (Fixed) */}
          <div className="!px-6 !py-6 sm:!px-10 sm:!py-8 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b] mb-1">
                  Secure Payment
                </p>
                <h2
                  id="payment-modal-title"
                  className="text-white font-bold text-xl tracking-tight"
                >
                  Subscribe to {tier.name}
                </h2>
              </div>
              <button
                id="payment-modal-close-btn"
                type="button"
                onClick={onClose}
                className="text-[#64748b] hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
                aria-label="Close payment modal"
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

          {/* Body (Scrollable) */}
          <div className="!px-6 !py-6 sm:!px-10 sm:!py-8 overflow-y-auto custom-scrollbar">
            {intentState.status === "loading" && (
                <div className="flex flex-col items-center gap-4 py-12 text-[#64748b]">
                  <svg
                    className="w-8 h-8 animate-spin text-[#14F195]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <p className="text-sm">Preparing secure payment…</p>
                </div>
              )}

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
                    Close
                  </button>
                </div>
              )}

              {intentState.status === "ready" && (
                <Elements
                  stripe={intentState.stripePromise}
                  options={{
                    clientSecret: intentState.clientSecret,
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
