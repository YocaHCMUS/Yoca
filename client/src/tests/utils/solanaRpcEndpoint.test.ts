import { describe, expect, it, vi, afterEach } from "vitest";
import { getSolanaRpcEndpoint } from "@/util/solanaNetwork";

vi.mock("@solana/wallet-adapter-base", () => ({
  WalletAdapterNetwork: {
    Devnet: "devnet",
    Testnet: "testnet",
    Mainnet: "mainnet-beta",
  },
}));

vi.mock("@solana/web3.js", () => ({
  Connection: vi.fn(),
  clusterApiUrl: vi.fn((network: string) => `https://api.${network}.solana.com`),
}));

describe("getSolanaRpcEndpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("prefers VITE_SOLANA_RPC_URL when configured", () => {
    vi.stubEnv("VITE_SOLANA_NETWORK", "testnet");
    vi.stubEnv("VITE_SOLANA_RPC_URL", "https://example-rpc.local");

    expect(getSolanaRpcEndpoint()).toBe("https://example-rpc.local");
  });

  it("trims VITE_SOLANA_RPC_URL", () => {
    vi.stubEnv("VITE_SOLANA_NETWORK", "devnet");
    vi.stubEnv("VITE_SOLANA_RPC_URL", "  https://api.devnet.solana.com  ");

    expect(getSolanaRpcEndpoint()).toBe("https://api.devnet.solana.com");
  });

  it("falls back to clusterApiUrl when VITE_SOLANA_RPC_URL is missing", () => {
    vi.stubEnv("VITE_SOLANA_NETWORK", "testnet");
    vi.stubEnv("VITE_SOLANA_RPC_URL", "");

    expect(getSolanaRpcEndpoint()).toBe("https://api.testnet.solana.com");
  });

  it("throws a clear error when VITE_SOLANA_RPC_URL is invalid", () => {
    vi.stubEnv("VITE_SOLANA_NETWORK", "testnet");
    vi.stubEnv("VITE_SOLANA_RPC_URL", "not-a-url");

    expect(() => getSolanaRpcEndpoint()).toThrowError(/Invalid VITE_SOLANA_RPC_URL/);
  });
});
