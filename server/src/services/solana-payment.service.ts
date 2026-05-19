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
 * Merchant public key that receives Devnet SOL payments.
 * This should match the frontend VITE_SOLANA_MERCHANT_ADDRESS.
 */
const MERCHANT_ADDRESS = process.env.SOLANA_MERCHANT_ADDRESS || "YourMerchantAddressHere";

/**
 * Tier pricing in SOL for Devnet payments
 */
const TIER_SOL_AMOUNTS: Record<"Lite" | "Plus" | "Pro", number> = {
  Lite: 0.1, // 0.1 SOL
  Plus: 0.5, // 0.5 SOL
  Pro: 1.0, // 1.0 SOL
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
 * Create a connection to Helius Devnet RPC.
 * Uses HELIUS_API_KEY environment variable.
 */
function createHeliusConnection(): Connection {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error("HELIUS_API_KEY is not configured");
  }
  // Use Helius Devnet endpoint
  const rpcUrl = `https://devnet.helius-rpc.com/?api-key=${apiKey}`;
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
  tier: "Lite" | "Plus" | "Pro"
): Promise<TransactionVerification> {
  try {
    // Validate merchant address
    try {
      new PublicKey(MERCHANT_ADDRESS);
    } catch (err) {
      console.error("[verifySolanaTransaction] Invalid merchant address:", MERCHANT_ADDRESS);
      return {
        valid: false,
        reason: "Merchant address is not configured properly",
      };
    }

    const expectedAmountSol = TIER_SOL_AMOUNTS[tier];
    const expectedAmountLamports = Math.floor(expectedAmountSol * LAMPORTS_PER_SOL);

    // Create connection to Helius
    const connection = createHeliusConnection();

    // Fetch parsed transaction
    console.log("[verifySolanaTransaction] Fetching transaction:", txId);
    const transaction = await connection.getParsedTransaction(txId, "confirmed");

    if (!transaction) {
      return {
        valid: false,
        reason: "Transaction not found or not confirmed",
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
      for (const instruction of instructions) {
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
          for (const instruction of inner.instructions || []) {
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
