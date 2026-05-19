import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram, Transaction } from "@solana/web3.js";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useState } from "react";
import { verifySolanaPayment } from "@/services/payment/solanaPaymentApi";

/**
 * Define your merchant address for receiving Devnet SOL payments.
 * This should be a known, secure Solana address.
 */
const MERCHANT_PUBLIC_KEY = new PublicKey(
  import.meta.env.VITE_SOLANA_MERCHANT_ADDRESS || "YourMerchantAddressHere"
);

/**
 * Tier pricing in SOL for Devnet payments
 */
const TIER_SOL_AMOUNTS: Record<"Lite" | "Plus" | "Pro", number> = {
  Lite: 0.1, // 0.1 SOL
  Plus: 0.5, // 0.5 SOL
  Pro: 1.0, // 1.0 SOL
};

type SolanaPaymentFlowProps = {
  tierName: string;
  tierPrice: string;
  tierKey: "Lite" | "Plus" | "Pro";
  isProcessing: boolean;
  errorMsg: string | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onProcessingChange: (processing: boolean) => void;
  onCancel: () => void;
};

/**
 * Solana Devnet payment flow component.
 *
 * Flow:
 *  1. User selects Solana and connects wallet (Phantom/Solflare)
 *  2. Component constructs a SystemProgram.transfer transaction
 *  3. User signs the transaction via wallet
 *  4. Transaction is sent to Devnet
 *  5. Frontend captures txId and sends to POST /api/payments/verify-solana
 *  6. Backend verifies via Helius RPC and creates subscription if valid
 */
export function SolanaPaymentFlow({
  tierName,
  tierPrice,
  tierKey,
  isProcessing,
  errorMsg,
  onSuccess,
  onError,
  onProcessingChange,
  onCancel,
}: SolanaPaymentFlowProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [verifyingSignature, setVerifyingSignature] = useState<string | null>(null);

  const solAmount = TIER_SOL_AMOUNTS[tierKey];

  if (!publicKey) {
    return (
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm">
          <p className="font-semibold mb-2">Connect Your Wallet</p>
          <p className="text-xs">
            Please select a Solana wallet (Phantom or Solflare) from the wallet selector to proceed with SOL payment.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 !py-4 rounded-full text-sm font-medium border border-white/10 text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all duration-200"
        >
          Close
        </button>
      </div>
    );
  }

  if (txSignature && !verifyingSignature) {
    return (
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <p className="font-semibold text-green-400 mb-2">Transaction Submitted</p>
          <p className="text-xs text-green-300 mb-3">
            Your transaction has been submitted. Verifying with backend...
          </p>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-green-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-[#64748b]">Verifying transaction...</span>
          </div>
        </div>
        <div className="text-xs text-[#64748b] p-3 rounded-lg bg-white/5 border border-white/10 font-mono break-all">
          {txSignature}
        </div>
      </div>
    );
  }

  async function handleSendTransaction() {
    if (!publicKey) {
      onError("Wallet not connected");
      return;
    }

    onProcessingChange(true);

    try {
      // Step 1: Create a SystemProgram transfer transaction
      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

      const recentBlockhash = await connection.getLatestBlockhash();
      const transaction = new Transaction({
        recentBlockhash: recentBlockhash.blockhash,
        feePayer: publicKey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: MERCHANT_PUBLIC_KEY,
          lamports,
        })
      );

      // Step 2: Sign and send transaction
      const signature = await sendTransaction(transaction, connection);
      setTxSignature(signature);
      setVerifyingSignature(signature);

      // Step 3: Send to backend for verification
      try {
        const result = await verifySolanaPayment({
          txId: signature,
          tier: tierKey,
        });

        console.log("[SolanaPaymentFlow] Subscription verified:", result.subscriptionId);
        onSuccess();
      } catch (verifyErr: any) {
        console.error("[SolanaPaymentFlow] Verification error:", verifyErr);
        onError(verifyErr.message || "Failed to verify transaction. Please try again.");
        setVerifyingSignature(null);
        onProcessingChange(false);
      }
    } catch (err: any) {
      console.error("[SolanaPaymentFlow]", err);
      const errorMsg = err?.message || "Transaction failed. Please try again.";
      onError(errorMsg);
      setTxSignature(null);
      setVerifyingSignature(null);
      onProcessingChange(false);
    }
  }

  async function handleRetry() {
    setTxSignature(null);
    setVerifyingSignature(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Transaction Details */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b] mb-1">Amount</p>
            <p className="text-white font-bold">{solAmount} SOL</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b] mb-1">Network</p>
            <p className="text-white font-bold">Devnet</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b] mb-1">Connected Wallet</p>
            <p className="text-[#94a3b8] font-mono text-xs break-all">
              {publicKey.toString()}
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-3 rounded-xl bg-[#14F195]/5 border border-[#14F195]/20 text-sm">
        <p className="text-xs text-[#64748b]">
          You will be prompted to sign a transaction to send <strong>{solAmount} SOL</strong> from your wallet to our merchant address on <strong>Solana Devnet</strong>.
        </p>
      </div>

      {/* Error Message */}
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

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <button
          type="button"
          onClick={handleSendTransaction}
          disabled={isProcessing || verifyingSignature !== null}
          className="flex-1 !py-4 rounded-full text-sm font-bold uppercase tracking-widest text-[#0a0a0f] bg-[#14F195] hover:bg-[#0fd484] shadow-[0_0_24px_rgba(20,241,149,0.35)] hover:shadow-[0_0_36px_rgba(20,241,149,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Sending…</span>
            </>
          ) : verifyingSignature ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Verifying…</span>
            </>
          ) : (
            <>
              <span>◎ Send {solAmount} SOL</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={verifyingSignature ? handleRetry : onCancel}
          disabled={isProcessing && !verifyingSignature}
          className="flex-1 !py-4 rounded-full text-sm font-medium border border-white/10 text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all duration-200 disabled:opacity-50"
        >
          {verifyingSignature ? "Try Again" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
