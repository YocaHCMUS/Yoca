# Implementation Plan: Authentication & Navigation UI Components

**Branch**: `001-auth-ui-components` | **Date**: 2025-11-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-auth-ui-components/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build reusable authentication and navigation UI components using Carbon Design System with Tailwind CSS customization. Components include sign-in/sign-up forms with email and wallet authentication, Google OAuth integration, wallet connection modal with multi-wallet detection, and responsive navigation header with language/theme switching. All components support internationalization (English, Vietnamese, Japanese) and follow strict TypeScript typing with Zod validation.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)  
**Primary Dependencies**:

- Frontend: React 19, Vite 7, React Router 7, Carbon Design System, Tailwind CSS 4, i18next (internationalization), react-hook-form, Zod (validation)
- Backend: Hono 4, Node.js 20+, Zod (validation)
- Wallet Integration: Solana wallet adapter (NEEDS CLARIFICATION on specific packages)
- Authentication: Google OAuth (NEEDS CLARIFICATION on implementation library)

**Storage**: N/A (components only, backend API integration assumed to exist)  
**Testing**: Vitest for unit tests, React Testing Library for component tests (NEEDS CLARIFICATION on E2E testing approach)  
**Target Platform**: Web application (Chrome 90+, Firefox 88+, Safari 14+ latest 2 versions)  
**Project Type**: Web (monorepo with client/ and server/ workspaces)

**Internationalization**:

- **Supported Languages**: English (en), Vietnamese (vi), Japanese (ja)
- **i18n Library**: i18next with react-i18next
- **Configuration**: `client/src/i18n/config.ts` with complete translations for auth, wallet, navigation, validation, and common UI text
- **Translation Keys**: Pre-defined structured keys covering all component text (auth.signIn, wallet.connectWallet, nav.dashboard, validation.passwordRequired, etc.)
- **Default Language**: English with fallback

**Performance Goals**:

- Component render time < 100ms (per constitution)
- Language switching < 200ms (per constitution)
- Theme toggle < 100ms (per constitution)
- Form validation feedback < 500ms (per spec)
- Wallet detection < 5 seconds (per spec)
- Bundle size impact: Estimate +80KB for Carbon components, +20KB for i18n, +15KB for wallet adapters (within 500KB budget)

**Constraints**:

- Must use Carbon Design System as foundation with Tailwind CSS for customizations
- Must support keyboard accessibility and screen readers
- Must prevent duplicate form submissions
- Must handle wallet detection failures gracefully
- Form validation must be consistent with backend validation rules (NEEDS CLARIFICATION on backend validation schemas)

**Scale/Scope**:

- Expected users: 1000+ concurrent authenticated users
- Component reusability: Components must be modular for use across multiple pages
- Wallet support: Initially Solana only, architecture must allow future blockchain support
- OAuth providers: Initially Google only, architecture must allow future providers

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Initial Check (Pre-Phase 0)**: ✅ PASSED

**Yoca Constitution v1.0.0 Compliance**:

- [x] **Type Safety First**: All components use TypeScript strict mode with explicit prop types, form validation uses Zod schemas, no `any` types
- [x] **Service Layer Abstraction**: Auth logic separated into `services/auth/` (authService.ts, walletService.ts), components delegate to services
- [x] **Validation at Boundaries**: All form inputs validated with Zod schemas before submission (signInSchema.ts, signUpSchema.ts)
- [x] **Component Modularity**: Self-contained components with typed props (SignInForm, SignUpForm, WalletModal), minimal state, documented with usage examples
- [x] **Performance Budgets**: Bundle size impact assessed (+115KB estimated), component render times within targets, language switching optimized
- [x] **Error Handling & Observability**: Comprehensive error handling with i18n error messages, structured validation feedback, wallet connection error states
- [x] **Testing Strategy**: Unit tests for validation schemas and services, component tests for UI interactions, integration tests for auth flows (NEEDS CLARIFICATION on E2E scope)

**Post-Phase 1 Re-Check**: ✅ PASSED

**Design Verification**:

- ✅ **Type Safety**: All entities in `data-model.md` have explicit TypeScript interfaces
- ✅ **Service Layer**: API contracts defined in `contracts/auth-api.yaml`, services consume these contracts
- ✅ **Validation**: Shared Zod schemas between frontend and backend (defined in research.md)
- ✅ **Modularity**: Component props and state clearly separated, minimal coupling
- ✅ **Performance**: Bundle size impact documented (+115KB for all deps), within 500KB budget
- ✅ **Error Handling**: ErrorResponse schema standardized across all API endpoints
- ✅ **Testing**: E2E approach resolved (Playwright with mocked wallet/OAuth)

**Violations Requiring Justification**: None

**Additional Notes**:

- Internationalization (i18n) is a core requirement with existing config in `client/src/i18n/config.ts`
- Carbon Design System usage aligns with Component Modularity principle (established design system)
- Tailwind CSS customization allows for design flexibility while maintaining Carbon foundation
- All NEEDS CLARIFICATION items from Technical Context have been resolved in `research.md`

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Yoca Monorepo Structure** (npm workspaces):

```text
client/                    # Frontend workspace (React + Vite)
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route-level page components
│   ├── services/         # API clients and business logic
│   ├── api/              # API integration layer
│   ├── util/             # Utility functions
│   └── assets/           # Static assets
├── build/                # Production build output
└── tests/                # Frontend tests

server/                    # Backend workspace (Hono + Node.js)
├── src/
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   ├── middleware/       # Custom middleware
│   ├── data/             # Data schemas and models
│   ├── types/            # Shared type definitions
│   └── util/             # Utility functions
├── build/                # Compiled JavaScript output
└── tests/                # Backend tests
│   ├── unit/             # Unit tests
│   ├── integration/      # API integration tests
│   └── contract/         # Contract tests

.specify/                  # Spec-Kit configuration
├── memory/
│   └── constitution.md   # This project's constitution
└── templates/            # Document templates
```

**Feature Integration Points**:

- **Frontend**: Add components to `client/src/components/` or `client/src/pages/`
- **Backend**: Add routes to `server/src/routes/`, services to `server/src/services/`
- **Shared Types**: Define in `server/src/types/` and import in client via path aliases
- **Validation**: Use Zod schemas in `server/src/middleware/` or co-located with routes

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
