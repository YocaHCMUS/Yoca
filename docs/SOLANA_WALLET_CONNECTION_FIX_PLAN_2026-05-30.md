# Solana Wallet Connection UI Fix Plan

Date: 2026-05-30
Last Updated: 2026-05-30

## 1. Objectives

The custom Solana wallet UI currently displays the "Connecting..." state with a spinner when a wallet is clicked. However, it gets permanently stuck in this loading state if the connection fails or if the user closes the extension popup. The objective of this plan is to refactor the wallet connection logic and state management to ensure the loading UI resets properly under all circumstances (Success, Error, User Rejection).

## 2. Proposed Changes

### 2.1. Refactor `SolanaPaymentFlow.tsx`
- **Target File:** `client/src/components/payment/SolanaPaymentFlow.tsx`
- **Changes:**
  1. **Listen to Connection Success:** Ensure the `useEffect` listening to `connected` cleanly resets the `connectingWalletName` state to `null`.
  2. **Handle Connection Errors / Popup Closed:** Extract the logic into an asynchronous `handleWalletSelect` function. This function will call `select(walletName)` and `connect()`, catching any errors (such as user rejection) and resetting the loading UI.
  3. **Adapter Event Listeners (Fallback):** Implement the `try/catch` inside the `handleWalletSelect` and rely on `[connected]` to solve the infinite loading issues.

## 3. Execution Plan
1. Receive approval on this test plan.
2. Apply the TSX code modifications to `SolanaPaymentFlow.tsx`.
3. Verify the changes locally (ensure clicking "Cancel" in Phantom resets the spinner).
