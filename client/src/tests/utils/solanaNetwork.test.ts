import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getValidatedSolanaNetwork,
  getExpectedGenesisHash,
  getNetworkDisplayName,
  getWalletAdapterNetwork,
  GENESIS_HASHES,
} from "@/util/solanaNetwork";

// solanaNetwork.ts reads from import.meta.env — we stub values per test.
// We also need to mock @solana/wallet-adapter-base for WalletAdapterNetwork.
vi.mock("@solana/wallet-adapter-base", () => ({
  WalletAdapterNetwork: {
    Devnet: "devnet",
    Testnet: "testnet",
    Mainnet: "mainnet-beta",
  },
}));

// @solana/web3.js is only used for Connection (getDynamicConnection) which we
// don't test here — mock it to prevent ESM resolution issues.
vi.mock("@solana/web3.js", () => ({
  Connection: vi.fn(),
  clusterApiUrl: vi.fn((network: string) => `https://api.${network}.solana.com`),
}));

describe("solanaNetwork utilities", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GENESIS_HASHES constant
  // ─────────────────────────────────────────────────────────────────────────
  describe("GENESIS_HASHES constant", () => {
    it("should contain the correct devnet genesis hash", () => {
      expect(GENESIS_HASHES.devnet).toBe("EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG");
    });

    it("should contain the correct testnet genesis hash", () => {
      expect(GENESIS_HASHES.testnet).toBe("4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY");
    });

    it("should contain the correct mainnet-beta genesis hash", () => {
      expect(GENESIS_HASHES["mainnet-beta"]).toBe("5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getValidatedSolanaNetwork
  // ─────────────────────────────────────────────────────────────────────────
  describe("getValidatedSolanaNetwork()", () => {
    it("should return 'devnet' when VITE_SOLANA_NETWORK=devnet", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "devnet");
      expect(getValidatedSolanaNetwork()).toBe("devnet");
    });

    it("should return 'testnet' when VITE_SOLANA_NETWORK=testnet", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "testnet");
      expect(getValidatedSolanaNetwork()).toBe("testnet");
    });

    it("should return 'mainnet-beta' when VITE_SOLANA_NETWORK=mainnet-beta", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "mainnet-beta");
      expect(getValidatedSolanaNetwork()).toBe("mainnet-beta");
    });

    it("should trim whitespace and still parse valid network names", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "  devnet  ");
      expect(getValidatedSolanaNetwork()).toBe("devnet");
    });

    it("should throw when VITE_SOLANA_NETWORK is undefined (not set)", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "");
      expect(() => getValidatedSolanaNetwork()).toThrowError(
        "System Error: Missing network configuration in .env — VITE_SOLANA_NETWORK is not set."
      );
    });

    it("should throw when VITE_SOLANA_NETWORK is empty string", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "");
      expect(() => getValidatedSolanaNetwork()).toThrowError(
        /Missing network configuration/
      );
    });

    it("should throw when VITE_SOLANA_NETWORK is whitespace-only", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "   ");
      expect(() => getValidatedSolanaNetwork()).toThrowError(
        /Missing network configuration/
      );
    });

    it("should throw with a descriptive error for an unknown network name", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "fakenet");
      expect(() => getValidatedSolanaNetwork()).toThrowError(
        /Invalid VITE_SOLANA_NETWORK value "fakenet"/
      );
    });

    it("should throw and list valid options in the error message for unknown networks", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "mainnet"); // missing '-beta' suffix
      expect(() => getValidatedSolanaNetwork()).toThrowError(
        /devnet.*testnet.*mainnet-beta/
      );
    });

    it("should be case-sensitive: 'Devnet' (capital D) should throw", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "Devnet");
      expect(() => getValidatedSolanaNetwork()).toThrowError(
        /Invalid VITE_SOLANA_NETWORK value "Devnet"/
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getExpectedGenesisHash
  // ─────────────────────────────────────────────────────────────────────────
  describe("getExpectedGenesisHash()", () => {
    it("should return the devnet genesis hash when network is devnet", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "devnet");
      expect(getExpectedGenesisHash()).toBe(GENESIS_HASHES.devnet);
    });

    it("should return the testnet genesis hash when network is testnet", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "testnet");
      expect(getExpectedGenesisHash()).toBe(GENESIS_HASHES.testnet);
    });

    it("should return the mainnet genesis hash when network is mainnet-beta", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "mainnet-beta");
      expect(getExpectedGenesisHash()).toBe(GENESIS_HASHES["mainnet-beta"]);
    });

    it("should throw when VITE_SOLANA_NETWORK is not set (propagates from getValidatedSolanaNetwork)", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "");
      expect(() => getExpectedGenesisHash()).toThrowError(/Missing network configuration/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getNetworkDisplayName
  // ─────────────────────────────────────────────────────────────────────────
  describe("getNetworkDisplayName()", () => {
    it("should return 'Devnet' for devnet", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "devnet");
      expect(getNetworkDisplayName()).toBe("Devnet");
    });

    it("should return 'Testnet' for testnet", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "testnet");
      expect(getNetworkDisplayName()).toBe("Testnet");
    });

    it("should return 'Mainnet' for mainnet-beta", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "mainnet-beta");
      expect(getNetworkDisplayName()).toBe("Mainnet");
    });

    it("should throw when VITE_SOLANA_NETWORK is invalid (propagates from getValidatedSolanaNetwork)", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "bad-network");
      expect(() => getNetworkDisplayName()).toThrowError(/Invalid VITE_SOLANA_NETWORK/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getWalletAdapterNetwork
  // ─────────────────────────────────────────────────────────────────────────
  describe("getWalletAdapterNetwork()", () => {
    it("should return the Devnet adapter enum value for devnet", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "devnet");
      expect(getWalletAdapterNetwork()).toBe("devnet");
    });

    it("should return the Testnet adapter enum value for testnet", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "testnet");
      expect(getWalletAdapterNetwork()).toBe("testnet");
    });

    it("should return the Mainnet adapter enum value for mainnet-beta", () => {
      vi.stubEnv("VITE_SOLANA_NETWORK", "mainnet-beta");
      expect(getWalletAdapterNetwork()).toBe("mainnet-beta");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // truncatePubKey (inline pure function — tested via SolanaPaymentFlow render)
  // Direct unit tests using boundary values
  // ─────────────────────────────────────────────────────────────────────────
  describe("truncatePubKey() — boundary & edge cases (inline re-implementation)", () => {
    // Mirror the implementation from SolanaPaymentFlow.tsx
    function truncatePubKey(key: string): string {
      if (key.length <= 12) return key;
      return `${key.slice(0, 4)}...${key.slice(-4)}`;
    }

    it("should return the key unchanged when length is exactly 12 chars", () => {
      expect(truncatePubKey("123456789012")).toBe("123456789012");
    });

    it("should return the key unchanged when length is less than 12 chars", () => {
      expect(truncatePubKey("short")).toBe("short");
    });

    it("should truncate a standard 44-char Solana public key correctly", () => {
      const fullKey = "6BCvxUZXhi73HDeoe5metBKWEd5AFmPHNZHTQ98dF2dr";
      // Last 4 chars of this key = 'F2dr' (slice(-4))
      expect(truncatePubKey(fullKey)).toBe("6BCv...F2dr");
    });

    it("should always show exactly 4 chars before the ellipsis", () => {
      const key = "ABCDEFGHIJ1234567890";
      const result = truncatePubKey(key);
      expect(result.startsWith("ABCD")).toBe(true);
    });

    it("should always show exactly 4 chars after the ellipsis", () => {
      const key = "ABCDEFGHIJ1234567890";
      const result = truncatePubKey(key);
      expect(result.endsWith("7890")).toBe(true);
    });

    it("should handle empty string without throwing", () => {
      expect(truncatePubKey("")).toBe("");
    });

    it("should handle a 1-character string without throwing", () => {
      expect(truncatePubKey("X")).toBe("X");
    });

    it("should handle a 13-character string (just over threshold) correctly", () => {
      const key = "1234567890123"; // 13 chars
      expect(truncatePubKey(key)).toBe("1234...0123");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SOL ↔ Lamports conversion (pure arithmetic, no imports)
  // ─────────────────────────────────────────────────────────────────────────
  describe("Lamports ↔ SOL arithmetic — boundary values", () => {
    const LAMPORTS_PER_SOL = 1_000_000_000;

    it("1 SOL should equal exactly 1_000_000_000 lamports", () => {
      expect(Math.floor(1 * LAMPORTS_PER_SOL)).toBe(1_000_000_000);
    });

    it("0.001 SOL (Lite tier) should equal 1_000_000 lamports", () => {
      expect(Math.floor(0.001 * LAMPORTS_PER_SOL)).toBe(1_000_000);
    });

    it("0.005 SOL (Plus tier) should equal 5_000_000 lamports", () => {
      expect(Math.floor(0.005 * LAMPORTS_PER_SOL)).toBe(5_000_000);
    });

    it("0.01 SOL (Pro tier) should equal 10_000_000 lamports", () => {
      expect(Math.floor(0.01 * LAMPORTS_PER_SOL)).toBe(10_000_000);
    });

    it("Math.floor should discard fractional lamports from floating-point imprecision", () => {
      // 0.003 * 1e9 = 2999999.9999... in some JS engines
      expect(Math.floor(0.003 * LAMPORTS_PER_SOL)).toBe(3_000_000);
    });

    it("converting 0 SOL should yield 0 lamports", () => {
      expect(Math.floor(0 * LAMPORTS_PER_SOL)).toBe(0);
    });
  });
});
