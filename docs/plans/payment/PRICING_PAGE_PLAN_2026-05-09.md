# Pricing Page Implementation Plan

Date: 2026-05-09
Last Updated: 2026-05-09

## Summary
Create a `PricingPage` component that perfectly inherits the visual theme of the Landing Page. It features a 3-column pricing grid where **Column 1 is a dynamic card** that toggles between the "Lite" and "Standard (Free)" tiers via a switch. Columns 2 and 3 display the "Plus" and "Pro" static tiers. The page replicates the dark aesthetic, glowing orb backgrounds, and component styles from the landing page.

---

## Goals
1. Replicate the Landing Page background (`#0a0a0f` base, absolute glowing orbs from `LandingHero`).
2. Add `id="pricing"` to the page root for anchor-link navigation (`href="#pricing"`).
3. Create a responsive CSS grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) with a shared outer border.
4. Style cards with **sharp 90-degree corners**, thin `border-white/10` dividers, dark semi-transparent background.
5. Implement tier-specific details:
   - **Column 1 (Dynamic):** A single card toggling between "Lite" and "Standard" content via a `useState` boolean (`isStandardMode`). The toggle switch at the bottom drives `setIsStandardMode`.
   - **Column 2 (Plus):** "MOST POPULAR" badge + primary accent gradient CTA (`btnPrimaryBase` token).
   - **Column 3 (Pro):** Subtle `border-[#9945FF]/50` accent border highlight for the highest tier.

---

## Component Data Design

| State | Card Title | Price | Included | API Limit | Overage | CTA |
|---|---|---|---|---|---|---|
| `isStandardMode = false` (default) | Lite | $39 / month | 1,500,000 CUs/MO | 15 RPS | $23/1M CUs | BUY NOW |
| `isStandardMode = true` | Standard | FREE | 30,000 CUs/MO | 1 RPS | Not Allowed | TRY FOR FREE |

---

## File Changes

### `client/src/pages/pricing/index.tsx` — [NEW / DONE]
- Dynamic Col 1 card bound to `isStandardMode` state via ternary operators.
- Static Col 2 (Plus) and Col 3 (Pro) tiers.
- Glowing orb background divs copied from `LandingHero`.
- `id="pricing"` on the root wrapper `div`.
- Imports: `LandingNavbar`, `LandingFooter`, `LANDING_ACCENT_GLOW`, `btnPrimaryBase`, `btnPrimaryEnter`, `btnPrimaryLeave` from `tokens.ts`.

### `client/src/App.tsx` — [MODIFIED / DONE]
```tsx
import PricingPage from "@/pages/pricing";
// ...
<Route path="/pricing" element={<PricingPage />} />
```

---

## Verification Plan

### Manual Verification
1. Navigate to `/pricing` — verify the 3-column grid renders correctly.
2. Verify background matches the `LandingHero` aesthetic (dark mode, blurred color orbs).
3. Toggle the switch in Column 1:
   - **OFF (default):** Title "Lite", price "$39", CTA "BUY NOW".
   - **ON:** Title "Standard", price "FREE", CTA "TRY FOR FREE".
4. Verify "Most Popular" badge on Plus card and accent CTA gradient.
5. Verify Pro card has a purple accent border.
6. Test anchor link `/#pricing` scrolls to the page correctly.
7. Resize browser: 1 col (mobile) → 2 col (tablet) → 3 col (desktop).
8. Confirm sharp 90-degree corners on all cards (no `rounded-*` classes).
