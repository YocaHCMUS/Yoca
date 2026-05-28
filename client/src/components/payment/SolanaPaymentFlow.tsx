import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useState, useEffect } from "react";
import { verifySolanaPayment } from "@/services/payment/solanaPaymentApi";
import { PrivacyTransactionId } from "./PrivacyTransactionId";
import { 
  getValidatedSolanaNetwork, 
  getExpectedGenesisHash, 
  getNetworkDisplayName 
} from "@/util/solanaNetwork";

/**
 * Define your merchant address for receiving Devnet SOL payments.
 * This should be a known, secure Solana address.
 *
 * Falls back gracefully if the env var is missing so the module
 * doesn't crash at import time — the key is re-validated at runtime
 * inside handleSendTransaction().
 */
const MERCHANT_ADDRESS_RAW =
  import.meta.env.VITE_SOLANA_MERCHANT_ADDRESS as string | undefined;

/**
 * Tier pricing in SOL.
 * Note: Must be > 0.00089 SOL to avoid rent-exemption errors
 * if the merchant wallet is completely empty on Devnet/Testnet.
 *
 * ⚠️  MUST stay in sync with `TIER_SOL_AMOUNTS` in
 *     `server/src/services/solana-payment.service.ts`.
 *     If you change a value here, update the server constant too, and vice versa.
 */
const TIER_SOL_AMOUNTS: Record<"Lite" | "Plus" | "Pro", number> = {
  Lite: 0.001,
  Plus: 0.005,
  Pro: 0.01,
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

/** Truncate a public key: first 4 + "..." + last 4 chars */
function truncatePubKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Solana Devnet payment flow component.
 *
 * Flow:
 *  1. User selects Solana → sees wallet selection UI (Phantom/Solflare)
 *  2. User connects a wallet → sees connected state with address + confirm button
 *  3. User clicks "Send SOL" → transaction is built, signed, and sent to Devnet
 *  4. Frontend captures txId and sends to POST /api/payments/verify-solana
 *  5. Backend verifies via Helius RPC and creates subscription if valid
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
  const { publicKey, connected, wallet, wallets, select, connect, disconnect, sendTransaction } = useWallet();
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [verifyingSignature, setVerifyingSignature] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  let networkName = "Devnet";
  try {
    networkName = getNetworkDisplayName();
  } catch {
    // Fallback if env is broken, the actual throw happens during submit
  }

  const solAmount = TIER_SOL_AMOUNTS[tierKey];

  /**
   * After select() updates the wallet state, auto-call connect() to open
   * the browser extension popup. select() alone does NOT open the popup.
   */
  useEffect(() => {
    if (wallet && !connected && isConnecting) {
      connect()
        .catch((err) => {
          console.error("[SolanaPaymentFlow] connect() failed:", err);
        })
        .finally(() => setIsConnecting(false));
    }
  }, [wallet, connected, isConnecting, connect]);

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 1: Wallet not connected → show wallet selection UI
  // ─────────────────────────────────────────────────────────────────────────
  if (!connected || !publicKey) {
    return (
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="p-4 rounded-xl bg-[#14F195]/5 border border-[#14F195]/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">◎</span>
            <div>
              <p className="text-white font-semibold text-sm">Connect Your Solana Wallet</p>
              <p className="text-[#64748b] text-xs">Select a wallet to pay with SOL on {networkName}</p>
            </div>
          </div>
        </div>

        {/* Wallet list */}
        <div className="flex flex-col gap-2">
          {wallets.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-[#64748b] text-sm">No Solana wallets detected.</p>
              <p className="text-[#64748b] text-xs mt-1">
                Install{" "}
                <a
                  href="https://phantom.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#14F195] hover:underline"
                >
                  Phantom
                </a>{" "}
                or{" "}
                <a
                  href="https://solflare.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#14F195] hover:underline"
                >
                  Solflare
                </a>{" "}
                to continue.
              </p>
            </div>
          ) : (
            wallets.map((w) => (
              <button
                key={w.adapter.name}
                id={`connect-wallet-${w.adapter.name.toLowerCase().replace(/\s+/g, "-")}`}
                type="button"
                onClick={() => {
                  select(w.adapter.name);  // set the adapter
                  setIsConnecting(true);   // triggers useEffect → connect() popup
                }}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-left group"
              >
                {/* Wallet icon */}
                {w.adapter.icon ? (
                  <img
                    src={w.adapter.icon}
                    alt={w.adapter.name}
                    className="w-8 h-8 rounded-lg flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#14F195]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#14F195] text-sm font-bold">◎</span>
                  </div>
                )}

                {/* Wallet name + readiness */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold group-hover:text-[#14F195] transition-colors">
                    {w.adapter.name}
                  </p>
                  <p className="text-[#64748b] text-xs capitalize">
                    {w.readyState === "Installed" ? "Installed" : "Not detected"}
                  </p>
                </div>

                {/* Chevron */}
                <svg
                  className="w-4 h-4 text-[#64748b] group-hover:text-[#14F195] transition-colors flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          )}
        </div>

        {/* Cancel */}
        <button
          id="solana-cancel-connect-btn"
          type="button"
          onClick={onCancel}
          className="w-full !py-3 rounded-full text-sm font-medium border border-white/10 text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all duration-200 mt-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 2: Transaction submitted, pending verification
  // ─────────────────────────────────────────────────────────────────────────
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
        {/* Privacy-masked transaction ID with toggle & copy */}
        <PrivacyTransactionId transactionId={txSignature} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 3: Wallet connected → show payment confirmation UI
  // ─────────────────────────────────────────────────────────────────────────

  async function handleSendTransaction() {
    if (!publicKey) {
      onError("Wallet not connected");
      return;
    }

    // ── Validate Solana network env var before any RPC call ───────────────
    // Catches missing/invalid VITE_SOLANA_NETWORK early so the user sees a
    // clear system error instead of a cryptic RPC or wallet error.
    let expectedGenesis: string;
    let validatedNetworkName: string;
    let rawNetworkKey: "devnet" | "testnet" | "mainnet-beta";
    try {
      rawNetworkKey = getValidatedSolanaNetwork();
      expectedGenesis = getExpectedGenesisHash();
      validatedNetworkName = getNetworkDisplayName();
    } catch (envErr: any) {
      onError(envErr.message);
      return;
    }

    // ── Validate merchant address at call-time, not module load-time ──────
    if (!MERCHANT_ADDRESS_RAW) {
      onError("VITE_SOLANA_MERCHANT_ADDRESS is not set. Check your .env file.");
      return;
    }
    let merchantKey: PublicKey;
    try {
      merchantKey = new PublicKey(MERCHANT_ADDRESS_RAW);
    } catch {
      onError(`Invalid merchant public key: "${MERCHANT_ADDRESS_RAW}"`);
      return;
    }

    onProcessingChange(true);

    try {
      // TODO: Hardcoded small amounts for Devnet/Testnet testing. Replace with real SOL conversion for Mainnet.
      // Math.floor guarantees a strict integer — floating-point lamports cause simulation failures.
      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

      // ── Step 0: Network mismatch guard ───────────────────────────────────
      // Compares the connected RPC's genesis hash against the known expected
      // genesis. If Phantom is set to Mainnet while the app uses Devnet, we
      // fail fast with a clear message instead of a cryptic Phantom warning.
      const genesisHash = await connection.getGenesisHash();
      if (genesisHash !== expectedGenesis) {
        throw new Error(
          `Network mismatch: your wallet is connected to the wrong network. ` +
          `This app uses ${validatedNetworkName}. Please change your wallet network in Settings.`
        );
      }

      // ── Step 1: Fresh blockhash — fetched IMMEDIATELY before construction ─
      // Using 'confirmed' per Phantom & Solflare best practices. This is the
      // commitment level both wallets use internally during their own simulation,
      // so the blockhash is guaranteed to be recognised on both ends.
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      console.log("[SolanaPaymentFlow] Fresh blockhash fetched:", blockhash);

      // ── Step 2: VersionedTransaction (V0) construction ───────────────────
      // Modern V0 transaction format. Solflare strictly expects this format
      // for accurate parsing and simulation of transfer instructions.
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: merchantKey,
            lamports,
          }),
        ],
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);

      console.log("[SolanaPaymentFlow] Transaction constructed (V0):", {
        payerKey: publicKey.toBase58(),
        merchant: merchantKey.toBase58(),
        lamports,
        lastValidBlockHeight,
      });

      // ── Step 3a: Explicit balance check ──────────────────────────────────
      // simulateTransaction() runs on an UNSIGNED tx (sigVerify:false) so it
      // can silently skip the fee-payer balance check → false "pass".
      // We manually verify balance here to catch InsufficientFunds BEFORE
      // Phantom shows its own simulation error to the user.
      // Phantom may add priority fees (up to 0.0001 SOL), so we use a safe margin.
      const ESTIMATED_FEE_LAMPORTS = 100_000; // 0.0001 SOL upper bound for safety
      const balance = await connection.getBalance(publicKey, 'confirmed');
      const totalRequired = lamports + ESTIMATED_FEE_LAMPORTS;
      console.log(
        `[SolanaPaymentFlow] Balance check: have ${balance} lamports, ` +
        `need ${totalRequired} (${lamports} transfer + ${ESTIMATED_FEE_LAMPORTS} fee estimate)`
      );
      if (balance < totalRequired) {
        throw new Error(
          `Insufficient SOL: wallet has ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL ` +
          `but needs at least ${(totalRequired / LAMPORTS_PER_SOL).toFixed(6)} SOL ` +
          `(${(lamports / LAMPORTS_PER_SOL).toFixed(6)} transfer + fee). ` +
          `Airdrop more ${validatedNetworkName} SOL at faucet.solana.com.`
        );
      }

      // ── Step 3b: Pre-simulation with explicit error + log output ─────────
      // CRITICAL: Run simulation BEFORE presenting the Phantom popup to the user.
      // If simulation fails, log the EXACT on-chain error and logs — this is
      // the information Phantom hides behind a generic "Transaction may fail" UI.
      // sigVerify:false is the default for unsigned transactions.
      console.log("[SolanaPaymentFlow] Running pre-send simulation...");
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        // ⬇️ These two lines are the most important debugging output in the flow.
        console.error("[SolanaPaymentFlow] SIMULATION ERROR (exact):", simulation.value.err);
        console.error("[SolanaPaymentFlow] SIMULATION LOGS:", simulation.value.logs);
        const logSummary = simulation.value.logs?.find(
          (l) => l.includes("Error") || l.includes("failed") || l.includes("insufficient")
        );
        throw new Error(
          logSummary ?? `Simulation failed: ${JSON.stringify(simulation.value.err)}`
        );
      }
      console.log("[SolanaPaymentFlow] Simulation passed ✅ — presenting wallet for signature...");

      // ── Step 4: Send (only reached if simulation passed) ─────────────────
      // No extra options needed — the wallet adapter defaults are correct for
      // legacy transactions with both Phantom and Solflare.
      const signature = await sendTransaction(transaction, connection);
      setTxSignature(signature);
      console.log("[SolanaPaymentFlow] Transaction submitted with signature:", signature);

      // ── Step 5: Strict on-chain confirmation ─────────────────────────────
      // Wait for on-chain confirmation BEFORE calling the backend.
      // Use the object form { signature, blockhash, lastValidBlockHeight } so
      // the SDK can detect block-height expiry and fail fast rather than polling
      // indefinitely. This prevents the race where getParsedTransaction returns null.
      console.log("[SolanaPaymentFlow] Awaiting on-chain confirmation...");
      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      // ── Step 6: On-chain error check ──────────────────────────────────────
      // confirmation.value.err is non-null when the validator executed the
      // transaction but it REVERTED (e.g. bad instruction, account constraint).
      // Without this check, the UI would show success for reverted transactions.
      if (confirmation.value.err) {
        console.error("[SolanaPaymentFlow] On-chain execution error:", confirmation.value.err);
        throw new Error(
          `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`
        );
      }
      console.log("[SolanaPaymentFlow] Transaction confirmed on-chain ✅");

      // ── Step 7: Backend verification (only after confirmed + no error) ────
      setVerifyingSignature(signature);

      try {
        const result = await verifySolanaPayment({ 
          txId: signature, 
          tier: tierKey,
          network: rawNetworkKey
        });
        console.log("[SolanaPaymentFlow] Subscription verified:", result.subscriptionId);
        onSuccess();
      } catch (verifyErr: any) {
        console.error("[SolanaPaymentFlow] Backend verification error:", verifyErr);
        onError(verifyErr.message || "Failed to verify transaction. Please contact support.");
        setTxSignature(null);
        setVerifyingSignature(null);
        onProcessingChange(false);
      }
    } catch (err: any) {
      // ── Unified error handler ─────────────────────────────────────────────
      // All failure paths flow here: user rejection in Phantom/Solflare,
      // simulation failure, on-chain revert, network timeout, or balance errors.
      // SendTransactionError carries RPC simulation logs with the EXACT reason.

      // Detect wallet-specific provider errors to improve diagnostic clarity.
      // Solflare throws 'WalletSignTransactionError' on user rejection or
      // provider-level failures; Phantom uses similar error names.
      if (
        err.name === 'WalletSignTransactionError' ||
        err.name === 'TransactionSignatureError' ||
        err.name === 'WalletSendTransactionError'
      ) {
        console.error(
          `[SolanaPaymentFlow] Wallet provider error [${err.name}]:`,
          err.message,
          // err.code is set by some providers (e.g. 4001 = user rejected)
          err.code != null ? `(code: ${err.code})` : ''
        );
      }

      const simLogs = err?.logs as string[] | undefined;
      if (simLogs?.length) {
        console.error("[SolanaPaymentFlow] SendTransactionError — RPC simulation logs:");
        simLogs.forEach((log, i) => console.error(`  [${i}] ${log}`));
      }
      console.error("[SolanaPaymentFlow] Transaction failed (full error object):", err);

      // Prefer a human-readable log line over the raw error.message
      const logError = simLogs?.find(
        (l) => l.includes("Error") || l.includes("failed") || l.includes("insufficient")
      );
      onError(logError ?? err?.message ?? "Transaction failed. Please try again.");
      setTxSignature(null);
      setVerifyingSignature(null);
      // Always re-enable the button on any error path
      onProcessingChange(false);
    }
  }

  async function handleRetry() {
    setTxSignature(null);
    setVerifyingSignature(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Connected Wallet Card ─────────────────────────────────────── */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#14F195]/5 border border-[#14F195]/20">
        <div className="flex items-center gap-3 min-w-0">
          {/* Wallet icon */}
          {wallet?.adapter.icon ? (
            <img
              src={wallet.adapter.icon}
              alt={wallet.adapter.name}
              className="w-8 h-8 rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#14F195]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#14F195] text-sm font-bold">◎</span>
            </div>
          )}

          <div className="min-w-0">
            <p className="text-white text-sm font-semibold leading-tight">
              {wallet?.adapter.name ?? "Solana Wallet"}
            </p>
            <p className="text-[#14F195] text-xs font-mono">
              {truncatePubKey(publicKey.toString())}
            </p>
          </div>
        </div>

        {/* Disconnect button */}
        <button
          id="solana-disconnect-btn"
          type="button"
          onClick={() => disconnect()}
          className="text-xs text-[#64748b] hover:text-red-400 transition-colors whitespace-nowrap pl-2 flex-shrink-0"
        >
          Disconnect
        </button>
      </div>

      {/* ── Transaction Details ──────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b] mb-1">Plan</p>
            <p className="text-white font-bold">{tierName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b] mb-1">Amount</p>
            <p className="text-[#14F195] font-extrabold">{solAmount} SOL</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b] mb-1">Network</p>
            <p className="text-white font-bold">{networkName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b] mb-1">USD Equiv.</p>
            <p className="text-[#94a3b8] font-semibold">{tierPrice}</p>
          </div>
        </div>
      </div>

      {/* ── Info Box ─────────────────────────────────────────────────── */}
      <div className="p-3 rounded-xl bg-[#14F195]/5 border border-[#14F195]/20 text-sm">
        <p className="text-xs text-[#64748b]">
          You will be prompted to sign a transaction to send{" "}
          <strong className="text-white">{solAmount} SOL</strong> from your wallet to our
          merchant address on <strong className="text-white">Solana {networkName}</strong>.
        </p>
      </div>

      {/* ── Error Message ─────────────────────────────────────────────── */}
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

      {/* ── Action Buttons ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <button
          id="solana-confirm-payment-btn"
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
            <span>◎ Confirm Payment with SOL</span>
          )}
        </button>

        <button
          id="solana-cancel-btn"
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
