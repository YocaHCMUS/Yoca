# QA Automation Test Plan

Date: 2026-05-28
Last Updated: 2026-05-28

## 1. Objectives

Establish a comprehensive, production-ready QA Automation testing framework for both the frontend (React/Vite) and backend (Hono API) of Yoca. The testing strategy focuses on high code coverage, robust mocking of third-party APIs (Solana Web3, Stripe, Google OAuth), and strict validation of error handling flows ("Unhappy Paths").

---

## 2. Test Stack & Structure

- **Frontend:**
  - Framework: `Vitest`
  - Render Utilities: `@testing-library/react` & `@testing-library/react-hooks`
  - User Simulation: `@testing-library/user-event`
  - Target Path: `client/src/tests/**/*.test.tsx` (for components) and `client/src/tests/**/*.test.ts` (for business logic/hooks)
- **Backend:**
  - Framework: `Vitest`
  - API Client: Hono's native `.request()` (in-memory HTTP testing utility)
  - Target Path: `server/src/tests/**/*.test.ts`

---

## 3. Frontend Component & Logic Testing

### 3.1. Authentication Modules
- **`LandingNavbar` Auth Interactions:**
  - Mock Google OAuth and Solana wallet adapter connection states.
  - Test that clicking "Log In" or "Sign Up" opens `SignInModal` and `SignUpModal` respectively.
  - Test that the layout switches from guest buttons (Log In/Sign Up) to logged-in user details when auth state is resolved.
- **`SignInModal` / `SignUpModal` Logic:**
  - Test validation rules for forms (e.g. invalid email format, password too short).
  - Simulate submission under three server responses:
    - **Success:** Closes modal and updates context.
    - **Invalid Credentials (401/400):** Displays correct inline validation error.
    - **Server Crash (500):** Displays toast message indicating generic failure.

### 3.2. Payment & Subscription Modules (`SolanaPaymentFlow.tsx`)
- **Rendering & Initial State:**
  - Ensure the dynamic plan name, SOL amount, and target network display correctly.
  - Test behavior when no wallet is connected (should show "Connect Wallet" button).
  - Test behavior when a wallet is connected (should show payment button with SOL price).
- **Network Validation Guard:**
  - Mock `connection.getGenesisHash` to return a mismatching hash.
  - Assert that clicking "Send Payment" fails immediately, preventing transaction signing, and displays a network mismatch error message.
- **Pre-Simulation Validation Flow:**
  - Mock `connection.getBalance` to return less SOL than required. Verify the flow halts with an "Insufficient SOL" message.
  - Mock `connection.simulateTransaction` to return simulation errors. Verify the transaction is NOT sent via the wallet adapter and the exact simulation logs/reasons are captured and logged to the UI.
- **Transaction Submission (Happy & Unhappy Paths):**
  - **Happy Path:** Mock successful signature, simulation pass, and database payment confirmation request (`verifySolanaPayment` returning 200). Assert the UI moves to "Verifying..." and then to "Success".
  - **Wallet Rejection (User Cancel):** Mock `sendTransaction` rejecting with `WalletSignTransactionError` or code `4001` (User Cancelled). Verify the UI resets gracefully without crashing and displays a "Transaction cancelled" message.
  - **Network Timeout / Confirmation Failure:** Mock transaction submission but simulate a confirmation timeout. Ensure the UI notifies the user of the pending check and advises verifying manually.

---

## 4. Mocking External Integrations

### 4.1. Solana Web3 Mocking Strategy
Create a shared testing mock setup for `@solana/web3.js` and `@solana/wallet-adapter-react` to prevent real network calls and avoid dependency on browser wallet extensions:
- Mock `useWallet` to yield custom states (`publicKey: PublicKey | null`, `connected: boolean`, `sendTransaction: MockFunc`).
- Mock `Connection` class methods:
  - `getBalance()`
  - `getLatestBlockhash()`
  - `getGenesisHash()`
  - `simulateTransaction()`
- Mock `VersionedTransaction` and `TransactionMessage` classes to compile/serialize into static mock structures.

### 4.2. Stripe Mocking Strategy
- Mock `@stripe/react-stripe-js` elements (`Elements`, `PaymentElement`) to render dummy placeholders.
- Mock `useStripe` returning a mocked `confirmPayment` resolver.
- Mock `useElements` returning placeholder elements.

---

## 5. Backend (Hono API) Testing

### 5.1. Payload & Context Validation
- Test Hono middlewares and routes using Hono's `.request()` utility.
- Send requests with empty or corrupted JSON bodies to `/api/payment/verify-solana` and check for `400 Bad Request` with Zod validation details.
- Send requests without the necessary cookies (`AUTH_COOKIE_NAME`) and verify that Hono's JWT middleware correctly intercepts the request returning `401 Unauthorized`.

### 5.2. Verification Endpoints (`/verify-solana`)
- Mock `solana-payment.service.ts` internal calls (e.g. Helius RPC `getParsedTransaction`).
- Test Cases:
  - **Case A (Confirmed/Valid):** The Helius RPC mock returns a parsed transaction where `meta.err` is null, recipient matches `SOLANA_MERCHANT_ADDRESS`, and lamports are sufficient. Assert status is `200 Ok`, user subscription is updated, and invoice details are written to the database.
  - **Case B (Invalid Recipient / Hijack):** Transaction exists but destination address does not match `SOLANA_MERCHANT_ADDRESS`. Assert status is `400 Bad Request` and DB is unmodified.
  - **Case C (Insufficient Amount):** Transaction exists but lamports sent are less than required for the selected tier. Assert status is `400 Bad Request`.
  - **Case D (Network Spoofing):** Request contains `network: "mainnet-beta"`, but server is configured for `testnet`. Assert the request is blocked before RPC calls, returning `400 Bad Request`.

---

## 6. Test Implementation Roadmap

### Phase 1: Test Environment Configuration (First Step)
- Install `@testing-library/react`, `@testing-library/user-event`, and setup `setupTests.ts` mocks for both client and server if needed.
- Define global test setups for `@solana/web3.js` to avoid repetitive mocking in individual test files.

### Phase 2: Hono Auth & Payment Endpoint Tests
- Create `server/src/tests/auth/users.test.ts` for authentication routes.
- Create `server/src/tests/payment/payment.route.test.ts` for Solana & Stripe endpoints.

### Phase 3: Frontend Component Tests
- Create `client/src/tests/payment/SolanaPaymentFlow.test.tsx` for Solana payment component rendering, network checks, simulations, and user interactions.
