import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState } from "react";
import client from "@/api/main";

type CheckoutFormProps = {
  tierName: string;
  tierPrice: string;
  tierKey: "Lite" | "Plus" | "Pro";
  onSuccess: () => void;
  onCancel: () => void;
};

/**
 * SetupIntent-based checkout form.
 *
 * Flow:
 *  1. User fills card → clicks "Subscribe"
 *  2. stripe.confirmSetup() — saves the card as a PaymentMethod on the customer
 *  3. We receive the confirmed paymentMethodId (pm_xxx)
 *  4. POST /api/payment/activate-subscription → backend creates the subscription
 *  5. onSuccess() is called → success modal shown
 */
export function CheckoutForm({
  tierName,
  tierPrice,
  tierKey,
  onSuccess,
  onCancel,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMsg(null);

    // Step 1: Confirm the SetupIntent — this saves the card to the customer.
    // redirect: "if_required" keeps us in-page for cards (no 3DS redirect needed in test mode).
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/pricing?setup=complete`,
      },
    });

    if (error) {
      setErrorMsg(error.message ?? "Card setup failed. Please try again.");
      setIsProcessing(false);
      return;
    }

    if (!setupIntent || setupIntent.status !== "succeeded") {
      setErrorMsg("Card setup did not complete. Please try again.");
      setIsProcessing(false);
      return;
    }

    // Step 2: Extract the paymentMethodId from the confirmed SetupIntent
    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : (setupIntent.payment_method as any)?.id;

    if (!paymentMethodId) {
      setErrorMsg("Could not retrieve payment method. Please try again.");
      setIsProcessing(false);
      return;
    }

    // Step 3: Ask the backend to create the subscription with this payment method
    try {
      const resp = await client.api.payment["activate-subscription"].$post({
        json: { paymentMethodId, tier: tierKey },
      });

      const body = await resp.json() as any;

      if (!resp.ok) {
        setErrorMsg(body.message ?? "Subscription activation failed. Please try again.");
        setIsProcessing(false);
        return;
      }

      console.log("[CheckoutForm] Subscription activated:", body.subscriptionId, "Status:", body.status);
      onSuccess();
    } catch (networkErr) {
      console.error("[CheckoutForm] Network error:", networkErr);
      setErrorMsg("A network error occurred. Please try again.");
      setIsProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center justify-between !p-6 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b]">
            Plan
          </p>
          <p className="text-white font-bold">{tierName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b]">
            Total
          </p>
          <p className="text-[#14F195] font-extrabold text-lg">{tierPrice}</p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden">
        <PaymentElement
          id="stripe-payment-element"
          options={{
            layout: "tabs",
            paymentMethodOrder: ["card"],
            terms: { card: "never" },
            wallets: { link: "never" },
          }}
        />
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
        >
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {errorMsg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          id="checkout-submit-btn"
          type="submit"
          disabled={isProcessing || !stripe}
          className="flex-1 !py-4 rounded-full text-sm font-bold uppercase tracking-widest text-[#0a0a0f] bg-[#14F195] hover:bg-[#0fd484] shadow-[0_0_24px_rgba(20,241,149,0.35)] hover:shadow-[0_0_36px_rgba(20,241,149,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Processing…" : "Subscribe Now"}
        </button>

        <button
          id="checkout-cancel-btn"
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 !py-4 rounded-full text-sm font-medium border border-white/10 text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all duration-200 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

    </form>
  );
}
