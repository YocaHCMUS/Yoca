# Solflare & Phantom Transaction Refactor Plan

Date: 2026-05-28

## Summary
Refactor the transaction construction and sending logic in `SolanaPaymentFlow.tsx` to ensure universal compatibility with both Phantom and Solflare wallets. While Phantom supports legacy `Transaction` objects, Solflare is stricter regarding serialization and often prefers `VersionedTransaction` (V0) for modern dApps. We will update the transaction builder to use a properly constructed `VersionedTransaction`, pass explicit options to `sendTransaction`, and enhance error handling for wallet-specific provider errors.

## Affected Files
#### [MODIFY] [SolanaPaymentFlow.tsx](file:///d:/DH/DATN/Yoca/client/src/components/payment/SolanaPaymentFlow.tsx)

## Proposed Changes

### 1. Standardize Construction (VersionedTransaction)
Update the transaction builder to use `VersionedTransaction` (V0 Message) to ensure maximum compatibility with Solflare's strict signing requirements, while explicitly setting the `payerKey` and `recentBlockhash`.

```typescript
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

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
```

### 2. Adapter Handling (`sendTransaction` Options)
When calling `sendTransaction` via the wallet adapter, explicitly pass the configuration options that Solflare expects, such as `skipPreflight: false`, to ensure the wallet provider doesn't reject the payload due to missing parameters.

```typescript
const signature = await sendTransaction(transaction, connection, {
  skipPreflight: false,
});
```

### 3. Fallback & Enhanced Logging
Enhance the unified `catch` block to specifically check for `TransactionSignatureError` or other wallet-specific provider errors. Log the exact error codes so they can be debugged on the frontend without crashing.

```typescript
} catch (err: any) {
  // Capture specific Solflare/Phantom provider error codes
  if (err.name === 'TransactionSignatureError' || err.name === 'WalletSignTransactionError') {
    console.error("[SolanaPaymentFlow] Wallet Signature Error:", err.message, "Code:", err.code);
  } else {
    console.error("[SolanaPaymentFlow] Transaction failed (full error):", err);
  }

  const simLogs = err?.logs as string[] | undefined;
  if (simLogs?.length) {
    console.error("[SolanaPaymentFlow] SendTransactionError — RPC simulation logs:");
    simLogs.forEach((log, i) => console.error(`  [${i}] ${log}`));
  }

  const logError = simLogs?.find(
    (l) => l.includes("Error") || l.includes("failed") || l.includes("insufficient")
  );
  
  onError(logError ?? err?.message ?? "Transaction failed. Please try again.");
  setTxSignature(null);
  setVerifyingSignature(null);
  onProcessingChange(false);
}
```

## Verification Plan
1. Connect Phantom wallet on Devnet, trigger a payment, and ensure the transaction passes simulation and confirmation.
2. Disconnect Phantom, connect Solflare wallet on Devnet, and trigger the exact same payment flow.
3. Verify that `sendTransaction` successfully prompts Solflare for signature.
4. Approve the transaction in Solflare and confirm it executes successfully on-chain.
5. Reject the transaction in Solflare and verify that the specific error code/message is logged and handled gracefully by the UI.
