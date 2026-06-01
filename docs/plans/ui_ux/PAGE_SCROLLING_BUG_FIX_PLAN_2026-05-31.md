# Page Scrolling Bug Fix Plan

Date: 2026-05-31
Last Updated: 2026-05-31

## 1. Goal Description
Resolve the two major "Page Scrolling" issues reported by the Senior developer, which are caused by the layout structure in `PageWrapper`:
1. **Scroll Retention on Navigation:** When navigating between pages (e.g., from Market to Profile), the scroll position does not reset to the top. This happens because the scrolling container is not the `window` but rather the `.cds--content` element, and React Router does not automatically reset scroll positions for custom containers.
2. **Bottom Content Cutoff:** The bottom of the page is often inaccessible (cut off by ~3rem). This is due to a conflict between Carbon's default `margin-top: 3rem`, the wrapper's `max-height: calc(100vh - ...)`, and `#root` having `overflow: hidden`.

## 2. User Review Required
> [!IMPORTANT]
> The global scrollbars are currently hidden (`::-webkit-scrollbar { display: none !important; }` in `App.css`). This plan does **not** change that design choice. Please let me know if you also want the scrollbars to be visible again!

## 3. Proposed Changes

### UI / UX Component (Frontend)

#### [MODIFY] PageWrapper.tsx
- Add `useLocation` from `react-router`.
- Implement a `useEffect` hook that listens to changes in `location.pathname` and manually resets the scroll position of the `#main-content` container (`content.scrollTop = 0`).

#### [MODIFY] PageWrapper.module.scss
- Refactor the `:global(.cds--content)` CSS rules to create a perfect scroll container:
  - Add `box-sizing: border-box;` and `height: 100vh;` to constrain the container exactly to the viewport.
  - Override Carbon's default `margin-top` to `0 !important` to prevent the container from being pushed down and overflowing the viewport.
  - Use `padding-top: calc(3rem + var(--page-content-top-offset)) !important;` to account for both the fixed Header (3rem) and the dynamic market ticker offset without causing layout overflow.
  - Remove the problematic `max-height` rule.

## 4. Verification Plan
### Manual Verification
- **Navigation Test:** Open the browser, scroll down on the Landing/Market page, and click a link to another page (e.g., Profile). Verify that the new page starts exactly at the top.
- **Scroll Bounds Test:** Scroll to the absolute bottom of a long page (like the Pricing or Wallets Comparison page) and ensure the footer/bottom content is fully visible and not cut off by the viewport edge.
