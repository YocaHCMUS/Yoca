# QA Automation & Wallet UI Test Plan

Date: 2026-05-29
Last Updated: 2026-05-29

## 1. Objectives

1. Apply UI/UX fixes to the Wallet Selection component, removing placeholder text and introducing a responsive loading state during wallet connection.
2. Establish a comprehensive, production-ready QA Automation testing framework for both the frontend (React/Vite) and backend (Hono API) of Yoca.
3. Prioritize extensive testing of edge cases and unhappy paths, using robust mocking for Web3 and Stripe.

---

## 2. Part 1: UI/UX Fixes (Wallet Selection Component)

### 2.1. `CheckoutForm.tsx` (Remove Placeholder Text)
- **Target File:** `client/src/components/payment/CheckoutForm.tsx`
- **Change:** In the active wallet payment button, remove the `<p>Devnet Wallet</p>` text block so the button strictly says "Wallet".

### 2.2. `SolanaPaymentFlow.tsx` (Add Loading State)
- **Target File:** `client/src/components/payment/SolanaPaymentFlow.tsx`
- **Changes:**
  1. Add `import { Loader2 } from "lucide-react";`.
  2. Add new state: `const [connectingWalletName, setConnectingWalletName] = useState<string | null>(null);`.
  3. Inside the `wallets.map()` render block, update the `onClick` handler to set `connectingWalletName(w.adapter.name)`.
  4. Replace the chevron `>` icon and "Installed" text with `<Loader2 className="w-4 h-4 animate-spin text-[#14F195] flex-shrink-0" />` if `connectingWalletName === w.adapter.name`.
  5. Add `disabled={connectingWalletName === w.adapter.name}` to prevent double-clicks.
  6. Update the `useEffect` that listens for `connected` to reset the `connectingWalletName` state back to `null` if the wallet connects successfully or fails to connect.

---

## 3. Part 2: Comprehensive Unit Testing (Frontend & Backend)

### 3.1. Frontend Component Testing (`CheckoutForm` & `SolanaPaymentFlow`)
- **CheckoutForm:** Mock `@stripe/react-stripe-js` (`Elements`, `PaymentElement`, `useStripe`, `useElements`). Test switching between active methods (Card, Bank, Solana) and rendering appropriate UI components. Verify Stripe success and error flows (e.g., failed setup intent).
- **SolanaPaymentFlow:** Expand the existing tests to explicitly test user rejecting the transaction (`WalletSignTransactionError`), and `getLatestBlockhash` network failure before the transaction is compiled.

### 3.2. Custom Hooks & Data Fetching
- Write tests for React hooks dealing with API data (e.g., using `renderHook`).
- Ensure graceful handling of `500 Server Error` and `404 Not Found` API responses, checking `isError`, `isLoading` flags, and timeout handling.

### 3.3. Web3 Edge Cases (Solana)
- Add scenarios simulating transaction `simulateTransaction` rejections. Ensure clear and human-readable errors are surfaced in the UI instead of opaque JSON errors.
- Ensure the network mismatch UI explicitly halts the payment flow before any transaction signing occurs.

### 3.4. Stripe Edge Cases
- Test scenarios simulating backend returning `400 Bad Request` or `500 Server Error` when generating a `SetupIntent`. 
- Simulate card validation errors thrown by Stripe's `confirmSetup`.

### 3.5. Backend API Logic (Hono routes)
- **Files:** Create `server/src/tests/payment/payment.route.test.ts`.
- **Hono Request Testing:** Utilize Supertest or Hono's `.request()` utility.
- Test missing/invalid payloads to `/api/payment/verify-solana`.
- Mock the Helius RPC calls to test confirmation logic (HTTP 200 on success, HTTP 400 on on-chain failure with `meta.err`).

### 3.6. Utility Functions
- Test pure formatting utilities, e.g., `truncatePubKey` and SOL to Lamport conversions, validating against `null`, `undefined`, and boundary edge cases.

---

## 4. Execution Plan
1. Receive approval on this test plan.
2. Provide and apply the TSX code modifications for the Wallet UI (`CheckoutForm.tsx` & `SolanaPaymentFlow.tsx`).
3. Generate the required test suites step-by-step.
4. Verify all tests pass locally.
