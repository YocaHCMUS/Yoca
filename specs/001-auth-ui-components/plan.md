# Implementation Plan: Authentication & Navigation UI Components

**Branch**: `001-auth-ui-components` | **Date**: 2025-11-23 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-auth-ui-components/spec.md`

## Summary

Build reusable authentication and navigation UI components using Carbon Design System with Tailwind CSS customizations. Components include sign-in/sign-up forms, wallet connection modal, Google OAuth integration, and navigation header with language/theme switching. Components will be showcased in a temporary homepage with placeholder content and mock data for testing interactions.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)  
**Primary Dependencies**:

- Frontend: React 19, Vite 7, React Router 7, Tailwind CSS 3.4.14
- UI Framework: Carbon Design System 1.96.0 (foundation) + Tailwind CSS (customizations)
- Forms: React Hook Form 7.66.1 + Zod 4.1.12 (validation)
- Web3: @solana/wallet-adapter-react 0.15.39
- Auth: @react-oauth/google 0.12.2
- i18n: i18next 25.6.3 + react-i18next 16.3.5

**Storage**: N/A (mock data for this branch)  
**Testing**: Test approach TBD (component testing with mock interactions acceptable)  
**Target Platform**: Web application (Chrome 90+, Firefox 88+, Safari 14+)  
**Project Type**: Monorepo (client/ workspace)  
**Performance Goals**:

- TTI < 3s
- Component initial render < 100ms
- Form validation response < 500ms
- Language/theme switching < 200ms

**Constraints**:

- Bundle size impact: ~335-435KB gzipped (already installed dependencies)
- Must remain within 500KB initial load budget
- All components must be keyboard accessible and screen-reader friendly

**Scale/Scope**:

- Single-page showcase with all auth components
- Mock data for interactions
- No backend integration required for this branch

## Constitution Check

_GATE: Must pass before implementation._

**Yoca Constitution v1.0.0 Compliance**:

- [x] **Type Safety First**: All components will use TypeScript strict mode with explicit prop types
- [x] **Service Layer Abstraction**: Mock auth services will be created for component testing
- [x] **Validation at Boundaries**: Zod schemas will validate all form inputs before submission
- [x] **Component Modularity**: All components will be self-contained with typed props, co-located styles
- [x] **Performance Budgets**: Bundle size already assessed (dependencies installed), component render performance monitored
- [x] **Error Handling & Observability**: Components will handle loading/error/success states explicitly
- [x] **Testing Strategy**: Interactive testing via temporary homepage with mock data

**Violations Requiring Justification**: None

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-ui-components/
├── plan.md              # This file
├── spec.md              # Feature specification
├── DEPENDENCIES.md      # Dependency audit and setup guide
└── tasks.md             # Implementation tasks (to be created)
```

### Source Code (repository root)

**Feature Integration Points**:

```text
client/
├── src/
│   ├── components/
│   │   └── auth/                      # NEW: Auth components
│   │       ├── SignInForm.tsx         # Sign-in form component
│   │       ├── SignUpForm.tsx         # Sign-up form component
│   │       ├── WalletModal.tsx        # Wallet connection modal
│   │       ├── GoogleAuthButton.tsx   # Google OAuth button
│   │       └── index.ts               # Exports
│   ├── components/
│   │   └── navigation/                # NEW: Navigation components
│   │       ├── Header.tsx             # Main navigation header
│   │       ├── LanguageSelector.tsx   # Language dropdown
│   │       ├── ThemeToggle.tsx        # Dark/light mode toggle
│   │       └── index.ts               # Exports
│   ├── pages/
│   │   └── showcase/                  # NEW: Temporary showcase page
│   │       └── index.tsx              # Homepage with all components
│   ├── services/
│   │   └── auth/                      # NEW: Mock auth services
│   │       ├── authService.ts         # Mock sign-in/sign-up
│   │       ├── walletService.ts       # Mock wallet connection
│   │       └── index.ts               # Exports
│   ├── types/
│   │   └── auth.ts                    # NEW: Auth-related types
│   ├── i18n/
│   │   └── config.ts                  # NEW: i18n configuration
│   ├── styles/
│   │   ├── carbon.scss                # NEW: Carbon imports
│   │   └── theme.scss                 # NEW: Theme variables
│   └── main.tsx                       # Update: Add providers
├── .env.example                        # NEW: Environment template
└── package.json                        # Already updated with dependencies
```

## Libraries & Architecture Decisions

### UI Component Strategy: Carbon + Tailwind Hybrid

**Decision**: Use Carbon Design System components as foundation, customize with Tailwind CSS utilities.

**Rationale**:

- Carbon provides enterprise-grade accessibility, form inputs, and design patterns
- Tailwind enables rapid customization without writing custom CSS
- Hybrid approach balances consistency with flexibility

**Implementation**:

- Carbon components for form inputs, buttons, modals
- Tailwind for layouts, spacing, custom styling
- Carbon theme variables integrated with Tailwind config

### Form Validation: Zod + React Hook Form

**Decision**: Use Zod for schema definition, React Hook Form for state management.

**Rationale**:

- Type-safe validation with TypeScript inference
- Minimal re-renders (performance)
- Consistent validation between client and future server implementation

**Implementation**:

- Co-locate Zod schemas with form components
- Use `@hookform/resolvers/zod` for integration
- Inline error messages with Carbon's error states

### Wallet Integration: Solana Wallet Adapter

**Decision**: Use @solana/wallet-adapter-react with standard UI components.

**Rationale**:

- Standard interface across Solana ecosystem
- Auto-detection of installed wallets
- Pre-built UI components reduce development time

**Implementation**:

- WalletProvider wraps app in main.tsx
- Custom modal UI using Carbon + Tailwind
- Detection state displayed in wallet grid

### State Management: React Context + Hooks

**Decision**: Use React Context for global state (auth, theme, language), local state for component interactions.

**Rationale**:

- Avoids heavy state management library for UI-focused feature
- Context sufficient for auth status and preferences
- Aligns with React 19 patterns

**Implementation**:

- AuthContext for mock authentication state
- ThemeContext for light/dark mode
- LanguageContext for i18n switching

### Mock Data Strategy

**Decision**: Create mock services with simulated async operations and realistic delays.

**Rationale**:

- Tests UI interactions without backend
- Simulates real-world latency
- Easy to replace with real API calls later

**Implementation**:

- Mock services return Promises with setTimeout
- Realistic error scenarios (invalid credentials, network errors)
- Mock wallet detection based on browser extensions

## Complexity Tracking

No violations. All decisions align with constitution principles.
