# Pricing & Payment UI Polish Plan

Date: 2026-06-17
Last Updated: 2026-06-17

## Summary
Polish the existing Pricing and Payment UI only. Keep all tier data, prices, placeholders, localization keys, Stripe/Solana logic, payment methods, and auth flow unchanged.

## Objectives
1. Make `/pricing` feel modern and aligned with the Landing motif in both dark and light themes.
2. Refine payment/auth modal surfaces so they feel deliberate instead of heavy or blocky.
3. Keep the implementation inside the existing components with no new dependencies or data changes.

## Proposed Changes

### Pricing Page
- Update `client/src/pages/pricing/index.tsx` styling to use real landing CSS variables instead of broken `var(--landing-)` references.
- Tighten hero/card spacing, reduce oversized radii, and improve card borders, shadows, hover states, toggle treatment, and CTA hierarchy.
- Keep the Lite/Standard toggle behavior and all tier values unchanged.

### Payment Components
- Polish `AuthReminderModal`, `PaymentModalWrapper`, `CheckoutForm`, `PaymentSuccessModal`, `SolanaPaymentFlow`, and `PrivacyTransactionId` with consistent surfaces, borders, radii, shadows, and Solana green/purple accents.
- Replace rough inline icons/emoji with existing `lucide-react` icons where it improves the UI without touching behavior.
- Keep Stripe `PaymentElement` options, Solana constants, API calls, and payment state transitions unchanged.

## Verification Plan
- Run `cd client && npm run typecheck`.
- Run `cd client && npx vitest run src/tests/payment/PricingPage.payment-success.test.tsx src/tests/payment/CheckoutForm.test.tsx`.
- Manually verify `/pricing` in dark and light themes at desktop and mobile widths.
- Manually verify unauthenticated Buy Now opens the auth reminder, authenticated Buy Now opens the payment modal, and Card/Bank/Wallet method switching still works.
