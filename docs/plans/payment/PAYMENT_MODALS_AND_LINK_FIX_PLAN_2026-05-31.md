# Payment Modals & Stripe Link Fix Plan

Date: 2026-05-31
Last Updated: 2026-05-31

## 1. Objectives

1. **Fix `AuthReminderModal` State Bug:** Currently, if a user closes the `AuthReminderModal` after opening the `SignInModal` and then attempts to trigger the modal again (by clicking "Buy Now"), the UI briefly flashes the `SignInModal` before reverting to the reminder view. This happens because the React component doesn't unmount, and its `activeView` state remains `"signin"` until the `useEffect` resets it upon reopening. We need to reset the state correctly when the modal closes. We will also clean up unreachable/dead `SignUpModal` code since the `SignInModal` internally handles toggling to the Register mode.
2. **Enable Stripe Link for Bank Payments:** The US Bank account checkout form currently explicitly disables Stripe Link (`wallets: { link: "never" }`). The user reported that they are unable to test `Link.test` (Stripe's Link test mode). We need to remove this restriction or set it to `"auto"` to allow Link authentication and checkout to function properly.

## 2. Proposed Changes

### 2.1. Refactor `AuthReminderModal.tsx`
- **Target File:** `client/src/components/payment/AuthReminderModal.tsx`
- **Changes:**
  - Update the `useEffect` hook to reset `activeView` to `"reminder"` when `open` becomes `false` instead of (or in addition to) when it becomes `true`. This prevents the "flash" of the wrong view when reopened.
  - Remove the unused `<SignUpModal />` component from the render tree, as `activeView === "signup"` is never triggered, and the underlying `AuthModalBase` already handles the Login -> Register toggle beautifully.

### 2.2. Fix Stripe Link in `CheckoutForm.tsx`
- **Target File:** `client/src/components/payment/CheckoutForm.tsx`
- **Changes:**
  - Locate the `PaymentElement` for the `activeMethod === "bank"` condition.
  - Change `wallets: { link: "never" }` to `wallets: { link: "auto" }` (or simply remove the `wallets` property if `"auto"` is the default). This will re-enable Stripe Link for the bank payment flow, allowing `Link.test` functionality to work for automated bank verification and payment testing.

## 3. User Review Required

- Please confirm if removing `wallets: { link: "never" }` is solely for the **Bank** form or if you also want it enabled for the **Card** form. (The plan currently assumes just Bank, as stated in the objective).

## 4. Execution Plan
1. Receive approval on this plan.
2. Apply changes to `AuthReminderModal.tsx` to fix state management and remove dead code.
3. Apply changes to `CheckoutForm.tsx` to enable Stripe Link.
4. Provide a walkthrough of the changes.
