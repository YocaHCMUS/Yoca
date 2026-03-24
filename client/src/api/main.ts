import type { AppType, ErrCode } from "@sv/main.js";
import { hc } from "hono/client";
import { createWalletMockRouter, isWalletMockModeEnabled } from "@/api/walletMockRouter";

const apiDomain = import.meta.env.VITE_CLIENT_API_DOMAIN!;
const client = hc<AppType>(apiDomain, {
  init: {
    // Sending cookies on each request
    credentials: "include",
  },
});

const useWalletMocks = isWalletMockModeEnabled(import.meta.env);

if (useWalletMocks) {
  // TEMP_WALLET_MOCK: one startup line for operator visibility.
  console.info("[wallet-mock] VITE_USE_WALLET_MOCKS=true, wallet/chart API reads are mocked.");
}

export default createWalletMockRouter(client, useWalletMocks);
export type ApiErrCode = ErrCode;
