# Research: Authentication & Navigation UI Components

**Date**: 2025-11-23  
**Feature Branch**: 001-auth-ui-components

This document consolidates research findings to resolve all "NEEDS CLARIFICATION" items from the Technical Context section of the implementation plan.

---

## Research Task 1: Solana Wallet Integration

**Unknown**: Specific Solana wallet adapter packages and implementation approach

### Decision

Use **@solana/wallet-adapter-react** ecosystem with the following packages:

- `@solana/wallet-adapter-react` - React hooks and context providers
- `@solana/wallet-adapter-base` - Core wallet adapter functionality
- `@solana/wallet-adapter-wallets` - Pre-built adapters for popular wallets
- `@solana/web3.js` - Solana blockchain interaction

### Rationale

- **Industry Standard**: Official Solana wallet adapter used by Solana dApps ecosystem
- **Multi-Wallet Support**: Built-in support for Phantom, Solflare, Backpack, and other popular wallets
- **React Integration**: First-class React hooks (`useWallet`, `useConnection`) align with our React architecture
- **Auto-Detection**: Automatically detects installed wallet extensions via browser API
- **Type Safety**: Full TypeScript support with strict typing
- **Active Maintenance**: Official Solana Labs project with regular updates

### Alternatives Considered

1. **Custom wallet integration** - Rejected: Would require maintaining individual wallet integrations manually, high maintenance burden
2. **@web3-react** (Ethereum-focused) - Rejected: Not optimized for Solana blockchain
3. **RainbowKit** - Rejected: Ethereum-focused, no Solana support

### Implementation Notes

- Wallet detection happens via `window.solana`, `window.solflare`, etc. browser globals
- Must handle race conditions where wallet extension loads after React app
- Need `WalletProvider` context at app root with configured wallet adapters
- User authentication flow: Connect wallet → Sign message → Verify signature on backend

---

## Research Task 2: Google OAuth Implementation

**Unknown**: Google OAuth integration library and authentication flow

### Decision

Use **@react-oauth/google** library with the following approach:

- Client-side: `@react-oauth/google` for Google Sign-In button and OAuth flow
- Backend validation: Verify ID token using `google-auth-library` (Node.js)
- OAuth flow: Authorization Code with PKCE for security

### Rationale

- **Official React Library**: Maintained by Google with React-first design
- **Simple Integration**: Provides `GoogleOAuthProvider` and `GoogleLogin` components
- **Security**: Supports PKCE (Proof Key for Code Exchange) to prevent CSRF attacks
- **Type Safety**: Full TypeScript support
- **Token Validation**: Backend can verify tokens using official `google-auth-library`
- **Customizable**: Allows custom button styling to match Carbon Design System

### Alternatives Considered

1. **react-google-login** - Rejected: Deprecated, no longer maintained
2. **Passport.js with passport-google-oauth20** - Rejected: Overkill for single OAuth provider, more backend-heavy
3. **NextAuth.js** - Rejected: Designed for Next.js, not applicable to our Vite + Hono stack

### Implementation Notes

- Requires Google Cloud Console project with OAuth 2.0 credentials
- Client ID must be configured in both frontend (`GoogleOAuthProvider`) and backend (token verification)
- ID token contains user email, name, and profile picture (no additional API calls needed)
- Backend must validate token signature, expiration, and issuer before creating/authenticating user
- Handle edge cases: OAuth cancellation, blocked popups, network errors

---

## Research Task 3: E2E Testing Approach

**Unknown**: End-to-end testing strategy for authentication flows

### Decision

Use **Playwright** for E2E testing with the following scope:

- **Critical Flows to Test**:
  - Sign-in with valid/invalid credentials
  - Sign-up with validation errors
  - Wallet connection (mocked wallet extension)
  - Google OAuth flow (mocked OAuth provider)
  - Language switching persistence
  - Theme toggle persistence
- **Test Environment**: Separate test database, mocked wallet extensions, mocked OAuth responses
- **CI Integration**: Run on every PR, block merge on failure

### Rationale

- **Browser Automation**: Playwright supports Chrome, Firefox, Safari (matches our target browsers)
- **Network Mocking**: Can mock wallet extension globals and OAuth responses
- **Visual Regression**: Supports screenshot comparison for UI consistency
- **TypeScript Support**: First-class TypeScript support aligns with strict typing principle
- **Fast Execution**: Parallelizes tests, faster than Selenium-based tools
- **Modern API**: Async/await syntax, auto-waiting for elements, better error messages

### Alternatives Considered

1. **Cypress** - Rejected: Slower than Playwright, no native Safari support, harder to mock browser globals
2. **Puppeteer** - Rejected: Chrome-only by default, less mature API for multi-browser testing
3. **Selenium WebDriver** - Rejected: Verbose API, slower execution, requires additional setup

### Implementation Notes

- Mock wallet extensions by injecting `window.solana` object in Playwright context
- Mock Google OAuth by intercepting network requests to `accounts.google.com` and returning mock tokens
- Store test users in separate test database to avoid polluting production data
- Use Playwright fixtures for common setup (authenticated user, specific theme/language)
- Run E2E tests in CI only (not locally on every save) to avoid slowing development

---

## Research Task 4: Backend Validation Schema Alignment

**Unknown**: Backend validation rules to ensure frontend validation consistency

### Decision

Share Zod validation schemas between frontend and backend using a **shared types approach**:

- **Shared Schema Location**: `server/src/data/schema.ts` (already exists, extend for auth)
- **Frontend Import**: Import schemas from backend via path alias or npm workspace
- **Validation Rules**:
  - Email: RFC 5322 compliant, max 255 characters
  - Username: 3-20 alphanumeric characters + underscores, must start with letter
  - Password: Min 8 characters, must contain uppercase, lowercase, and number
  - Wallet address: Valid base58 Solana public key (44 characters)

### Rationale

- **Single Source of Truth**: Prevents frontend/backend validation drift
- **Type Safety**: TypeScript infers types from Zod schemas, ensuring consistency
- **Reusability**: Same schemas used in middleware (backend) and react-hook-form (frontend)
- **Error Messages**: Zod custom error messages can be internationalized

### Alternatives Considered

1. **Duplicate schemas** - Rejected: High risk of drift between frontend and backend
2. **Backend-only validation** - Rejected: Poor UX, requires round-trip for validation errors
3. **JSON Schema** - Rejected: Less type-safe than Zod, weaker TypeScript integration

### Implementation Notes

- Define base schemas in `server/src/data/schema.ts`:
  ```typescript
  export const emailSchema = z.string().email().max(255);
  export const usernameSchema = z.string().min(3).max(20).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/);
  export const passwordSchema = z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/);
  export const walletAddressSchema = z.string().length(44).regex(/^[1-9A-HJ-NP-Za-km-z]+$/);
  ```
- Frontend imports and composes these into form schemas (`signInSchema.ts`, `signUpSchema.ts`)
- Backend uses same schemas in validation middleware
- Custom error messages map to i18n keys: `validation.emailRequired`, `validation.passwordTooShort`, etc.

---

## Best Practices: Carbon Design System with Tailwind CSS

**Context**: Feature requires using Carbon components with Tailwind customization

### Key Patterns

1. **Component Wrapping**: Wrap Carbon components in custom components to add Tailwind classes:
   ```tsx
   <TextInput {...carbonProps} className="custom-tailwind-classes" />
   ```

2. **Theme Variables**: Use Carbon design tokens for colors, spacing, and typography:
   ```scss
   @use '@carbon/react/scss/theme' as *;
   .custom-class {
     background: $layer-01;
     color: $text-primary;
   }
   ```

3. **Responsive Design**: Use Tailwind responsive utilities with Carbon grid:
   ```tsx
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
   ```

4. **Accessibility**: Carbon components are accessible by default, preserve ARIA attributes when customizing

### Common Pitfalls to Avoid

- Don't override Carbon's internal classes directly (fragile, breaks on updates)
- Don't mix Carbon spacing tokens with Tailwind spacing (inconsistent design)
- Don't disable Carbon's built-in keyboard navigation

---

## Best Practices: React Hook Form with Zod

**Context**: Form validation using react-hook-form and Zod schemas

### Key Patterns

1. **Schema Integration**:
   ```tsx
   const { register, handleSubmit, formState: { errors } } = useForm({
     resolver: zodResolver(signInSchema)
   });
   ```

2. **Error Display**: Map Zod errors to i18n keys:
   ```tsx
   {errors.email && <ErrorText>{t(`validation.${errors.email.message}`)}</ErrorText>}
   ```

3. **Async Validation**: Use `refine` for backend checks:
   ```typescript
   .refine(async (email) => !(await checkEmailExists(email)), {
     message: "validation.accountExists"
   })
   ```

4. **Form State**: Use `isSubmitting` to disable button and show loading state

### Common Pitfalls to Avoid

- Don't validate on every keystroke (use `onBlur` for better UX)
- Don't forget to prevent default form submission
- Don't show multiple errors for same field (show first error only)

---

## Summary of Clarifications

| Item | Original Status | Resolved To |
|------|----------------|-------------|
| Solana wallet packages | NEEDS CLARIFICATION | @solana/wallet-adapter-react ecosystem |
| Google OAuth library | NEEDS CLARIFICATION | @react-oauth/google with backend validation |
| E2E testing approach | NEEDS CLARIFICATION | Playwright with mocked wallet/OAuth |
| Backend validation schemas | NEEDS CLARIFICATION | Shared Zod schemas in server/src/data/schema.ts |

**All NEEDS CLARIFICATION items resolved. Ready for Phase 1 (Design & Contracts).**
