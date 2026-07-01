# Phantom Transaction Refactor Plan

Date: 2026-05-28

## Summary
Refactor the transaction construction and sending logic in `SolanaPaymentFlow.tsx` to strictly adhere to Phantom Wallet's best practices. This will resolve transaction failures occurring during simulation or immediately after user approval. We will enforce a fresh blockhash, explicit transaction properties, manual pre-simulation debugging, strict confirmation, and robust error handling.

## Affected Files
#### [MODIFY] [SolanaPaymentFlow.tsx](file:///d:/DH/DATN/Yoca/client/src/components/payment/SolanaPaymentFlow.tsx)

## Proposed Changes

### 1. Fresh Blockhash
Update `getLatestBlockhash` to use the `'confirmed'` commitment level immediately before building the transaction to ensure Phantom simulation compatibility.

```typescript
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
```

### 2. Explicit Properties
Refactor the transaction creation to explicitly set `recentBlockhash` and `feePayer`. We will use the legacy `Transaction` object as explicitly defined in Phantom's standard documentation for `signAndSendTransaction` to ensure maximum compatibility and avoid hidden VersionedTransaction simulation issues.

```typescript
const transaction = new Transaction({
  recentBlockhash: blockhash,
  feePayer: publicKey,
}).add(
  SystemProgram.transfer({
    fromPubkey: publicKey,
    toPubkey: merchantKey,
    lamports,
  })
);
```

### 3. Pre-Simulation Debugging (Crucial)
Ensure manual simulation runs on the exact constructed transaction before sending to the wallet. If it fails, explicitly log `err` and `logs` to the console so we can debug on-chain errors (like insufficient funds or rent exemption) before Phantom throws a generic error.

```typescript
const simulation = await connection.simulateTransaction(transaction);
if (simulation.value.err) {
  console.error("Simulation Error:", simulation.value.err);
  console.error("Simulation Logs:", simulation.value.logs);
  throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
}
```

### 4. Strict Confirmation
Await the confirmation strictly using the modern object syntax, checking for on-chain execution errors.

```typescript
const signature = await sendTransaction(transaction, connection);
setTxSignature(signature);

const confirmation = await connection.confirmTransaction(
  { signature, blockhash, lastValidBlockHeight },
  'confirmed'
);

if (confirmation.value.err) {
  throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
}
```

### 5. Error Handling
Wrap the entire transaction flow in a robust `try...catch` block. Catch any rejections from Phantom (e.g. User rejected the request) and gracefully reset the UI processing state.

```typescript
try {
  // ... tx build, sim, send, confirm
} catch (err: any) {
  console.error("Transaction Flow Error:", err);
  onError(err?.message || "Transaction failed. Please try again.");
  setTxSignature(null);
  setVerifyingSignature(null);
  onProcessingChange(false);
}
```

## Verification Plan
1. Trigger a transaction from the UI.
2. Verify in the console that `getLatestBlockhash` uses `'confirmed'`.
3. Verify `simulateTransaction` passes before the Phantom popup appears.
4. Reject the transaction in Phantom and verify the UI gracefully resets.
5. Approve the transaction and verify `confirmTransaction` catches the success before backend verification runs.
