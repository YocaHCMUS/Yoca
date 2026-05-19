/**
 * Solana Payment API Service
 *
 * Frontend API calls for Solana Devnet payment verification.
 * Used by the SolanaPaymentFlow component.
 */

export type VerifySolanaPaymentRequest = {
  txId: string;
  tier: "Lite" | "Plus" | "Pro";
};

export type VerifySolanaPaymentResponse = {
  success: boolean;
  subscriptionId: string;
  status: string;
  txId: string;
  errorCode?: string;
  message?: string;
};

/**
 * Verify a Solana Devnet transaction and activate subscription.
 *
 * @param txId - Transaction signature from Solana blockchain
 * @param tier - Subscription tier to activate
 * @returns Verification response with subscription details
 */
export async function verifySolanaPayment(
  request: VerifySolanaPaymentRequest
): Promise<VerifySolanaPaymentResponse> {
  const response = await fetch(`${import.meta.env.VITE_CLIENT_API_DOMAIN}/api/payments/verify-solana`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include auth cookies
    body: JSON.stringify(request),
  });

  const data = await response.json() as VerifySolanaPaymentResponse;

  if (!response.ok) {
    throw new Error(data.message || "Failed to verify Solana payment");
  }

  return data;
}
