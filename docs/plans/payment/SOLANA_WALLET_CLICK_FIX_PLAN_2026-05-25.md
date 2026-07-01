# Solana Wallet Selection Click Fix Plan

Date: 2026-05-25
Last Updated: 2026-05-25

## Summary

The custom wallet-selection UI in `SolanaPaymentFlow.tsx` renders a list of detected wallets (Phantom, Solflare, etc.) but clicking a wallet card does not reliably open the browser extension popup. The reported symptom is that the `onClick` handlers appear unresponsive. This plan documents the root cause analysis, current code state, and the surgical fix required.

---

## Root Cause Analysis

The component uses a **two-step async pattern** to connect:

```
onClick → select(w.adapter.name) → sets isConnecting = true
              ↓
useEffect [wallet, connected, isConnecting] → calls connect()
```

This pattern was chosen because `select()` is asynchronous — it does not immediately update the `wallet` ref within the same render cycle. The `useEffect` is needed to observe when `wallet` has settled before calling `connect()`.

**However, this two-step pattern has a race condition:**

- `select()` triggers a re-render and sets the wallet adapter.
- `setIsConnecting(true)` also triggers a re-render.
- Both state updates may be **batched together** in React 18's concurrent mode.
- The `useEffect` guard checks `wallet && !connected && isConnecting`. If the `wallet` ref hasn't updated by the time the effect fires, the condition is false and `connect()` is **never called**.
- The result: clicking the button silently does nothing — no popup opens.

### Secondary Issue: No Visual Feedback on Click

The button has no loading/pending state (`isConnecting` is not reflected in the UI). The user has no indication their click registered, which amplifies the perception of unresponsiveness.

---

## Affected File

#### [MODIFY] [`SolanaPaymentFlow.tsx`](file:///d:/DH/DATN/Yoca/client/src/components/payment/SolanaPaymentFlow.tsx)

- **Location:** `client/src/components/payment/SolanaPaymentFlow.tsx`
- **Lines:** 67–86 (hook extraction + useEffect), 133–177 (wallet list render)

---

## Current Code (Problematic)

```typescript
// Hook extraction (line 67)
const { publicKey, connected, wallet, wallets, select, connect, disconnect, sendTransaction } = useWallet();
const [isConnecting, setIsConnecting] = useState(false);

// Two-step connect via useEffect (lines 78–86)
useEffect(() => {
  if (wallet && !connected && isConnecting) {
    connect()
      .catch((err) => console.error("[SolanaPaymentFlow] connect() failed:", err))
      .finally(() => setIsConnecting(false));
  }
}, [wallet, connected, isConnecting, connect]);

// onClick (lines 138–141)
onClick={() => {
  select(w.adapter.name);   // Step 1: set adapter
  setIsConnecting(true);    // Step 2: flag to trigger useEffect
}}
```

**Problem:** `select()` sets the adapter asynchronously. By the time `isConnecting` becomes `true` and the `useEffect` fires, `wallet` may still be `null`, causing the guard `wallet && !connected && isConnecting` to short-circuit.

---

## Proposed Fix

Replace the fragile two-step `select + useEffect` pattern with a **direct inline async handler**. Call `select()` first, then explicitly call `connect()` in the same closure after a `nextTick` wait using `setTimeout(0)` to allow React state to flush.

### Step 1 — Remove the `useEffect` and `isConnecting` State

The `useEffect` and `isConnecting` state are only needed to bridge the async gap between `select()` and `connect()`. With the direct pattern, both are eliminated.

```diff
- const [isConnecting, setIsConnecting] = useState(false);

- useEffect(() => {
-   if (wallet && !connected && isConnecting) {
-     connect()
-       .catch((err) => console.error("[SolanaPaymentFlow] connect() failed:", err))
-       .finally(() => setIsConnecting(false));
-   }
- }, [wallet, connected, isConnecting, connect]);
```

### Step 2 — Replace `onClick` with a Direct Async Handler

```typescript
const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

async function handleWalletSelect(adapterName: WalletName) {
  setConnectingWallet(adapterName);
  try {
    select(adapterName);
    // Wait one microtask tick for the wallet-adapter context to update
    // its internal adapter reference after select() before calling connect().
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await connect();
  } catch (err: any) {
    // User rejected the popup or extension not installed — not a fatal error.
    console.warn("[SolanaPaymentFlow] Wallet connection cancelled or failed:", err?.message);
  } finally {
    setConnectingWallet(null);
  }
}
```

### Step 3 — Update `onClick` in the wallet list

```diff
- onClick={() => {
-   select(w.adapter.name);
-   setIsConnecting(true);
- }}
+ onClick={() => handleWalletSelect(w.adapter.name)}
```

### Step 4 — Add Loading Indicator per Wallet Button

Replace the static chevron icon with a spinner when that wallet is connecting:

```tsx
{/* Chevron or Spinner */}
{connectingWallet === w.adapter.name ? (
  <svg className="w-4 h-4 text-[#14F195] animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
) : (
  <svg className="w-4 h-4 text-[#64748b] group-hover:text-[#14F195] transition-colors flex-shrink-0"
    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)}
```

### Step 5 — Disable Other Buttons While One is Connecting

```tsx
<button
  ...
  disabled={connectingWallet !== null}
  onClick={() => handleWalletSelect(w.adapter.name)}
  className="... disabled:opacity-50 disabled:cursor-not-allowed"
>
```

---

## Import Required

`WalletName` type must be imported for the handler parameter:

```typescript
import type { WalletName } from "@solana/wallet-adapter-base";
```

---

## Step-by-step Execution Order

1. **Add import** for `WalletName` from `@solana/wallet-adapter-base`.
2. **Replace** `isConnecting: boolean` state with `connectingWallet: string | null` state.
3. **Delete** the `useEffect` that bridges `select → connect`.
4. **Add** `handleWalletSelect()` async function above the first `if (!connected || !publicKey)` early return.
5. **Update** `onClick` on the wallet `<button>` to call `handleWalletSelect(w.adapter.name)`.
6. **Update** the chevron icon to conditionally render a spinner when `connectingWallet === w.adapter.name`.
7. **Add** `disabled={connectingWallet !== null}` to each wallet button.

---

## Verification Plan

### Manual Test Cases

| Scenario | Expected Result |
|---|---|
| Click Phantom (installed) | Spinner appears on button, Phantom popup opens |
| Click Phantom, reject popup | Spinner disappears, buttons re-enable, no error shown |
| Click Phantom (not installed) | Spinner appears briefly, then disappears (or adapter-level error caught) |
| Click Solflare while Phantom connecting | Button is disabled — no double-connect |
| After successful connect | Component transitions to STATE 2 (connected wallet UI) |

### Console Signals

- `[SolanaPaymentFlow] Wallet connection cancelled or failed:` → user rejected, handled gracefully
- No unhandled promise rejections in browser console
