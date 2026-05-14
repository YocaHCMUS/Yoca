import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState } from "react";

type CheckoutFormProps = {
  tierName: string;
  tierPrice: string;
  onSuccess: () => void;
  onCancel: () => void;
};

/**
 * The inner Stripe checkout form rendered inside an Elements provider.
 * Handles card collection, optional "save card" toggle, and payment confirmation.
 */
export function CheckoutForm({
  tierName,
  tierPrice,
  onSuccess,
  onCancel,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [saveCard, setSaveCard] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMsg(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pricing?success=true`,
        save_payment_method: saveCard,
      },
      // We handle redirect ourselves (in the return_url), so redirect is always.
    });

    // If we reach here, confirmPayment failed immediately (e.g. card declined).
    if (error) {
      setErrorMsg(error.message ?? "Payment failed. Please try again.");
      setIsProcessing(false);
      return;
    }

    // On success Stripe will redirect to return_url, but if no redirect we call onSuccess
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Tier summary */}
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

      {/* Stripe Payment Element */}
      <div className="rounded-xl overflow-hidden">
        <PaymentElement
          id="stripe-payment-element"
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {/* Save card checkbox */}
      <label
        htmlFor="save-card-checkbox"
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div className="relative flex-shrink-0">
          <input
            id="save-card-checkbox"
            type="checkbox"
            checked={saveCard}
            onChange={(e) => setSaveCard(e.target.checked)}
            className="sr-only"
          />
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
              saveCard
                ? "bg-[#14F195] border-[#14F195]"
                : "bg-transparent border-white/30 group-hover:border-white/60"
            }`}
          >
            {saveCard && (
              <svg
                className="w-3 h-3 text-[#0a0a0f]"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        <div>
          <span className="text-sm text-[#cbd5e1] font-medium">
            Save this card for future payments
          </span>
          <p className="text-xs text-[#64748b] mt-0.5">
            Your card details are securely stored by Stripe.
          </p>
        </div>
      </label>

      {/* Error message */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
        >
          <svg
            className="w-4 h-4 shrink-0 mt-0.5"
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
          {errorMsg}
        </div>
      )}

      {/* Submit + Cancel */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          id="checkout-submit-btn"
          type="submit"
          disabled={isProcessing || !stripe}
          className="flex-1 !py-4 rounded-full text-sm font-bold uppercase tracking-widest text-[#0a0a0f] bg-[#14F195] hover:bg-[#0fd484] shadow-[0_0_24px_rgba(20,241,149,0.35)] hover:shadow-[0_0_36px_rgba(20,241,149,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Processing…" : "Pay Now"}
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

      {/* Test mode notice */}
      <p className="text-center text-[11px] text-[#475569] mt-2">
        🔒 Stripe test mode — use card{" "}
        <span className="font-mono text-[#64748b]">4242 4242 4242 4242</span>
      </p>
    </form>
  );
}
