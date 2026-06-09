import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSolanaPaymentApiDomain,
  verifySolanaPayment,
} from "@/services/payment/solanaPaymentApi";

const request = {
  txId: "4eXzBgV6EJZofmRZLCFBGjgERPJeqLesJSobyUpZTUBNYbXv5saTLNimtTDbWBoUzxXw3LKRJwDus4mt9bRuPfa8",
  tier: "Plus" as const,
  network: "testnet" as const,
};

function mockSuccessFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => ({
      success: true,
      subscriptionId: "solana-test",
      status: "active",
      txId: request.txId,
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("solanaPaymentApi", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("should prefer VITE_CLIENT_API_DOMAIN for verification requests", async () => {
    vi.stubEnv("VITE_CLIENT_API_DOMAIN", "http://localhost:4000");
    vi.stubEnv("VITE_API_DOMAIN", "http://legacy.local");
    const fetchMock = mockSuccessFetch();

    await verifySolanaPayment(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/payment/verify-solana",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
  });

  it("should fall back to VITE_API_DOMAIN when the newer env var is missing", async () => {
    vi.stubEnv("VITE_CLIENT_API_DOMAIN", "");
    vi.stubEnv("VITE_API_DOMAIN", "http://localhost:4000");
    const fetchMock = mockSuccessFetch();

    await verifySolanaPayment(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/payment/verify-solana",
      expect.anything()
    );
  });

  it("should fall back to window origin when no API env var is set", () => {
    vi.stubEnv("VITE_CLIENT_API_DOMAIN", "");
    vi.stubEnv("VITE_API_DOMAIN", "");

    expect(getSolanaPaymentApiDomain()).toBe(window.location.origin);
  });
});
