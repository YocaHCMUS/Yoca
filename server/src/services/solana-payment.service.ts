/**
 * Solana Payment Verification Service
 *
 * Verifies Devnet Solana transactions using Helius RPC.
 * Ensures:
 *  1. Transaction was successful
 *  2. Correct recipient (merchant public key)
 *  3. Correct amount of lamports transferred
 */

import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Merchant public key that receives SOL payments.
 * Loaded from SOLANA_MERCHANT_ADDRESS in server/.env.
 * Must match the client's VITE_SOLANA_MERCHANT_ADDRESS in client/.env.
 * The server is the AUTHORITATIVE source — client value is only used to build the tx.
 */
const MERCHANT_ADDRESS = process.env.SOLANA_MERCHANT_ADDRESS || "YourMerchantAddressHere";

/**
 * The Solana network this server is configured to accept payments on.
 * Loaded from SOLANA_NETWORK in server/.env.
 * Used to cross-validate the network field sent by the client.
 * Valid values: devnet | testnet | mainnet-beta
 */
const CONFIGURED_NETWORK = (process.env.SOLANA_NETWORK as "devnet" | "testnet" | "mainnet-beta" | undefined) ?? "devnet";

/**
 * Tier pricing in SOL.
 *
 * ⚠️  MUST stay in sync with `TIER_SOL_AMOUNTS` in
 *     `client/src/components/payment/SolanaPaymentFlow.tsx`.
 *     If you change a value here, update the client constant too, and vice versa.
 */
const TIER_SOL_AMOUNTS: Record<"Lite" | "Plus" | "Pro", number> = {
  Lite: 0.001,  // 0.001 SOL
  Plus: 0.005,  // 0.005 SOL
  Pro:  0.01,   // 0.01 SOL
};

// Convert SOL to lamports
const LAMPORTS_PER_SOL = 1_000_000_000;

interface TransactionVerification {
  valid: boolean;
  reason?: string;
  amountSol?: number;
  amountUsd?: number;
  merchantAddress?: string;
}

/**
 * Create a connection to Solana RPC based on network.
 * Uses HELIUS_API_KEY for devnet/mainnet, public API for testnet.
 */
function createSolanaConnection(network: "devnet" | "testnet" | "mainnet-beta"): Connection {
  if (network === "testnet") {
    // Helius doesn't support testnet natively, use Solana public API
    return new Connection("https://api.testnet.solana.com", "confirmed");
  }

  const apiKeyRaw = process.env.HELIUS_API_KEY;
  if (!apiKeyRaw) {
    throw new Error("HELIUS_API_KEY is not configured");
  }
  // HELIUS_API_KEY may be a comma-separated list of keys; use the first valid one
  const apiKey = apiKeyRaw.split(",").map((k) => k.trim()).find((k) => k.length > 0);
  if (!apiKey) {
    throw new Error("HELIUS_API_KEY contains no valid key");
  }
  
  // Use Helius endpoint
  const subdomain = network === "mainnet-beta" ? "mainnet" : "devnet";
  const rpcUrl = `https://${subdomain}.helius-rpc.com/?api-key=${apiKey}`;
  return new Connection(rpcUrl, "confirmed");
}

/**
 * Extract native (SOL) transfers from a parsed transaction.
 * Looks for SystemProgram transfer instructions.
 */
function extractNativeTransfers(
  transaction: any,
  walletAddress: string
): Array<{
  from: string;
  to: string;
  lamports: number;
}> {
  const transfers: Array<{
    from: string;
    to: string;
    lamports: number;
  }> = [];

  try {
    const meta = transaction.meta;
    if (!meta || !meta.innerInstructions) {
      return transfers;
    }

    // Process pre-token balances to detect native transfers
    const preBalances = meta.preBalances || [];
    const postBalances = meta.postBalances || [];
    const accountKeys = transaction.transaction.message.accountKeys || [];

    if (preBalances.length === accountKeys.length && postBalances.length === accountKeys.length) {
      for (let i = 0; i < accountKeys.length; i++) {
        const diff = preBalances[i] - postBalances[i];
        if (diff > 0) {
          // This account sent lamports
          const sender = accountKeys[i].toString();
          // Look for where these lamports went (positive balance change)
          for (let j = 0; j < accountKeys.length; j++) {
            const recipientDiff = postBalances[j] - preBalances[j];
            if (recipientDiff === diff) {
              const recipient = accountKeys[j].toString();
              transfers.push({
                from: sender,
                to: recipient,
                lamports: diff,
              });
              break;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[extractNativeTransfers] Error parsing transaction:", err);
  }

  return transfers;
}

/**
 * Verify a Solana Devnet transaction.
 *
 * @param txId - Transaction signature
 * @param tier - Subscription tier (determines expected amount)
 * @returns Verification result with details
 */
export async function verifySolanaTransaction(
  txId: string,
  tier: "Lite" | "Plus" | "Pro",
  network: "devnet" | "testnet" | "mainnet-beta" = "devnet"
): Promise<TransactionVerification> {
  try {
    // ── Guard 0: Network mismatch between client claim and server config ─────
    // The client sends the network it signed on. The server must only accept
    // transactions on the network it is configured for (SOLANA_NETWORK in .env).
    // This prevents a client from spoofing the network field to bypass verification.
    if (network !== CONFIGURED_NETWORK) {
      console.warn(
        `[verifySolanaTransaction] Network mismatch: client sent "${network}" ` +
        `but server is configured for "${CONFIGURED_NETWORK}".`
      );
      return {
        valid: false,
        reason:
          `Network mismatch: server expects "${CONFIGURED_NETWORK}" transactions, ` +
          `but received a claim for "${network}". ` +
          `Ensure VITE_SOLANA_NETWORK (client) and SOLANA_NETWORK (server) match.`,
      };
    }

    // ── Guard 1: Validate merchant address is a valid Solana public key ─────
    try {
      new PublicKey(MERCHANT_ADDRESS);
    } catch (err) {
      console.error("[verifySolanaTransaction] Invalid merchant address:", MERCHANT_ADDRESS);
      return {
        valid: false,
        reason: "Merchant address is not configured properly on the server",
      };
    }

    // TODO: Replace hardcoded amounts with real USD→SOL conversion for Mainnet.
    const expectedAmountSol = TIER_SOL_AMOUNTS[tier];
    const expectedAmountLamports = Math.floor(expectedAmountSol * LAMPORTS_PER_SOL);

    // Create connection to RPC
    const connection = createSolanaConnection(network);

    // Fetch parsed transaction
    console.log("[verifySolanaTransaction] Fetching transaction:", txId);
    const transaction = await connection.getParsedTransaction(txId, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      return {
        valid: false,
        reason: "Transaction not found or not confirmed yet",
      };
    }

    // Check transaction status
    const meta = transaction.meta;
    if (!meta) {
      return {
        valid: false,
        reason: "Transaction metadata not available",
      };
    }

    // Check if transaction was successful (no error)
    if (meta.err !== null) {
      const errorMsg = meta.err
        ? typeof meta.err === "string"
          ? meta.err
          : JSON.stringify(meta.err)
        : "Unknown error";
      console.warn("[verifySolanaTransaction] Transaction failed:", errorMsg);
      return {
        valid: false,
        reason: `Transaction failed: ${errorMsg}`,
      };
    }

    // Look for the transfer instruction
    // Check both top-level and inner instructions
    let transferFound = false;
    let actualAmount = 0;
    let recipientAddress = "";

    try {
      // First, try to find parsed token transfer instructions
      const instructions = transaction.transaction.message.instructions || [];
      const innerInstructions = meta.innerInstructions || [];

      // Check for SystemProgram transfer in parsed format
      for (const inst of instructions) {
        const instruction = inst as any;
        if (
          instruction.program === "system" &&
          instruction.parsed?.type === "transfer"
        ) {
          const info = instruction.parsed.info;
          if (
            info.destination === MERCHANT_ADDRESS &&
            info.lamports >= expectedAmountLamports
          ) {
            transferFound = true;
            actualAmount = info.lamports;
            recipientAddress = info.destination;
            break;
          }
        }
      }

      // If not found in top-level, check inner instructions
      if (!transferFound && innerInstructions.length > 0) {
        for (const inner of innerInstructions) {
          for (const inst of inner.instructions || []) {
            const instruction = inst as any;
            if (
              instruction.program === "system" &&
              instruction.parsed?.type === "transfer"
            ) {
              const info = instruction.parsed.info;
              if (
                info.destination === MERCHANT_ADDRESS &&
                info.lamports >= expectedAmountLamports
              ) {
                transferFound = true;
                actualAmount = info.lamports;
                recipientAddress = info.destination;
                break;
              }
            }
          }
          if (transferFound) break;
        }
      }

      // Fallback: check native transfers if parsed format not available
      if (!transferFound) {
        const nativeTransfers = extractNativeTransfers(transaction, "");
        for (const transfer of nativeTransfers) {
          if (
            transfer.to === MERCHANT_ADDRESS &&
            transfer.lamports >= expectedAmountLamports
          ) {
            transferFound = true;
            actualAmount = transfer.lamports;
            recipientAddress = transfer.to;
            break;
          }
        }
      }
    } catch (parseErr) {
      console.warn("[verifySolanaTransaction] Error parsing instructions:", parseErr);
      // Try fallback method
      const nativeTransfers = extractNativeTransfers(transaction, "");
      for (const transfer of nativeTransfers) {
        if (
          transfer.to === MERCHANT_ADDRESS &&
          transfer.lamports >= expectedAmountLamports
        ) {
          transferFound = true;
          actualAmount = transfer.lamports;
          recipientAddress = transfer.to;
          break;
        }
      }
    }

    if (!transferFound) {
      console.warn("[verifySolanaTransaction] No valid transfer found", {
        txId,
        tier,
        expectedAmount: expectedAmountLamports,
        merchantAddress: MERCHANT_ADDRESS,
      });
      return {
        valid: false,
        reason: `No transfer of at least ${expectedAmountSol} SOL to merchant address found`,
      };
    }

    const actualAmountSol = actualAmount / LAMPORTS_PER_SOL;

    console.log("[verifySolanaTransaction] Transaction verified successfully", {
      txId,
      tier,
      amount: actualAmountSol,
      merchant: recipientAddress,
    });

    return {
      valid: true,
      amountSol: actualAmountSol,
      amountUsd: actualAmountSol * 100, // Placeholder: 1 SOL = $100 (adjust as needed)
      merchantAddress: recipientAddress,
    };
  } catch (err: any) {
    console.error("[verifySolanaTransaction] Error:", err);
    return {
      valid: false,
      reason: err.message || "An error occurred while verifying the transaction",
    };
  }
}
