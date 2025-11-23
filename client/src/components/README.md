# Authentication & Navigation Components

This directory contains reusable authentication and navigation UI components built with Carbon Design System and React.

## Overview

The components provide a complete authentication experience including:

- Email/password sign-in and sign-up
- Google OAuth authentication
- Solana wallet connection
- Responsive navigation header
- Multi-language support (English, Vietnamese, Japanese)
- Light/dark theme switching

## Components

### Authentication Components (`auth/`)

#### SignInForm

Email/username and password authentication form with validation.

**Usage:**

```tsx
import { SignInForm } from "./components/auth";

<SignInForm
  onSuccess={() => navigate("/dashboard")}
  onOpenWalletModal={() => setShowWallet(true)}
  onNavigateToSignUp={() => navigate("/signup")}
/>;
```

**Features:**

- Real-time validation with Zod schema
- Email or username input support
- Password field with show/hide toggle
- "Forgot password?" link
- "Sign up" navigation link
- Google OAuth integration
- Wallet authentication option
- Loading states during submission
- Clear error messages

**Props:**

- `onSuccess?: () => void` - Called after successful sign-in
- `onOpenWalletModal?: () => void` - Opens wallet connection modal
- `onNavigateToSignUp?: () => void` - Navigates to sign-up page

---

#### SignUpForm

User registration form with email, username, and password validation.

**Usage:**

```tsx
import { SignUpForm } from "./components/auth";

<SignUpForm
  onSuccess={() => navigate("/dashboard")}
  onOpenWalletModal={() => setShowWallet(true)}
  onNavigateToSignIn={() => navigate("/signin")}
/>;
```

**Features:**

- Email validation (RFC 5322 compliant)
- Username validation (3-30 characters)
- Password strength validation (min 6 characters)
- Password confirmation matching
- Terms of Service acceptance
- Google OAuth integration
- Wallet authentication option
- Inline validation errors
- Loading states

**Props:**

- `onSuccess?: () => void` - Called after successful registration
- `onOpenWalletModal?: () => void` - Opens wallet connection modal
- `onNavigateToSignIn?: () => void` - Navigates to sign-in page

---

#### WalletModal

Modal for connecting Solana wallets (Phantom, Solflare, Backpack, Glow).

**Usage:**

```tsx
import { WalletModal } from "./components/auth";

const [showWallet, setShowWallet] = useState(false);

<WalletModal
  open={showWallet}
  onClose={() => setShowWallet(false)}
  mode="signin"
/>;
```

**Features:**

- Automatic wallet detection
- Multi-wallet support (Phantom, Solflare, Backpack, Glow)
- Blockchain selection (Solana, Ethereum, Bitcoin)
- Installation guidance for missing wallets
- Connection loading states
- Error handling with retry
- Keyboard navigation (Tab, Enter, Escape)
- Focus management and trapping
- ARIA labels for accessibility

**Props:**

- `open: boolean` - Controls modal visibility
- `onClose: () => void` - Called when modal closes
- `mode?: 'signin' | 'signup'` - Authentication mode (default: 'signin')

---

#### GoogleAuthButton

Google OAuth authentication button with branded styling.

**Usage:**

```tsx
import { GoogleAuthButton } from "./components/auth";

<GoogleAuthButton mode="signin" onSuccess={() => navigate("/dashboard")} />;
```

**Features:**

- Google branding compliance
- OAuth popup flow
- Token validation
- Error handling
- Loading states
- Cancellation support

**Props:**

- `mode?: 'signin' | 'signup'` - Button text mode (default: 'signin')
- `onSuccess?: () => void` - Called after successful authentication

---

### Navigation Components (`navigation/`)

#### Header

Responsive navigation header with authentication state management.

**Usage:**

```tsx
import { Header } from "./components/navigation";

<Header />;
```

**Features:**

- Authenticated/unauthenticated state rendering
- Navigation items (Market, Alert, Dashboard)
- User profile dropdown
- Language selector integration
- Theme toggle integration
- Sign out functionality
- Responsive design (mobile/tablet/desktop)
- Carbon Design System styling

**Props:** None (uses AuthContext for state)

---

#### LanguageSelector

Dropdown for switching between supported languages.

**Usage:**

```tsx
import { LanguageSelector } from "./components/navigation";

<LanguageSelector />;
```

**Features:**

- English, Vietnamese, Japanese support
- Flag icons for each language
- Instant language switching
- Persistent selection
- i18next integration
- Keyboard accessible

**Props:** None

---

#### ThemeToggle

Button for switching between light and dark themes.

**Usage:**

```tsx
import { ThemeToggle } from "./components/navigation";

<ThemeToggle />;
```

**Features:**

- Light/dark mode switching
- Sun/moon icon indicators
- Smooth transitions
- Theme persistence
- Carbon theme integration
- Keyboard accessible

**Props:** None

---

## Validation Schemas

### SignIn Schema (`schemas/signInSchema.ts`)

```typescript
{
  identifier: string (email or username, required)
  password: string (min 6 characters, required)
}
```

### SignUp Schema (`schemas/signUpSchema.ts`)

```typescript
{
  email: string (valid email, required)
  username: string (3-30 characters, alphanumeric, required)
  password: string (min 6 characters, required)
  retypePassword: string (must match password, required)
}
```

---

## Internationalization

All components support i18n with react-i18next. Translation keys are structured as:

- `auth.*` - Authentication UI text
- `wallet.*` - Wallet connection text
- `nav.*` - Navigation text
- `validation.*` - Error messages
- `common.*` - Shared UI text

**Supported Languages:**

- English (en)
- Vietnamese (vi)
- Japanese (ja)

Configuration: `client/src/i18n/config.ts`

---

## Styling

Components use a combination of:

- **Carbon Design System** - Base components and design tokens
- **Tailwind CSS** - Utility classes for customization
- **SCSS Modules** - Component-specific styles

**Theme Variables:**

- `--cds-background` - Page background
- `--cds-text-primary` - Primary text color
- `--cds-text-secondary` - Secondary text color
- `--cds-layer-01` - Component background
- `--cds-border-subtle` - Subtle borders
- `--cds-focus` - Focus indicator color
- `--cds-support-success` - Success state color
- `--cds-support-error` - Error state color

---

## Accessibility

All components follow WCAG 2.1 AA standards:

### Keyboard Navigation

- **Tab**: Navigate between interactive elements
- **Enter/Space**: Activate buttons and links
- **Escape**: Close modals

### Screen Readers

- ARIA labels on all interactive elements
- ARIA live regions for dynamic content
- ARIA busy states for loading indicators
- Semantic HTML structure

### Focus Management

- Visible focus indicators
- Focus trapping in modals
- Focus restoration on modal close
- Logical tab order

### Color Contrast

- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text
- Color is not the only indicator

---

## Performance

### Bundle Size Impact

- Carbon components: ~80KB gzipped
- i18next: ~20KB gzipped
- Wallet adapters: ~15KB gzipped
- **Total**: ~115KB gzipped

### Component Metrics

- Initial render: <100ms
- Form validation: <500ms
- Language switching: <200ms
- Theme toggle: <100ms
- Wallet detection: <5s

### Optimization

- Code splitting with React.lazy
- Tree shaking for unused Carbon components
- Lazy loading of wallet detection
- Memoization with React.memo
- Optimized re-renders with useCallback

---

## Testing

### Unit Tests

- Validation schema tests
- Service function tests
- Utility function tests

### Component Tests (React Testing Library)

- Form submission flows
- Validation error display
- Loading state rendering
- Success/error callbacks

### Integration Tests

- Sign-in flow end-to-end
- Sign-up flow end-to-end
- Wallet connection flow
- Google OAuth flow
- Language switching
- Theme switching

### Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Test Command:**

```bash
npm test --workspace=client
```

---

## Environment Variables

Required environment variables in `client/.env`:

```env
# Google OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# API Endpoints (if different from default)
VITE_API_BASE_URL=http://localhost:3000
```

---

## Examples

### Complete Authentication Flow

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignInForm, SignUpForm, WalletModal } from "./components/auth";
import { Header } from "./components/navigation";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showWallet, setShowWallet] = useState(false);
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate("/dashboard");
  };

  return (
    <div>
      <Header />
      {mode === "signin" ? (
        <SignInForm
          onSuccess={handleSuccess}
          onOpenWalletModal={() => setShowWallet(true)}
          onNavigateToSignUp={() => setMode("signup")}
        />
      ) : (
        <SignUpForm
          onSuccess={handleSuccess}
          onOpenWalletModal={() => setShowWallet(true)}
          onNavigateToSignIn={() => setMode("signin")}
        />
      )}
      <WalletModal
        open={showWallet}
        onClose={() => setShowWallet(false)}
        mode={mode}
      />
    </div>
  );
}
```

---

## Troubleshooting

### Common Issues

**Issue**: Google OAuth not working

- **Solution**: Verify `VITE_GOOGLE_CLIENT_ID` is set correctly
- **Solution**: Check authorized JavaScript origins in Google Console
- **Solution**: Ensure redirect URIs are whitelisted

**Issue**: Wallet detection fails

- **Solution**: Ensure wallet extension is installed and enabled
- **Solution**: Check browser console for wallet connection errors
- **Solution**: Try refreshing the page after installing wallet

**Issue**: Validation errors not displaying

- **Solution**: Verify Zod schemas are imported correctly
- **Solution**: Check i18n keys match schema validation messages
- **Solution**: Ensure react-hook-form is configured with zodResolver

**Issue**: Theme not switching

- **Solution**: Verify ThemeContext is wrapping the app
- **Solution**: Check data-carbon-theme attribute on root element
- **Solution**: Clear browser cache and reload

**Issue**: Language not switching

- **Solution**: Verify i18next is initialized in main.tsx
- **Solution**: Check translation files exist for selected language
- **Solution**: Ensure useTranslation hook is used in components

---

## Contributing

When adding new components:

1. Follow Carbon Design System guidelines
2. Add TypeScript interfaces for all props
3. Include JSDoc comments with examples
4. Add i18n support for all text
5. Implement keyboard navigation
6. Add ARIA labels for accessibility
7. Write unit and component tests
8. Update this README with usage examples

---

## Resources

- [Carbon Design System](https://carbondesignsystem.com/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [i18next](https://www.i18next.com/)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Google OAuth](https://developers.google.com/identity/sign-in/web)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
