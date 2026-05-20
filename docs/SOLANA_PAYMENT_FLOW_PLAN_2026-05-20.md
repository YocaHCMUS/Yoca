# Solana Payment Flow Implementation Plan

Date: 2026-05-20
Last Updated: 2026-05-20

## Summary
Update the Solana Devnet payment flow to conditionally render the wallet connection UI or the payment confirmation UI based on the user's wallet connection state. Ensure this integrates perfectly into the existing Payment Modal's "SOL" tab.

---

## Frontend Architecture

### Target Component
**`SolanaPaymentFlow`**
- **Location:** `client/src/components/payment/SolanaPaymentFlow.tsx`

### Logic Updates
1. **Wallet Hook Integration:**
   - Extract `publicKey`, `connected`, `wallet`, `wallets`, `select`, and `disconnect` from the `useWallet()` hook.

2. **Disconnected State UI (`!connected`):**
   - Render a custom UI mapping through the `wallets` array to display connect buttons (e.g., Phantom, Solflare).
   - Match the application's dark theme aesthetics (`bg-white/5`, hover effects, etc.).
   - Ensure the "Close" button remains available.

3. **Connected State UI (`connected && publicKey`):**
   - Display a compact summary card showing the connected wallet's name/icon and a truncated public key (e.g., `6BCv...F2dr`).
   - Provide a "Disconnect" or "Change Wallet" text button.
   - Render the primary "◎ Send X SOL" button that executes the actual transaction logic.

### Integration
- This logic sits entirely inside the `SolanaPaymentFlow.tsx` component, which is conditionally rendered by `CheckoutForm.tsx` when `activeMethod === "solana"`. It perfectly replaces the current static placeholder "Connect Your Wallet" UI.

---

## Step-by-step Execution Order

1. **State & Hooks Setup:** Destructure necessary variables (`connected`, `wallets`, `select`, `disconnect`) from `useWallet()`.
2. **Disconnected UI Implementation:** Replace the existing `!publicKey` return block with mapped wallet selection buttons. Add connect handlers.
3. **Connected UI Refinement:** Add the wallet details card above the transaction summary, displaying the wallet icon and truncated address. Add the disconnect action.
4. **Testing:** Verify both states inside the payment modal.
