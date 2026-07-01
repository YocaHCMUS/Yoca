# Landing Page UI Fix Plan

Date: 2026-05-31
Last Updated: 2026-05-31

## 1. Goal Description
Clean up the Landing Page layout by removing debug UI elements and replacing the global navigation wrapper with the Landing Page's dedicated navigation bar.

1. **Remove "Test Unauthorized UI" Button:** Remove the debug button from the top of the landing page.
2. **Switch to Landing Nav Bar:** The Landing page is currently wrapped in the global `PageWrapper`, which injects the Carbon UI Header. We need to unwrap it and inject the dedicated `LandingNavbar` component to achieve the correct design.

## 2. User Review Required
> [!IMPORTANT]
> The `PageWrapper` provides a global padding and layout structure. Unwrapping the Landing Page from `PageWrapper` might make it take up the full screen differently (which is expected for Landing pages). Please approve these changes so I can proceed.

## 3. Proposed Changes

### UI / UX Component (Frontend)

#### [MODIFY] client/src/App.tsx
- Remove `PageWrapper` from the `LandingRoute` function.
- Change `LandingRoute` to simply render `<Index />`.

#### [MODIFY] client/src/pages/index.tsx
- **[DELETE]** Remove the `import.meta.env.DEV` block that contains the "Test Unauthorized UI" button.
- **[DELETE]** Remove the unused `MAPS` and `MOCK_UNAUTHORIZED_STATE` constants related to the test button.
- **[NEW]** Import `LandingNavbar` from `@/components/landing`.
- **[NEW]** Inject `<LandingNavbar />` just inside the `.landing-page` container, above the `<main>` tag.

## 4. Verification Plan
### Manual Verification
- Open the application at the root route (`/`).
- Verify that the "Test Unauthorized UI" button is gone.
- Verify that the global Carbon UI header is no longer present on the Landing page.
- Verify that the new `LandingNavbar` is correctly rendered and functional.
