import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState } from "react";
import { Building2, CreditCard, Wallet } from "lucide-react";
import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { SolanaPaymentFlow } from "./SolanaPaymentFlow";

type CheckoutFormProps = {
  tierName: string;
  tierPrice: string;
  tierKey: "Lite" | "Plus" | "Pro";
  activeMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  onSuccess: () => void;
  onCancel: () => void;
};

type PaymentMethod = "card" | "bank" | "solana";

/**
 * Dual-payment checkout form supporting:
 *  1. Stripe (Card + Bank Transfer)
 *  2. Solana Devnet Wallet (Phantom/Solflare)
 *
 * Stripe Flow:
 *  1. User fills card → clicks "Subscribe"
 *  2. stripe.confirmSetup() — saves the card as a PaymentMethod on the customer
 *  3. We receive the confirmed paymentMethodId (pm_xxx)
 *  4. POST /api/payment/activate-subscription → backend creates the subscription
 *
 * Solana Flow:
 *  1. User selects Solana and connects wallet
 *  2. Constructs SystemProgram.transfer transaction
 *  3. User signs and sends transaction
 *  4. Frontend captures txId and sends to POST /api/payments/verify-solana
 *  5. Backend verifies transaction and creates subscription
 */
export function CheckoutForm({
  tierName,
  tierPrice,
  tierKey,
  activeMethod,
  onMethodChange,
  onSuccess,
  onCancel,
}: CheckoutFormProps) {
  const { tr } = useLocalization();
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleStripeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMsg(submitError.message ?? tr("payment.errors.cardSetupFailed"));
        setIsProcessing(false);
        return;
      }

      // Step 1: Create the SetupIntent on the backend with the selected paymentMethodTypes
      // This ensures Stripe only includes the method the user selected
      const setupResp = await client.api.payment["setup-intent"].$post({
        json: { 
          tier: tierKey,
          paymentMethod: activeMethod === "bank" ? "us_bank_account" : "card",
        },
      });

      if (!setupResp.ok) {
        const body = await setupResp.json() as any;
        setErrorMsg(body.message ?? tr("payment.errors.createIntent"));
        setIsProcessing(false);
        return;
      }

      const setupData = await setupResp.json() as any;
      const clientSecret = setupData.clientSecret;

      if (!clientSecret) {
        setErrorMsg(tr("payment.errors.setupFailed"));
        setIsProcessing(false);
        return;
      }

      // Step 2: Confirm the SetupIntent with Stripe
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/pricing?setup=complete`,
        },
      });

      if (error) {
        setErrorMsg(error.message ?? tr("payment.errors.cardSetupFailed"));
        setIsProcessing(false);
        return;
      }

      if (!setupIntent || setupIntent.status !== "succeeded") {
        setErrorMsg(tr("payment.errors.cardSetupIncomplete"));
        setIsProcessing(false);
        return;
      }

      // Step 3: Extract the paymentMethodId from the confirmed SetupIntent
      const paymentMethodId =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : (setupIntent.payment_method as any)?.id;

      if (!paymentMethodId) {
        setErrorMsg(tr("payment.errors.missingPaymentMethod"));
        setIsProcessing(false);
        return;
      }

      // Step 4: Ask the backend to create the subscription with this payment method
      const activateResp = await client.api.payment["activate-subscription"].$post({
        json: { paymentMethodId, tier: tierKey },
      });

      const body = await activateResp.json() as any;

      if (!activateResp.ok) {
        setErrorMsg(body.message ?? tr("payment.errors.activateSubscription"));
        setIsProcessing(false);
        return;
      }

      console.log("[CheckoutForm] Subscription activated:", body.subscriptionId, "Status:", body.status);
      onSuccess();
    } catch (networkErr) {
      console.error("[CheckoutForm] Network error:", networkErr);
      setErrorMsg(tr("payment.errors.network"));
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Order Summary */}
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] !p-5 shadow-inner">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b]">
            {tr("payment.checkout.plan")}
          </p>
          <p className="text-white font-bold">{tierName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b]">
            {tr("payment.checkout.total")}
          </p>
          <p className="text-[#14F195] font-extrabold text-lg">{tierPrice}</p>
        </div>
      </div>

      {/* Payment Method Cards Grid */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {/* Card Payment Method */}
        <button
          type="button"
          onClick={() => {
            onMethodChange("card");
            setErrorMsg(null);
          }}
          className={`relative flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border px-3 py-4 text-center transition-all duration-300 ${
            activeMethod === "card"
              ? "bg-[#14F195] border-[#14F195] shadow-[0_16px_34px_-22px_rgba(20,241,149,0.95)]"
              : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06]"
          }`}
        >
          <CreditCard className={`h-5 w-5 ${activeMethod === "card" ? "text-[#0a0a0f]" : "text-[#94a3b8]"}`} aria-hidden="true" />
          <div>
            <p
              className={`text-sm font-bold tracking-wide ${
                activeMethod === "card" ? "text-[#0a0a0f]" : "text-white"
              }`}
            >
              {tr("payment.checkout.methods.card")}
            </p>
          </div>
        </button>

        {/* Bank Payment Method */}
        <button
          type="button"
          onClick={() => {
            onMethodChange("bank");
            setErrorMsg(null);
          }}
          className={`relative flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border px-3 py-4 text-center transition-all duration-300 ${
            activeMethod === "bank"
              ? "bg-[#14F195] border-[#14F195] shadow-[0_16px_34px_-22px_rgba(20,241,149,0.95)]"
              : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06]"
          }`}
        >
          <Building2 className={`h-5 w-5 ${activeMethod === "bank" ? "text-[#0a0a0f]" : "text-[#94a3b8]"}`} aria-hidden="true" />
          <div>
            <p
              className={`text-sm font-bold tracking-wide ${
                activeMethod === "bank" ? "text-[#0a0a0f]" : "text-white"
              }`}
            >
              {tr("payment.checkout.methods.bank")}
            </p>
            <p
              className={`text-xs ${
                activeMethod === "bank"
                  ? "text-[#0a0a0f]/70"
                  : "text-[#64748b]"
              }`}
            >
              {tr("payment.checkout.methods.bankDescription")}
            </p>
          </div>
        </button>

        {/* Wallet Payment Method */}
        <button
          type="button"
          onClick={() => {
            onMethodChange("solana");
            setErrorMsg(null);
          }}
          className={`relative flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border px-3 py-4 text-center transition-all duration-300 ${
            activeMethod === "solana"
              ? "bg-[#14F195] border-[#14F195] shadow-[0_16px_34px_-22px_rgba(20,241,149,0.95)]"
              : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06]"
          }`}
        >
          <Wallet className={`h-5 w-5 ${activeMethod === "solana" ? "text-[#0a0a0f]" : "text-[#94a3b8]"}`} aria-hidden="true" />
          <div>
            <p
              className={`text-sm font-bold tracking-wide ${
                activeMethod === "solana" ? "text-[#0a0a0f]" : "text-white"
              }`}
            >
              {tr("payment.checkout.methods.wallet")}
            </p>
          </div>
        </button>
      </div>

      {/* Card Payment Form */}
      {activeMethod === "card" && (
        <form onSubmit={handleStripeSubmit} className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <PaymentElement
              id="stripe-payment-element-card"
              options={{
                layout: { type: "accordion", defaultCollapsed: false },
                paymentMethodOrder: ["card"],
                wallets: { link: "never", applePay: "never", googlePay: "never" },
              }}
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
            >
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              id="checkout-card-submit-btn"
              type="submit"
              disabled={isProcessing || !stripe}
              className="flex-1 !py-4 rounded-full text-sm font-bold uppercase tracking-widest text-[#0a0a0f] bg-[#14F195] hover:bg-[#0fd484] shadow-[0_0_24px_rgba(20,241,149,0.35)] hover:shadow-[0_0_36px_rgba(20,241,149,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? tr("payment.checkout.processing")
                : tr("payment.checkout.subscribeNow")}
            </button>

            <button
              id="checkout-cancel-btn"
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 !py-4 rounded-full text-sm font-medium border border-white/10 text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all duration-200 disabled:opacity-50"
            >
              {tr("payment.shared.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Bank Account Payment Form */}
      {activeMethod === "bank" && (
        <form onSubmit={handleStripeSubmit} className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <PaymentElement
              id="stripe-payment-element-bank"
              options={{
                layout: "accordion",
                paymentMethodOrder: ["us_bank_account"],
                wallets: { link: "auto" },
              }}
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
            >
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              id="checkout-bank-submit-btn"
              type="submit"
              disabled={isProcessing || !stripe}
              className="flex-1 !py-4 rounded-full text-sm font-bold uppercase tracking-widest text-[#0a0a0f] bg-[#14F195] hover:bg-[#0fd484] shadow-[0_0_24px_rgba(20,241,149,0.35)] hover:shadow-[0_0_36px_rgba(20,241,149,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? tr("payment.checkout.processing")
                : tr("payment.checkout.subscribeNow")}
            </button>

            <button
              id="checkout-cancel-btn-bank"
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 !py-4 rounded-full text-sm font-medium border border-white/10 text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all duration-200 disabled:opacity-50"
            >
              {tr("payment.shared.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Solana Payment Form */}
      {activeMethod === "solana" && (
        <SolanaPaymentFlow
          tierName={tierName}
          tierPrice={tierPrice}
          tierKey={tierKey}
          isProcessing={isProcessing}
          errorMsg={errorMsg}
          onSuccess={onSuccess}
          onError={(msg) => setErrorMsg(msg)}
          onProcessingChange={setIsProcessing}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
