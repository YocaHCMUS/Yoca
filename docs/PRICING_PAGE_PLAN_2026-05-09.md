# Pricing Page Implementation Plan

Date: 2026-05-09

## Summary
The goal is to create a new `PricingPage` component that perfectly inherits the visual theme of the Landing Page. It will feature a 4-tier pricing grid displaying mock data for "Standard", "Lite", "Plus", and "Pro" packages. The page will recreate the dark aesthetic, glowing orb backgrounds, and specific component styles (like the primary button tokens) used across the landing page.

## User Review Required

> [!IMPORTANT]
> - Please confirm if the new `PricingPage` should be added to the application router (e.g., as `/pricing` inside `App.tsx`). If yes, I will also update the router configuration during implementation.
> - The prompt mentions 4 tiers: "Standard, Lite, Plus, and Pro". However, the reference image shows "Lite, Starter, Premium, Business". I will follow the **text** instructions (Standard, Lite, Plus, Pro) unless instructed otherwise.

## Goals
1. Replicate the Landing Page background (dark `#0a0a0f` base, absolute positioned glowing orbs).
2. Create a responsive header section with an `h1` and mock subheading.
3. Build a responsive CSS grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`) for the pricing cards.
4. Style pricing cards with sharp 90-degree corners, thin borders (`border-white/10`), and a dark semi-transparent background.
5. Implement tier-specific details:
   - **Standard (Col 1):** Add a UI Toggle Switch labeled "STANDARD".
   - **Plus (Col 3):** Add a "MOST POPULAR" badge and apply the primary accent gradient (`btnPrimaryBase` from `tokens.ts`) to its CTA button.
   - **Pro (Col 4):** Add a subtle highlighted border matching the landing accent color.

## Proposed Changes

### `client/src/pages/pricing/index.tsx`
#### [NEW] `index.tsx`(file:///d:/DH/DATN/Yoca/client/src/pages/pricing/index.tsx)
- Add the `PricingPage` component.
- Import standard landing page components like `LandingNavbar` and `LandingFooter` to encapsulate the page.
- Apply the background wrappers found in `LandingHero` (e.g., the glowing blurred divs using `LANDING_ACCENT_GLOW`).
- Implement the grid and cards directly within the component using Tailwind CSS utility classes and inline styles from `tokens.ts` (e.g., `btnSecondaryBase`, `btnPrimaryBase`).

### `client/src/App.tsx` (Pending Review)
#### [MODIFY] `App.tsx`(file:///d:/DH/DATN/Yoca/client/src/App.tsx)
- If approved, import `PricingPage` and add `<Route path="/pricing" element={<PricingPage />} />`.

## Verification Plan
### Manual Verification
1. Navigate to `/pricing` in the application.
2. Verify the background closely matches the `LandingHero` aesthetic (dark mode, blurred color orbs).
3. Resize the window to verify the grid behaves correctly (1 col mobile, 2 col tablet, 4 col desktop).
4. Verify the toggle switch, "Most Popular" badge, and primary CTA styles match requirements exactly.
5. Check that the cards have sharp 90-degree corners and no rounded borders.
