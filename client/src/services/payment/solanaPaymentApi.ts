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
  // NOTE: The backend mounts this router at /api/payment (singular).
  // Do NOT change to /api/payments — that path does not exist.
  const response = await fetch(
    `${import.meta.env.VITE_CLIENT_API_DOMAIN}/api/payment/verify-solana`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Include auth cookies
      body: JSON.stringify(request),
    }
  );

  // Safely parse the response body — a non-JSON 404/500 page would crash .json()
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson
    ? (await response.json() as VerifySolanaPaymentResponse)
    : ({ message: await response.text() } as Partial<VerifySolanaPaymentResponse>);

  if (!response.ok) {
    const message = (data as any).message || `Verification API failed (HTTP ${response.status})`;
    console.error("[verifySolanaPayment] Error response:", response.status, data);
    throw new Error(message);
  }

  return data as VerifySolanaPaymentResponse;
}
