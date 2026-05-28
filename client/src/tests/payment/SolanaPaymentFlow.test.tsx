import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SolanaPaymentFlow } from "@/components/payment/SolanaPaymentFlow";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { verifySolanaPayment } from "@/services/payment/solanaPaymentApi";
import { PublicKey } from "@solana/web3.js";

// Mock Wallet Adapter hooks
vi.mock("@solana/wallet-adapter-react", () => ({
  useConnection: vi.fn(),
  useWallet: vi.fn(),
}));

// Mock API Call
vi.mock("@/services/payment/solanaPaymentApi", () => ({
  verifySolanaPayment: vi.fn(),
}));

// Mock Solana Web3.js Connection class
const mockGetGenesisHash = vi.fn();
const mockGetLatestBlockhash = vi.fn();
const mockGetBalance = vi.fn();
const mockSimulateTransaction = vi.fn();
const mockConfirmTransaction = vi.fn();

vi.mock("@solana/web3.js", () => {
  class PublicKey {
    private val: string;
    constructor(val: string) {
      this.val = val;
    }
    toBase58() {
      return this.val;
    }
    toString() {
      return this.val;
    }
    equals(other: any) {
      return other && other.toBase58() === this.val;
    }
  }

  const SystemProgram = {
    transfer: vi.fn().mockReturnValue({
      keys: [],
      programId: new PublicKey("11111111111111111111111111111111"),
      data: Buffer.from([]),
    }),
  };

  class TransactionMessage {
    constructor() {}
    compileToV0Message() {
      return {};
    }
  }

  class VersionedTransaction {
    constructor() {}
  }

  return {
    PublicKey,
    SystemProgram,
    TransactionMessage,
    VersionedTransaction,
    LAMPORTS_PER_SOL: 1_000_000_000,
    Connection: vi.fn().mockImplementation(() => ({
      getGenesisHash: mockGetGenesisHash,
      getLatestBlockhash: mockGetLatestBlockhash,
      getBalance: mockGetBalance,
      simulateTransaction: mockSimulateTransaction,
      confirmTransaction: mockConfirmTransaction,
    })),
  };
});

describe("SolanaPaymentFlow Component", () => {
  const defaultProps = {
    tierName: "Lite Package",
    tierPrice: "$10",
    tierKey: "Lite" as const,
    isProcessing: false,
    errorMsg: null,
    onSuccess: vi.fn(),
    onError: vi.fn(),
    onProcessingChange: vi.fn(),
    onCancel: vi.fn(),
  };

  const mockWallets = [
    {
      adapter: {
        name: "Phantom",
        icon: "phantom-icon.png",
      },
      readyState: "Installed",
    },
    {
      adapter: {
        name: "Solflare",
        icon: "solflare-icon.png",
      },
      readyState: "Installed",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SOLANA_NETWORK", "devnet");
    vi.stubEnv("VITE_SOLANA_MERCHANT_ADDRESS", "6BCvxUZXhi73HDeoe5metBKWEd5AFmPHNZHTQ98dF2dr");

    // Default Connection Mocks (Devnet)
    mockGetGenesisHash.mockResolvedValue("EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG");
    mockGetLatestBlockhash.mockResolvedValue({
      blockhash: "7hW5wLymv7K4KGeXGq6c16oVvW165Gq6c16oVvW165Gq",
      lastValidBlockHeight: 1234567,
    });
    mockGetBalance.mockResolvedValue(10_000_000); // 0.01 SOL (enough for Lite tier = 0.001 SOL + fees)
    mockSimulateTransaction.mockResolvedValue({
      value: { err: null },
    });
    mockConfirmTransaction.mockResolvedValue({
      value: { err: null },
    });

    vi.mocked(useConnection).mockReturnValue({
      connection: {
        getGenesisHash: mockGetGenesisHash,
        getLatestBlockhash: mockGetLatestBlockhash,
        getBalance: mockGetBalance,
        simulateTransaction: mockSimulateTransaction,
        confirmTransaction: mockConfirmTransaction,
      } as any,
    });
  });

  describe("Wallet Not Connected State", () => {
    beforeEach(() => {
      vi.mocked(useWallet).mockReturnValue({
        connected: false,
        publicKey: null,
        wallet: null,
        wallets: mockWallets as any,
        select: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        sendTransaction: vi.fn(),
      } as any);
    });

    it("should render wallet selection UI with available adapters", () => {
      render(<SolanaPaymentFlow {...defaultProps} />);

      expect(screen.getByText("Connect Your Solana Wallet")).toBeInTheDocument();
      expect(screen.getByText("Phantom")).toBeInTheDocument();
      expect(screen.getByText("Solflare")).toBeInTheDocument();
    });

    it("should call select() when a wallet option is clicked", () => {
      const selectMock = vi.fn();
      vi.mocked(useWallet).mockReturnValue({
        connected: false,
        publicKey: null,
        wallet: null,
        wallets: mockWallets as any,
        select: selectMock,
        connect: vi.fn(),
        disconnect: vi.fn(),
        sendTransaction: vi.fn(),
      } as any);

      render(<SolanaPaymentFlow {...defaultProps} />);

      const phantomBtn = screen.getByText("Phantom");
      fireEvent.click(phantomBtn);

      expect(selectMock).toHaveBeenCalledWith("Phantom");
    });
  });

  describe("Wallet Connected State & Transaction Flow", () => {
    const mockPublicKey = new PublicKey("6BCvxUZXhi73HDeoe5metBKWEd5AFmPHNZHTQ98dF2dr");
    let sendTransactionMock: any;

    beforeEach(() => {
      sendTransactionMock = vi.fn().mockResolvedValue("mock-tx-signature-12345");
      vi.mocked(useWallet).mockReturnValue({
        connected: true,
        publicKey: mockPublicKey,
        wallet: { adapter: { name: "Phantom" } } as any,
        wallets: mockWallets as any,
        select: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        sendTransaction: sendTransactionMock,
      } as any);
    });

    it("should show payment confirmation details for connected wallet", () => {
      render(<SolanaPaymentFlow {...defaultProps} />);

      expect(screen.getByText("Lite Package")).toBeInTheDocument();
      expect(screen.getAllByText(/0.001/i)[0]).toBeInTheDocument(); // Lite Tier SOL amount
      expect(screen.getByText(/Confirm Payment with SOL/i)).toBeInTheDocument();
    });

    it("should handle successful payment flow and trigger onSuccess", async () => {
      vi.mocked(verifySolanaPayment).mockResolvedValue({
        success: true,
        subscriptionId: "sub-123",
        status: "active",
        txId: "mock-tx-signature-12345",
      });

      render(<SolanaPaymentFlow {...defaultProps} />);

      const payBtn = screen.getByText(/Confirm Payment with SOL/i);
      fireEvent.click(payBtn);

      // Verify progress status updates
      expect(defaultProps.onProcessingChange).toHaveBeenCalledWith(true);

      await waitFor(() => {
        expect(sendTransactionMock).toHaveBeenCalled();
        expect(verifySolanaPayment).toHaveBeenCalledWith({
          txId: "mock-tx-signature-12345",
          tier: "Lite",
          network: "devnet",
        });
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it("should display network mismatch error if genesis hashes do not match", async () => {
      mockGetGenesisHash.mockResolvedValue("invalid-genesis-hash");

      render(<SolanaPaymentFlow {...defaultProps} />);

      const payBtn = screen.getByText(/Confirm Payment with SOL/i);
      fireEvent.click(payBtn);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          expect.stringContaining("Network mismatch: your wallet is connected to the wrong network")
        );
      });
    });

    it("should display insufficient SOL error if wallet balance is too low", async () => {
      mockGetBalance.mockResolvedValue(100); // Only 100 lamports (needs ~0.0011 SOL)

      render(<SolanaPaymentFlow {...defaultProps} />);

      const payBtn = screen.getByText(/Confirm Payment with SOL/i);
      fireEvent.click(payBtn);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          expect.stringContaining("Insufficient SOL: wallet has")
        );
      });
    });
  });
});
