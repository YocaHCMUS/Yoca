# Data Model: Authentication & Navigation UI Components

**Date**: 2025-11-23  
**Feature Branch**: 001-auth-ui-components

This document defines the entities, types, and state structures for authentication and navigation components.

---

## Entity: AuthForm

Represents the state and data for authentication forms (sign-in, sign-up).

### TypeScript Interface

```typescript
interface AuthFormState {
  // Form input values
  identifier?: string; // Username or email (sign-in only)
  email?: string; // Email (sign-up only)
  username?: string; // Username (sign-up only)
  password: string;
  confirmPassword?: string; // Sign-up only

  // Form state
  isSubmitting: boolean;
  errors: Record<string, string>; // Field name → error message key

  // Authentication method
  authMethod: "email" | "wallet" | "google" | null;
}

interface AuthFormProps {
  onSubmit: (data: SignInData | SignUpData) => Promise<void>;
  onAuthMethodChange?: (method: "wallet" | "google") => void;
  onNavigate?: (path: "/signin" | "/signup") => void;
}
```

### Validation Rules

**Sign-In Form**:

- `identifier`: Required, min 3 characters (can be email or username)
- `password`: Required, min 8 characters

**Sign-Up Form**:

- `email`: Required, valid email format (RFC 5322), max 255 characters
- `username`: Required, 3-20 alphanumeric + underscores, must start with letter
- `password`: Required, min 8 characters, must contain uppercase, lowercase, and number
- `confirmPassword`: Required, must match `password`

### State Transitions

```
Initial → Editing → Validating → Submitting → Success/Error
  ↑                                              ↓
  └──────────────────────────────────────────────┘
              (Reset on error)
```

### Related Files

- Schema: `client/src/components/auth/schemas/signInSchema.ts`, `signUpSchema.ts`
- Component: `client/src/components/auth/SignInForm.tsx`, `SignUpForm.tsx`
- Service: `client/src/services/auth/authService.ts`

---

## Entity: WalletConnection

Represents wallet detection, selection, and connection state.

### TypeScript Interface

```typescript
interface WalletInfo {
  name: string; // e.g., "Phantom", "Solflare"
  icon: string; // URL to wallet icon
  url: string; // Installation URL
  detected: boolean; // Whether wallet extension is installed
  adapter: Adapter | null; // Wallet adapter instance (null if not detected)
}

interface WalletConnectionState {
  // Wallet detection
  wallets: WalletInfo[];
  isDetecting: boolean;
  detectionError: string | null;

  // Connection state
  selectedWallet: WalletInfo | null;
  isConnecting: boolean;
  connectionError: string | null;
  publicKey: string | null; // Connected wallet address

  // Blockchain selection
  blockchain: "solana" | "ethereum" | "bitcoin";
}

interface WalletModalProps {
  isOpen: boolean;
  mode: "signin" | "signup";
  onConnect: (publicKey: string, wallet: string) => Promise<void>;
  onClose: () => void;
}
```

### Validation Rules

- `publicKey`: Must be valid base58 Solana address (44 characters) when connected
- `selectedWallet`: Must be from detected wallets list
- `blockchain`: Currently only 'solana' is supported (others for future expansion)

### State Transitions

```
Modal Closed → Modal Open → Detecting Wallets → Wallets Displayed
                                ↓
                           No Wallets Found → Show Installation Guide
                                ↓
                        Wallet Selected → Connecting → Success/Error
                                                        ↓
                                              (Error: Return to selection)
```

### Related Files

- Component: `client/src/components/auth/WalletModal.tsx`
- Service: `client/src/services/auth/walletService.ts`
- Configuration: `client/src/config/wallets.ts` (list of supported wallets)

---

## Entity: User

Represents an authenticated user (minimal state for UI components).

### TypeScript Interface

```typescript
interface User {
  id: string; // Unique user identifier
  username: string;
  email: string | null; // Null if authenticated via wallet only
  walletAddress: string | null; // Null if authenticated via email only
  authMethod: "email" | "wallet" | "google";
  profilePicture: string | null; // URL or null
  createdAt: Date;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (data: SignInData) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  connectWallet: (publicKey: string, wallet: string) => Promise<void>;
}
```

### Related Files

- Context: `client/src/contexts/AuthContext.tsx`
- Service: `client/src/services/auth/authService.ts`
- Type definitions: `client/src/types/auth.ts`

---

## Entity: NavigationState

Represents navigation header state including authentication, language, and theme preferences.

### TypeScript Interface

```typescript
interface NavigationState {
  // Authentication
  isAuthenticated: boolean;
  user: User | null;

  // Language
  currentLanguage: "en" | "vi" | "ja";
  availableLanguages: Language[];

  // Theme
  theme: "light" | "dark";

  // Navigation items
  activeItem: "market" | "alert" | "dashboard" | null;
}

interface Language {
  code: "en" | "vi" | "ja";
  name: string; // "English", "Tiếng Việt", "日本語"
  flag: string; // Emoji or icon
}

interface NavigationHeaderProps {
  onLanguageChange: (language: "en" | "vi" | "ja") => void;
  onThemeToggle: () => void;
  onSignOut: () => void;
}
```

### State Persistence

- `currentLanguage`: Persisted to `localStorage.getItem('i18nextLng')`
- `theme`: Persisted to `localStorage.getItem('theme')`

### State Transitions

**Language Change**:

```
User clicks language → Update i18n → Update localStorage → Re-render with new translations
```

**Theme Toggle**:

```
User clicks theme → Toggle theme → Update localStorage → Apply CSS classes → Re-render
```

### Related Files

- Component: `client/src/components/Navigation/Header.tsx` (assumed, to be created)
- Context: `client/src/contexts/ThemeContext.tsx`
- i18n Config: `client/src/i18n/config.ts`

---

## API Request/Response Types

### Sign-In Request

```typescript
interface SignInRequest {
  identifier: string; // Username or email
  password: string;
}

interface SignInResponse {
  user: User;
  token: string; // JWT or session token
}
```

### Sign-Up Request

```typescript
interface SignUpRequest {
  email: string;
  username: string;
  password: string;
}

interface SignUpResponse {
  user: User;
  token: string;
}
```

### Wallet Authentication Request

```typescript
interface WalletAuthRequest {
  publicKey: string;
  signature: string; // Signed message proving wallet ownership
  message: string; // Original message that was signed
  wallet: string; // Wallet name (e.g., "Phantom")
}

interface WalletAuthResponse {
  user: User;
  token: string;
}
```

### Google OAuth Request

```typescript
interface GoogleAuthRequest {
  idToken: string; // Google ID token
}

interface GoogleAuthResponse {
  user: User;
  token: string;
}
```

### Error Response

```typescript
interface ErrorResponse {
  error: string; // Error code (e.g., "INVALID_CREDENTIALS")
  message: string; // Human-readable message
  details?: Record<string, string>; // Field-specific errors
}
```

---

## Validation Schemas (Zod)

### Sign-In Schema

```typescript
import { z } from "zod";

export const signInSchema = z.object({
  identifier: z.string().min(3, "validation.identifierInvalid").max(255),
  password: z.string().min(1, "validation.passwordRequired"),
});

export type SignInData = z.infer<typeof signInSchema>;
```

### Sign-Up Schema

```typescript
import { z } from "zod";

export const signUpSchema = z
  .object({
    email: z
      .string()
      .min(1, "validation.emailRequired")
      .email("validation.invalidEmail")
      .max(255),
    username: z
      .string()
      .min(3, "validation.usernameTooShort")
      .max(20, "validation.usernameTooLong")
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "validation.usernameInvalidChars"),
    password: z
      .string()
      .min(8, "validation.passwordTooShort")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
        "validation.passwordComplexity",
      ),
    confirmPassword: z.string().min(1, "validation.confirmPasswordRequired"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "validation.passwordsDoNotMatch",
    path: ["confirmPassword"],
  });

export type SignUpData = z.infer<typeof signUpSchema>;
```

---

## Component State Flow

### Sign-In Flow

```
User opens SignInForm
  ↓
User enters identifier + password
  ↓
User clicks "Sign in" OR User clicks "Continue with wallet" OR User clicks "Continue with Google"
  ↓
(Email) Validate form → Call authService.signIn() → AuthContext updates → Redirect to dashboard
  ↓
(Wallet) Open WalletModal → Detect wallets → User selects wallet → Request signature → Call authService.walletAuth() → AuthContext updates
  ↓
(Google) Open OAuth popup → User authorizes → Get ID token → Call authService.googleAuth() → AuthContext updates
```

### Sign-Up Flow

```
User opens SignUpForm
  ↓
User enters email + username + password + confirmPassword
  ↓
User clicks "Create account" OR User clicks "Sign up with wallet" OR User clicks "Sign up with Google"
  ↓
(Email) Validate form → Call authService.signUp() → AuthContext updates → Show success message
  ↓
(Wallet/Google) Similar to sign-in flow but creates new account if not exists
```

---

## Summary

**Total Entities**: 4 (AuthForm, WalletConnection, User, NavigationState)  
**Total Validation Schemas**: 2 (signInSchema, signUpSchema)  
**API Contracts**: 4 endpoints (sign-in, sign-up, wallet auth, Google auth)

**Dependencies on Backend**:

- POST `/api/auth/signin` (email authentication)
- POST `/api/auth/signup` (user registration)
- POST `/api/auth/wallet` (wallet authentication)
- POST `/api/auth/google` (Google OAuth authentication)

**Next Steps**: Generate API contracts in `contracts/` directory (Phase 1 continuation)
