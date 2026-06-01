# Solana Transaction Confirmation – Strict Verification Refactor Plan

Date: 2026-05-25
Last Updated: 2026-05-25

## Summary

Fix a **false-positive success bug** in `SolanaPaymentFlow.tsx`: the UI was showing "Transaction Submitted" and calling the backend verification endpoint even when Phantom Wallet rejected or the transaction failed on-chain. The root cause is that `sendTransaction()` returns a signature as soon as the transaction is _forwarded_ to the RPC node — not when it is _executed_ on-chain. Without awaiting `connection.confirmTransaction(...)` and checking `confirmation.value.err`, the frontend cannot distinguish between a successful and a failed transaction.

---

## Bug Root Cause

| Step | Old (broken) behaviour | New (correct) behaviour |
|---|---|---|
| 1. `sendTransaction()` | Assumed signature = success | Signature only = forwarded to RPC |
| 2. `confirmTransaction()` | Not awaited before calling backend | Awaited with `{ signature, blockhash, lastValidBlockHeight }` |
| 3. `confirmation.value.err` | Not checked | Throws immediately if non-null |
| 4. Backend call | Made before on-chain result | Only made after confirmed + no error |
| 5. `catch` block | May silently miss some errors | Explicitly calls `onError()` + resets all state |

---

## Affected File

#### [MODIFY] [`SolanaPaymentFlow.tsx`](file:///d:/DH/DATN/Yoca/client/src/components/payment/SolanaPaymentFlow.tsx)

- **Location:** `client/src/components/payment/SolanaPaymentFlow.tsx`
- **Function:** `handleSendTransaction()` (lines ~225–310)

---

## Proposed Changes to `handleSendTransaction()`

### Step 1 – Fresh Blockhash (already present, keep as-is)

```typescript
const { blockhash, lastValidBlockHeight } =
  await connection.getLatestBlockhash('confirmed');
```

Fetch immediately before transaction construction to minimise expiry risk.

### Step 2 – Transaction Construction (already present, keep as-is)

```typescript
const transaction = new Transaction({
  recentBlockhash: blockhash,
  feePayer: publicKey,   // must be explicit
}).add(
  SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: merchantKey, lamports })
);
```

### Step 3 – Send

```typescript
const signature = await sendTransaction(transaction, connection);
setTxSignature(signature);
```

The `setTxSignature` call updates the UI to "Transaction Submitted" (spinner state). This is intentional — showing the user that the tx was forwarded is correct UX. We must NOT call `onSuccess()` here.

### Step 4 – Strict On-Chain Confirmation ⚠️ CRITICAL

```typescript
const confirmation = await connection.confirmTransaction(
  { signature, blockhash, lastValidBlockHeight },
  'confirmed'
);
```

Use the **object form** (not just the signature string) so the SDK can detect block-height expiry and fail fast rather than polling indefinitely.

### Step 5 – On-Chain Error Check ⚠️ CRITICAL

```typescript
if (confirmation.value.err) {
  throw new Error(
    `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`
  );
}
```

`confirmation.value.err` is non-null whenever the validator executed the transaction but it reverted (e.g., insufficient funds, bad instruction data). Without this check the UI would show success even for reverted transactions.

### Step 6 – Backend Verification (only reached if confirmed + no error)

```typescript
setVerifyingSignature(signature);
const result = await verifySolanaPayment({ txId: signature, tier: tierKey });
onSuccess();
```

### Step 7 – Unified `catch` block

```typescript
} catch (err: any) {
  console.error("[SolanaPaymentFlow] Tx Failed (full error):", err);
  onError(err?.message || "Transaction failed. Please try again.");
  setTxSignature(null);
  setVerifyingSignature(null);
  onProcessingChange(false);
  // NOTE: onSuccess() is NOT called here under any circumstance.
}
```

All error paths — user rejection in Phantom, simulation failure, on-chain revert, network timeout — must flow through this single catch block. `onProcessingChange(false)` must always be called on error so the button re-enables.

---

## Current State Assessment

After reviewing `SolanaPaymentFlow.tsx` (lines 246–309), the **correct logic is already present** in the codebase:

- ✅ Fresh blockhash fetched with `getLatestBlockhash('confirmed')`
- ✅ `recentBlockhash` and `feePayer` explicitly set on the `Transaction`
- ✅ `connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')` awaited
- ✅ `if (confirmation.value.err)` check before calling backend
- ✅ `catch` block resets all state and calls `onError()`

### ⚠️ Latent False-Positive Found & Fixed — `PricingPage` URL Handler

**File:** `client/src/pages/pricing/index.tsx` (lines 138–145)

The page had a `useEffect` that watches for `?success=true` in the URL and unconditionally fires `setPaymentSuccess(true)`. Any URL with that query param — including a stale bookmark, an accidental redirect, or a manual navigation — would open the success modal **without any transaction ever occurring**.

**Fix applied (2026-05-25):** The guard now requires **both** `?success=true` AND `?tier=<name>` to be present before triggering the success state. This makes the redirect intentional and scoped.

```diff
- if (params.get("success") === "true") {
-   setPaymentSuccess(true);
+ const successParam = params.get("success");
+ const tierParam    = params.get("tier");
+ if (successParam === "true" && tierParam) {
+   setSelectedTier({ name: tierParam, price: "" });
+   setPaymentSuccess(true);
```

---

## Investigation Checklist (if bug persists)

1. [ ] Confirm the browser is loading the latest built bundle — run `npm run dev` or hard-refresh.
2. [ ] Search for any **other** `sendTransaction` calls outside `SolanaPaymentFlow.tsx`:
   ```
   grep -r "sendTransaction" client/src --include="*.tsx" --include="*.ts"
   ```
3. [ ] Check if `CheckoutForm.tsx` or any parent component is calling `onSuccess()` independently.
4. [ ] Add a temporary `console.log("confirmation.value.err:", confirmation.value.err)` to confirm the runtime value.
5. [ ] Ensure Phantom is connected to **Devnet** (not Mainnet-Beta) — a mismatch causes silent failures.

---

## Step-by-step Execution Order

1. **Verify current build** – `npm run dev` in `client/`, open payment modal, check browser console.
2. **Attempt a failing transaction** – e.g., try to send SOL with insufficient Devnet balance. Confirm UI shows error, not success.
3. **Attempt a passing transaction** – fund wallet via Devnet faucet, send transaction. Confirm UI reaches `onSuccess()` only after confirmation.
4. **Search for duplicate paths** – run grep for other `sendTransaction` or `onSuccess()` calls if the bug persists.
5. **Add `confirmation.value.err` debug log** – add temporarily if needed to capture on-chain error values.

---

## Verification Plan

### Manual Test Cases

| Scenario | Expected Result |
|---|---|
| User rejects in Phantom | Error state shown, success never called |
| Insufficient Devnet SOL | Error state shown: "Transaction failed on-chain" |
| Valid transaction, confirmed | `onSuccess()` called, subscription created |
| RPC timeout / block expiry | Error state shown, not success |

### Console Signals to Watch

- `[SolanaPaymentFlow] Tx Failed (full error):` → error path correctly triggered
- No `[SolanaPaymentFlow] Subscription verified:` log on failure → backend not called erroneously
