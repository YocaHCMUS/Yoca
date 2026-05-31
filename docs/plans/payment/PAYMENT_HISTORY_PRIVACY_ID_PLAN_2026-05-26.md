# Payment History Privacy ID Plan

Date: 2026-05-26
Last Updated: 2026-05-26

## Summary

The Payment History table currently renders long raw strings for the Payment ID column (like Solana transactions or Stripe Payment Intents). We need to implement a privacy-focused UI component for these IDs to manage visibility state individually per row and allow secure copying.

---

## 1. Create `PaymentIdCell` Component

### Component Structure:
- **Location**: Defined within `ProfileSubscriptionsTab.tsx` (or imported).
- **Props**: Accepts a `paymentId` string.
- **State**:
  - `isVisible` (boolean, default `false`)
  - `isCopied` (boolean, default `false`)
- **Masking Logic**: If `!isVisible`, render the string as `paymentId.slice(0, 6) + '...' + paymentId.slice(-4)`. If `isVisible`, display the full string. Handle edge cases where the ID might be too short to mask gracefully.

### UI and Interactivity:
- Render text with `font-mono` and `text-sm`.
- Include an Eye/EyeOff toggle button (using `lucide-react`).
- Include a Copy/Check toggle button (using `lucide-react`).
- Copy action will use `navigator.clipboard.writeText(paymentId)` and temporarily set `isCopied` to `true` for 2 seconds.

---

## 2. Refactor `ProfileSubscriptionsTab.tsx`

### Changes to `PaymentHistoryPanel`:
- Modify the `.map()` loop rendering the table rows.
- Replace the raw `{paymentIdLabel(item)}` display with `<PaymentIdCell paymentId={paymentIdLabel(item)} />`.
- Ensure styling remains consistent with the rest of the table (`td` alignment, font sizing).

---

## Step-by-step Execution Order
1. Define the `PaymentIdCell` component in `client/src/components/profile/ProfileSubscriptionsTab.tsx`.
2. Import required icons (`Eye`, `EyeOff`, `Copy`, `Check`) from `lucide-react`.
3. Locate the `PaymentHistoryPanel` component in `ProfileSubscriptionsTab.tsx`.
4. Update the `td` representing the Payment ID to render `<PaymentIdCell paymentId={paymentIdLabel(item)} />`.
5. Verify TypeScript compilation and UI behavior.
