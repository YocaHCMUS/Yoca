# Quickstart: Authentication & Navigation UI Components

**Date**: 2025-11-23  
**Feature Branch**: 001-auth-ui-components

This guide helps developers understand, use, and extend the authentication and navigation UI components.

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Component Usage](#component-usage)
4. [API Integration](#api-integration)
5. [Internationalization](#internationalization)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This feature provides a complete authentication system with the following components:

- **SignInForm**: Email/username + password authentication
- **SignUpForm**: User registration with validation
- **WalletModal**: Multi-wallet connection for Solana blockchain
- **Google OAuth**: One-click authentication with Google
- **Navigation Header**: Authenticated/unauthenticated state management with language and theme switching

**Key Technologies**:

- React 19 with TypeScript (strict mode)
- Carbon Design System + Tailwind CSS
- i18next for internationalization (English, Vietnamese, Japanese)
- Zod for validation
- @solana/wallet-adapter-react for wallet integration
- @react-oauth/google for OAuth

---

## Installation

### Prerequisites

- Node.js 20+
- npm 10+
- Google OAuth Client ID (for OAuth feature)
- Solana wallet extension installed (for wallet feature testing)

### Setup Steps

1. **Install dependencies** (from repository root):

```bash
npm install
```

Key packages installed:

- `@solana/wallet-adapter-react`
- `@solana/wallet-adapter-wallets`
- `@solana/web3.js`
- `@react-oauth/google`
- `react-hook-form`
- `@hookform/resolvers`
- `zod`

2. **Configure environment variables** (create `.env` in `client/`):

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_API_BASE_URL=http://localhost:3000
```

3. **Start development server**:

```bash
# Start both client and server
npm run dev

# Or individually:
npm run dev:client  # Frontend on http://localhost:5173
npm run dev:server  # Backend on http://localhost:3000
```

---

## Component Usage

### SignInForm Component

**Location**: `client/src/components/auth/SignInForm.tsx`

**Basic Usage**:

```tsx
import { SignInForm } from "@/components/auth";

function SignInPage() {
  const handleSignIn = async (data: SignInData) => {
    // Authentication logic handled by AuthContext
    console.log("Sign in:", data);
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignInForm
        onSubmit={handleSignIn}
        onNavigate={(path) => navigate(path)}
      />
    </div>
  );
}
```

**Props**:

- `onSubmit: (data: SignInData) => Promise<void>` - Called when form is submitted
- `onNavigate?: (path: '/signin' | '/signup') => void` - Optional navigation handler

**Features**:

- Validates email/username and password
- Shows validation errors inline
- Disables submit button during submission
- "Forgot password?" link
- "Continue with Google" button
- "Continue with a linked wallet" button
- "Want to have an account?" link to sign-up

---

### SignUpForm Component

**Location**: `client/src/components/auth/SignUpForm.tsx`

**Basic Usage**:

```tsx
import { SignUpForm } from "@/components/auth";

function SignUpPage() {
  const handleSignUp = async (data: SignUpData) => {
    console.log("Sign up:", data);
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUpForm
        onSubmit={handleSignUp}
        onNavigate={(path) => navigate(path)}
      />
    </div>
  );
}
```

**Props**:

- `onSubmit: (data: SignUpData) => Promise<void>` - Called when form is submitted
- `onNavigate?: (path: '/signin' | '/signup') => void` - Optional navigation handler

**Features**:

- Validates email, username, password, and password confirmation
- Shows validation errors inline
- Password strength indicator
- Terms of Service and Privacy Policy links
- "Sign up with Google" button
- "Sign up with an existing wallet" button
- "Already have an account?" link to sign-in

---

### WalletModal Component

**Location**: `client/src/components/auth/WalletModal.tsx`

**Basic Usage**:

```tsx
import { WalletModal } from "@/components/auth";
import { useState } from "react";

function AuthPage() {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const handleWalletConnect = async (publicKey: string, wallet: string) => {
    console.log("Connected wallet:", wallet, publicKey);
    setIsWalletModalOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsWalletModalOpen(true)}>Connect Wallet</button>

      <WalletModal
        isOpen={isWalletModalOpen}
        mode="signin"
        onConnect={handleWalletConnect}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </>
  );
}
```

**Props**:

- `isOpen: boolean` - Controls modal visibility
- `mode: 'signin' | 'signup'` - Determines header text
- `onConnect: (publicKey: string, wallet: string) => Promise<void>` - Called when wallet is connected
- `onClose: () => void` - Called when modal is closed

**Features**:

- Auto-detects installed Solana wallets
- Shows wallet installation links if no wallets detected
- Marks first detected wallet as "Detected"
- Blockchain selector (currently only Solana active)
- Loading states during detection and connection
- Error states with retry options

---

### AuthContext Provider

**Location**: `client/src/contexts/AuthContext.tsx`

**Setup** (in `App.tsx` or main entry):

```tsx
import { AuthProvider } from "@/contexts/AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { WalletProvider } from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <AuthProvider>{/* Your app components */}</AuthProvider>
      </WalletProvider>
    </GoogleOAuthProvider>
  );
}
```

**Usage in Components**:

```tsx
import { useAuth } from "@/contexts/AuthContext";

function Dashboard() {
  const { user, isAuthenticated, signOut } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/signin" />;
  }

  return (
    <div>
      <h1>Welcome, {user?.username}!</h1>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

**Available Methods**:

- `user: User | null` - Current authenticated user
- `isAuthenticated: boolean` - Authentication status
- `isLoading: boolean` - Loading state
- `signIn: (data: SignInData) => Promise<void>` - Email sign-in
- `signUp: (data: SignUpData) => Promise<void>` - User registration
- `signOut: () => Promise<void>` - Sign out
- `connectWallet: (publicKey: string, wallet: string) => Promise<void>` - Wallet authentication

---

## API Integration

### Backend Endpoints

All authentication endpoints are documented in `contracts/auth-api.yaml` (OpenAPI 3.0).

**Base URL**: `http://localhost:3000/api/auth`

**Endpoints**:

- `POST /signin` - Email/username authentication
- `POST /signup` - User registration
- `POST /wallet` - Wallet signature authentication
- `POST /google` - Google OAuth authentication
- `POST /signout` - Sign out (requires auth token)

### Service Layer

**Location**: `client/src/services/auth/authService.ts`

**Example Implementation**:

```typescript
import { SignInData, SignUpData } from "@/components/auth/schemas";

export const authService = {
  async signIn(data: SignInData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  },

  async signUp(data: SignUpData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  },

  // ... wallet and Google auth methods
};
```

---

## Internationalization

### Supported Languages

- **English (en)** - Default
- **Vietnamese (vi)** - Tiếng Việt
- **Japanese (ja)** - 日本語

### Configuration

**Location**: `client/src/i18n/config.ts`

**Existing Translation Keys**:

- `auth.*` - Authentication text (signIn, signUp, email, password, etc.)
- `wallet.*` - Wallet connection text (connectWallet, detecting, retry, etc.)
- `nav.*` - Navigation items (market, alert, dashboard, etc.)
- `validation.*` - Error messages (required, invalidEmail, passwordTooShort, etc.)
- `common.*` - Common UI text (cancel, confirm, loading, etc.)

### Usage in Components

```tsx
import { useTranslation } from "react-i18next";

function SignInForm() {
  const { t } = useTranslation();

  return (
    <form>
      <h2>{t("auth.signIn")}</h2>
      <input placeholder={t("auth.email")} />
      <button>{t("common.submit")}</button>
    </form>
  );
}
```

### Adding New Translations

1. **Add key to all languages** in `client/src/i18n/config.ts`:

```typescript
const resources = {
  en: {
    translation: {
      auth: {
        // ... existing keys
        newKey: "New English text",
      },
    },
  },
  vi: {
    translation: {
      auth: {
        // ... existing keys
        newKey: "Văn bản tiếng Việt",
      },
    },
  },
  ja: {
    translation: {
      auth: {
        // ... existing keys
        newKey: "日本語テキスト",
      },
    },
  },
};
```

2. **Use in component**:

```tsx
{
  t("auth.newKey");
}
```

### Language Switching

Language preference is automatically persisted to `localStorage`:

```tsx
import { useTranslation } from "react-i18next";

function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      <option value="en">English</option>
      <option value="vi">Tiếng Việt</option>
      <option value="ja">日本語</option>
    </select>
  );
}
```

---

## Testing

### Unit Tests (Validation Schemas)

**Location**: `client/src/components/auth/schemas/__tests__/`

**Example Test**:

```typescript
import { describe, it, expect } from "vitest";
import { signInSchema } from "../signInSchema";

describe("signInSchema", () => {
  it("should validate valid sign-in data", () => {
    const result = signInSchema.safeParse({
      identifier: "user@example.com",
      password: "SecurePass123",
    });

    expect(result.success).toBe(true);
  });

  it("should reject short identifier", () => {
    const result = signInSchema.safeParse({
      identifier: "ab",
      password: "SecurePass123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "validation.identifierInvalid",
      );
    }
  });
});
```

**Run Tests**:

```bash
npm run test:client
```

### Component Tests (React Testing Library)

**Location**: `client/src/components/auth/__tests__/`

**Example Test**:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignInForm } from '../SignInForm';
import { describe, it, expect, vi } from 'vitest';

describe('SignInForm', () => {
  it('should submit form with valid data', async () => {
    const onSubmit = vi.fn();
    render(<SignInForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'SecurePass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        identifier: 'user@example.com',
        password: 'SecurePass123',
      });
    });
  });
});
```

### E2E Tests (Playwright)

**Location**: `tests/e2e/auth.spec.ts`

**Example Test**:

```typescript
import { test, expect } from "@playwright/test";

test("should sign in with valid credentials", async ({ page }) => {
  await page.goto("/signin");

  await page.fill('[name="identifier"]', "testuser@example.com");
  await page.fill('[name="password"]', "SecurePass123");
  await page.click('button:has-text("Sign in")');

  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator("text=Welcome, testuser")).toBeVisible();
});
```

**Run E2E Tests**:

```bash
npm run test:e2e
```

---

## Troubleshooting

### Common Issues

#### 1. Wallet Not Detected

**Symptom**: "No wallet detected" message even though wallet is installed

**Solutions**:

- Refresh the page after installing wallet extension
- Check if wallet extension is enabled in browser settings
- Try a different browser (some wallets are browser-specific)
- Verify wallet extension is up to date

#### 2. Google OAuth Not Working

**Symptom**: OAuth popup doesn't open or fails

**Solutions**:

- Verify `VITE_GOOGLE_CLIENT_ID` is set in `.env`
- Check if popups are blocked by browser
- Ensure Google OAuth is configured for `http://localhost:5173` in Google Cloud Console
- Clear browser cache and cookies

#### 3. Validation Errors Not Showing

**Symptom**: Form submits without showing validation errors

**Solutions**:

- Check if Zod schema is correctly imported in component
- Verify `zodResolver` is passed to `useForm` hook
- Ensure error messages are mapped to i18n keys
- Check browser console for TypeScript errors

#### 4. Translation Keys Not Found

**Symptom**: Translation keys displayed instead of translated text (e.g., "auth.signIn")

**Solutions**:

- Verify key exists in all languages in `client/src/i18n/config.ts`
- Check if `useTranslation` hook is called correctly
- Ensure i18n is initialized before components render
- Clear localStorage and refresh page

#### 5. Bundle Size Too Large

**Symptom**: Initial bundle exceeds 500KB gzipped

**Solutions**:

- Check bundle analyzer: `npm run build && npm run analyze`
- Lazy load wallet adapters:
  ```tsx
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  ```
- Split Carbon components by feature
- Use dynamic imports for large dependencies

---

## Next Steps

After familiarizing yourself with these components:

1. **Read the full specification**: `specs/001-auth-ui-components/spec.md`
2. **Review API contracts**: `specs/001-auth-ui-components/contracts/auth-api.yaml`
3. **Check implementation tasks**: `specs/001-auth-ui-components/tasks.md`
4. **Review constitution principles**: `.specify/memory/constitution.md`

**Questions or Issues?**

- Check existing code in `client/src/components/auth/`
- Review service implementations in `client/src/services/auth/`
- Consult the data model: `specs/001-auth-ui-components/data-model.md`
