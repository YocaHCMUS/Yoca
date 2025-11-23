# Tasks: Authentication & Navigation UI Components

**Input**: Design documents from `/specs/001-auth-ui-components/`  
**Prerequisites**: plan.md ✅, spec.md ✅, DEPENDENCIES.md ✅

**Tests**: Not required for this feature (interactive testing via showcase page)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each component.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This project uses monorepo structure with npm workspaces:

- **Frontend**: `client/src/`
- **Paths**: All paths use forward slashes `/` for consistency

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment configuration and provider setup

- [x] T001 Create environment variable template in client/.env.example
- [x] T002 [P] Configure i18n in client/src/i18n/config.ts with English, Vietnamese, Japanese translations
- [x] T003 [P] Create Carbon theme integration in client/src/styles/carbon.scss
- [x] T004 [P] Create theme variables file in client/src/styles/theme.scss
- [x] T005 [P] Create shared auth types in client/src/types/auth.ts
- [x] T006 Update client/src/main.tsx to import Carbon styles and configure providers (WalletProvider, GoogleOAuthProvider, i18n)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create mock authentication service in client/src/services/auth/authService.ts
- [x] T008 [P] Create mock wallet service in client/src/services/auth/walletService.ts
- [x] T009 [P] Create AuthContext provider in client/src/contexts/AuthContext.tsx
- [x] T010 [P] Create ThemeContext provider in client/src/contexts/ThemeContext.tsx
- [x] T011 Create barrel export in client/src/services/auth/index.ts
- [x] T012 Create barrel export in client/src/contexts/index.ts

**Checkpoint**: Foundation ready - component implementation can now begin in parallel

---

## Phase 3: User Story 1 - Sign In with Credentials (Priority: P1) 🎯 MVP

**Goal**: Users can authenticate using email/username and password with validation

**Independent Test**: Render sign-in form, enter credentials, submit, verify mock authentication flow triggers with loading/error/success states

### Implementation for User Story 1

- [x] T013 [P] [US1] Create SignInForm component in client/src/components/auth/SignInForm.tsx
- [x] T014 [P] [US1] Create Zod validation schema for sign-in in client/src/components/auth/schemas/signInSchema.ts
- [x] T015 [US1] Implement form state management with React Hook Form in SignInForm.tsx
- [x] T016 [US1] Add Carbon TextInput components for username/email and password fields
- [x] T017 [US1] Add inline validation error messages using Carbon's error states
- [x] T018 [US1] Implement submit button with loading state and disabled during submission
- [x] T019 [US1] Add "Forgot password?" link with placeholder href
- [x] T020 [US1] Add "Want to have an account?" navigation link to sign-up page
- [x] T021 [US1] Style SignInForm with Tailwind CSS utilities for layout and spacing
- [x] T022 [US1] Add form component styles in client/src/components/auth/SignInForm.module.scss

**Checkpoint**: Sign-in form should be fully functional with validation and mock authentication

---

## Phase 4: User Story 2 - Sign Up with Email (Priority: P1) 🎯 MVP

**Goal**: New users can create accounts with email, username, password validation

**Independent Test**: Render sign-up form, enter registration data, verify validation (password match, email format), submit, verify mock account creation

### Implementation for User Story 2

- [x] T023 [P] [US2] Create SignUpForm component in client/src/components/auth/SignUpForm.tsx
- [x] T024 [P] [US2] Create Zod validation schema for sign-up in client/src/components/auth/schemas/signUpSchema.ts
- [x] T025 [US2] Implement form state management with React Hook Form in SignUpForm.tsx
- [x] T026 [US2] Add Carbon TextInput components for email, username, password, retype password
- [x] T027 [US2] Add password match validation with custom error message
- [x] T028 [US2] Add email format validation with clear error messaging
- [x] T029 [US2] Implement "Create account" button with loading state
- [x] T030 [US2] Add "Already have an account?" navigation link to sign-in page
- [x] T031 [US2] Add Terms of Service and Privacy Policy links (placeholder hrefs)
- [x] T032 [US2] Style SignUpForm with Tailwind CSS utilities for layout and spacing
- [x] T033 [US2] Add form component styles in client/src/components/auth/SignUpForm.module.scss
- [x] T034 [US2] Create barrel export for auth components in client/src/components/auth/index.ts

**Checkpoint**: Sign-up form should be fully functional with all validation rules

---

## Phase 5: User Story 3 - Wallet Authentication (Priority: P2)

**Goal**: Users can connect Solana wallets for Web3 authentication

**Independent Test**: Click wallet button, see modal with wallet list, detect installed wallets, verify connection flow

### Implementation for User Story 3

- [ ] T035 [P] [US3] Create WalletModal component in client/src/components/auth/WalletModal.tsx
- [ ] T036 [P] [US3] Create wallet detection logic in walletService.ts
- [ ] T037 [US3] Implement Carbon Modal structure for wallet selection
- [ ] T038 [US3] Create wallet list grid showing popular Solana wallets (Phantom, Solflare, etc.)
- [ ] T039 [US3] Add "Detected" badge for installed wallets using wallet adapter detection
- [ ] T040 [US3] Implement wallet selection handler with mock connection flow
- [ ] T041 [US3] Add blockchain selector dropdown (defaulting to Solana)
- [ ] T042 [US3] Add "No wallet detected" state with installation guidance
- [ ] T043 [US3] Add loading state during wallet connection attempt
- [ ] T044 [US3] Add error state for rejected connections with retry option
- [ ] T045 [US3] Style WalletModal with Tailwind CSS utilities
- [ ] T046 [US3] Add modal component styles in client/src/components/auth/WalletModal.module.scss
- [ ] T047 [US3] Add "Continue with a linked wallet" button to SignInForm.tsx
- [ ] T048 [US3] Add "Sign up with an existing wallet(s)" button to SignUpForm.tsx

**Checkpoint**: Wallet modal should open from auth forms, detect wallets, and handle connection flow

---

## Phase 6: User Story 4 - Google OAuth Authentication (Priority: P2)

**Goal**: Users can sign in/up using Google accounts

**Independent Test**: Click Google button, verify OAuth flow initiates correctly

### Implementation for User Story 4

- [ ] T049 [P] [US4] Create GoogleAuthButton component in client/src/components/auth/GoogleAuthButton.tsx
- [ ] T050 [US4] Implement Google OAuth button using @react-oauth/google
- [ ] T051 [US4] Add success callback handler with mock account linking
- [ ] T052 [US4] Add error callback handler for cancelled/failed OAuth
- [ ] T053 [US4] Style GoogleAuthButton with Carbon Button and Google branding
- [ ] T054 [US4] Add component styles in client/src/components/auth/GoogleAuthButton.module.scss
- [ ] T055 [US4] Integrate GoogleAuthButton into SignInForm.tsx as "Continue with Google"
- [ ] T056 [US4] Integrate GoogleAuthButton into SignUpForm.tsx as "Sign up with Google"

**Checkpoint**: Google OAuth flow should initiate from both sign-in and sign-up forms

---

## Phase 7: User Story 5 - Navigation Header (Priority: P3)

**Goal**: Authenticated users see consistent navigation with profile, language, theme controls

**Independent Test**: Render header with authenticated state, verify navigation links, dropdowns, language switching, theme toggle all function

### Implementation for User Story 5

- [ ] T057 [P] [US5] Create Header component in client/src/components/navigation/Header.tsx
- [ ] T058 [P] [US5] Create LanguageSelector component in client/src/components/navigation/LanguageSelector.tsx
- [ ] T059 [P] [US5] Create ThemeToggle component in client/src/components/navigation/ThemeToggle.tsx
- [ ] T060 [US5] Implement Carbon Header component structure with navigation items (Market, Alert, Dashboard)
- [ ] T061 [US5] Add user profile dropdown with username display (authenticated state)
- [ ] T062 [US5] Implement LanguageSelector with dropdown showing English, Tiếng Việt, 日本語
- [ ] T063 [US5] Integrate i18next language switching in LanguageSelector
- [ ] T064 [US5] Implement ThemeToggle with icon button (sun/moon icons)
- [ ] T065 [US5] Integrate ThemeContext for light/dark mode switching in ThemeToggle
- [ ] T066 [US5] Add unauthenticated state showing "Sign up" and "Login" buttons
- [ ] T067 [US5] Style Header with Tailwind CSS utilities for layout
- [ ] T068 [US5] Add header component styles in client/src/components/navigation/Header.module.scss
- [ ] T069 [US5] Create barrel export in client/src/components/navigation/index.ts

**Checkpoint**: Header should render with all navigation controls functional

---

## Phase 8: Showcase Page (Temporary Homepage)

**Purpose**: Create temporary homepage demonstrating all components with placeholder content

- [ ] T070 Create showcase page component in client/src/pages/showcase/index.tsx
- [ ] T071 Import and render Header component at top of showcase page
- [ ] T072 Create section for Sign In component with placeholder intro text
- [ ] T073 Create section for Sign Up component with placeholder intro text
- [ ] T074 Create section demonstrating Wallet Modal (with trigger button)
- [ ] T075 Create section demonstrating Google OAuth buttons
- [ ] T076 Add placeholder content sections for Market, Alert, Dashboard pages
- [ ] T077 Style showcase page with Tailwind CSS for layout and section spacing
- [ ] T078 Add page styles in client/src/pages/showcase/index.module.scss
- [ ] T079 Update client/src/App.tsx to route to showcase page
- [ ] T080 Add responsive layout adjustments for mobile/tablet viewports

**Checkpoint**: Showcase page should display all components with working interactions

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple components

- [ ] T081 [P] Add keyboard navigation support across all form components
- [ ] T082 [P] Add ARIA labels and screen reader announcements to all interactive elements
- [ ] T083 [P] Verify all components handle rapid-click submission prevention
- [ ] T084 [P] Add focus management for modal open/close (trap focus in WalletModal)
- [ ] T085 Add loading skeleton states for wallet detection
- [ ] T086 Test form validation error messages for clarity and helpfulness
- [ ] T087 Verify theme switching applies correctly to all components
- [ ] T088 Verify language switching updates all text content
- [ ] T089 Test all components in Chrome, Firefox, Safari latest 2 versions
- [ ] T090 Run bundle size check to verify within 500KB budget
- [ ] T091 Test component render performance (<100ms initial render)
- [ ] T092 Test form validation response time (<500ms)
- [ ] T093 Test language/theme switching performance (<200ms)
- [ ] T094 Add JSDoc comments to all exported components
- [ ] T095 Update README.md with showcase page instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order: US1 → US2 → US3 → US4 → US5
- **Showcase Page (Phase 8)**: Depends on all user stories being complete
- **Polish (Phase 9)**: Depends on Showcase Page completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1/US2 but independently testable
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1/US2 but independently testable
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Uses AuthContext but independently testable

### Within Each User Story

- Schema creation before form component implementation
- Form structure before validation integration
- Core functionality before styling
- Component complete before integration into showcase page

### Parallel Opportunities

- **Phase 1 (Setup)**: All tasks marked [P] can run in parallel
- **Phase 2 (Foundational)**: All tasks marked [P] can run in parallel
- **Phase 3-7 (User Stories)**: Once Foundational completes, all user stories can start in parallel
- **Within User Stories**: Tasks marked [P] can run in parallel
- **Phase 9 (Polish)**: All tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1 (Sign In)

```bash
# Launch schema and component skeleton together:
Task T013: "Create SignInForm component in client/src/components/auth/SignInForm.tsx"
Task T014: "Create Zod validation schema for sign-in in client/src/components/auth/schemas/signInSchema.ts"

# After T015 completes, these can run in parallel:
Task T016: "Add Carbon TextInput components for username/email and password fields"
Task T019: "Add 'Forgot password?' link with placeholder href"
Task T020: "Add 'Want to have an account?' navigation link to sign-up page"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Sign In)
4. Complete Phase 4: User Story 2 (Sign Up)
5. Create minimal showcase page with just sign-in/sign-up forms
6. **STOP and VALIDATE**: Test both forms independently
7. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 (Sign In) → Test independently
3. Add User Story 2 (Sign Up) → Test independently → **MVP Ready!**
4. Add User Story 3 (Wallet) → Test independently
5. Add User Story 4 (Google OAuth) → Test independently
6. Add User Story 5 (Navigation) → Test independently
7. Complete Showcase Page → Test all interactions
8. Polish & accessibility → Production ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (6 tasks, ~2-3 hours)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (Sign In) → 10 tasks
   - **Developer B**: User Story 2 (Sign Up) → 12 tasks
   - **Developer C**: User Story 3 (Wallet) → 14 tasks
3. User Story 4 & 5 can follow, then integrate into showcase
4. Team collaborates on polish phase

---

## Notes

- All components use Carbon Design System as foundation with Tailwind CSS for customization
- Mock services simulate realistic async operations with delays
- Showcase page serves as interactive component library and testing environment
- [P] tasks = different files, no dependencies on other in-progress tasks
- [Story] label maps task to specific user story for traceability
- Commit after each task or logical group of related tasks
- Stop at checkpoints to validate story independently before proceeding
- Environment variables needed: VITE_GOOGLE_CLIENT_ID (mock value acceptable for this branch)
