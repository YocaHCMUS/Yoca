# Landing Page Authentication Modal Integration Plan

Date: 2026-05-05

## Summary
The "Login" and "Sign up" buttons on the landing page's Navbar currently use routing to navigate to the `/auth` page. This plan outlines refactoring the `LandingNavbar` component to use the global modal-based authentication flow for improved User Experience (UX), replacing the routing approach.

## Goals
- Replace `Link` routing with button click handlers to open `SignInModal` and `SignUpModal`.
- Manage modal visibility state within the `LandingNavbar` component.
- Ensure the modal triggers work consistently across both Desktop/Tablet and Mobile views.
- Retain the exact existing button styling, layout, and mobile menu behaviors.

## Scope
### Modified Files
- `client/src/components/landing/Navbar.tsx`

## Implementation Plan

### 1. Import Modals
Import the authentication modals from the `auth` directory into `Navbar.tsx`:
```tsx
import { SignInModal } from "../auth/SignInModal";
import { SignUpModal } from "../auth/SignUpModal";
```

### 2. State Management
Initialize boolean state variables inside the `LandingNavbar` component to control modal visibility:
```tsx
const [isSignInOpen, setIsSignInOpen] = useState(false);
const [isSignUpOpen, setIsSignUpOpen] = useState(false);
```

### 3. Update Mobile Buttons
Update the mobile authentication links to standard `<button>` or `<a>` elements acting as buttons. Replace the `to="/auth"` prop with an `onClick` handler that closes the mobile menu and opens the respective modal:
- **Log In:** `onClick={() => { setMobileOpen(false); setIsSignInOpen(true); }}`
- **Sign Up:** `onClick={() => { setMobileOpen(false); setIsSignUpOpen(true); }}`

### 4. Update Desktop Buttons
- Change the desktop **Sign Up** `<Link>` to a generic `<button>` (or `<a>` without `href` / `to`) and attach the `onClick={() => setIsSignUpOpen(true)}` handler.
- Refactor the `LogInLink` sub-component to accept an `onOpen` prop (`{ onOpen: () => void }`). Update its `<Link>` to use this `onClick` handler.
- Update the usage of `<LogInLink />` in `LandingNavbar` to pass `onOpen={() => setIsSignInOpen(true)}`.

### 5. Render Modals
Append the `SignInModal` and `SignUpModal` components at the very end of the `LandingNavbar` JSX return statement, right before the closing `</header>` tag:
```tsx
<SignInModal open={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
<SignUpModal open={isSignUpOpen} onClose={() => setIsSignUpOpen(false)} />
```

## Verification Plan
1. Start the development server.
2. Click the "Sign Up" button on desktop and verify that the `SignUpModal` opens without a route change.
3. Resize the window to hide/show the "Log In" link, click it, and verify the `SignInModal` opens.
4. Open the mobile hamburger menu and test both "Log In" and "Sign Up" buttons. Verify the mobile menu closes and the respective modal opens.
5. Verify that modal styling and general navbar layout remain unaffected.
