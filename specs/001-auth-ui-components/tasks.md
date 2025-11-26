# Tasks: Authentication & Navigation UI Components

**Input**: Design documents from `/specs/001-auth-ui-components/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested - using interactive showcase page for validation

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each component.

## Format: `- [ ] [ID] [P?] [Story] Description`

**CRITICAL FORMAT RULES**:

- MUST start with `- [ ]` (markdown checkbox)
- MUST include task ID (T001, T002, etc.)
- MUST include [P] marker ONLY if parallelizable (different files, no incomplete dependencies)
- MUST include [Story] label for user story phases ONLY (e.g., [US1], [US2])
- MUST include exact file path in description

## Path Conventions

This project uses monorepo structure with npm workspaces:

- **Frontend**: `client/src/`
- **Backend**: `server/src/`
- **Paths**: All paths use forward slashes `/` for consistency

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment configuration and dependency setup

- [x] T001 Create environment variable template in client/.env.example
- [x] T002 [P] Configure i18n with English, Vietnamese, Japanese translations in client/src/i18n/config.ts
- [x] T003 [P] Create Carbon theme integration in client/src/styles/carbon.scss
- [x] T004 [P] Create theme variables file in client/src/styles/theme.scss
- [x] T005 [P] Create shared auth types in client/src/types/auth.ts
- [x] T006 Update client/src/main.tsx to import Carbon styles and configure i18n initialization

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create authentication service skeleton in client/src/services/auth/authService.ts
- [x] T008 [P] Create wallet service skeleton in client/src/services/auth/walletService.ts
- [x] T009 [P] Create AuthContext provider in client/src/contexts/AuthContext.tsx
- [x] T010 [P] Create ThemeContext provider in client/src/contexts/ThemeContext.tsx
- [x] T011 Create barrel export in client/src/services/auth/index.ts
- [x] T012 Create barrel export in client/src/contexts/index.ts

**Checkpoint**: Foundation ready - component implementation can now begin in parallel

---

## Phase 3: User Story 1 - Sign In with Credentials (Priority: P1) 🎯 MVP

**Goal**: Users can authenticate using email/username and password with validation

**Independent Test**: Render sign-in form, enter valid credentials, submit form, verify validation triggers correctly and authentication flow handles success/error states properly

**Acceptance Criteria**:

- Valid username/email and password authentication succeeds
- Invalid credentials show clear error message
- "Forgot password?" link is present
- "Want to have an account?" link navigates to sign-up

### Implementation for User Story 1

- [x] T013 [P] [US1] Create SignInForm component skeleton in client/src/components/auth/SignInForm.tsx
- [x] T014 [P] [US1] Create Zod validation schema in client/src/components/auth/schemas/signInSchema.ts
- [x] T015 [US1] Implement form state management with react-hook-form in SignInForm.tsx
- [x] T016 [US1] Add Carbon TextInput for identifier field (email/username) in SignInForm.tsx
- [x] T017 [US1] Add Carbon TextInput for password field in SignInForm.tsx
- [x] T018 [US1] Implement inline validation error messages in SignInForm.tsx
- [x] T019 [US1] Add Carbon Button for submit with loading state in SignInForm.tsx
- [x] T020 [US1] Add "Forgot password?" link in SignInForm.tsx
- [x] T021 [US1] Add "Want to have an account?" navigation link in SignInForm.tsx
- [x] T022 [US1] Style SignInForm with Tailwind CSS and Carbon Design System in client/src/components/auth/SignInForm.module.scss

**Checkpoint**: Sign-in form should be fully functional with validation and authentication flow

---

## Phase 4: User Story 2 - Sign Up with Email (Priority: P1) 🎯 MVP

**Goal**: New users can create accounts with email, username, and password validation

**Independent Test**: Render sign-up form, enter registration data with mismatched passwords, verify validation error appears, then enter valid data and submit to verify account creation flow

**Acceptance Criteria**:

- Email, username, password, and confirm password fields validate correctly
- Passwords must match before submission
- Invalid email format shows validation error
- "Already have an account?" link navigates to sign-in
- Terms of Service and Privacy Policy acknowledgment is displayed

### Implementation for User Story 2

- [x] T023 [P] [US2] Create SignUpForm component skeleton in client/src/components/auth/SignUpForm.tsx
- [x] T024 [P] [US2] Create Zod validation schema in client/src/components/auth/schemas/signUpSchema.ts
- [x] T025 [US2] Implement form state management with react-hook-form in SignUpForm.tsx
- [x] T026 [US2] Add Carbon TextInput for email field in SignUpForm.tsx
- [x] T027 [US2] Add Carbon TextInput for username field in SignUpForm.tsx
- [x] T028 [US2] Add Carbon TextInput for password field in SignUpForm.tsx
- [x] T029 [US2] Add Carbon TextInput for retype password field in SignUpForm.tsx
- [x] T030 [US2] Implement password match validation logic in SignUpForm.tsx
- [x] T031 [US2] Add Carbon Button for "Create account" with loading state in SignUpForm.tsx
- [x] T032 [US2] Add "Already have an account?" navigation link in SignUpForm.tsx
- [x] T033 [US2] Add Terms of Service and Privacy Policy links in SignUpForm.tsx
- [x] T034 [US2] Style SignUpForm with Tailwind CSS and Carbon Design System in client/src/components/auth/SignUpForm.module.scss
- [x] T035 [US2] Create barrel export for auth components in client/src/components/auth/index.ts

**Checkpoint**: Sign-up form should be fully functional with all validation rules enforced

---

## Phase 5: User Story 3 - Wallet Authentication (Priority: P2)

**Goal**: Users can connect Solana wallets for Web3 authentication

**Independent Test**: Click "Continue with wallet" button, verify wallet modal opens showing detected wallets, select wallet, verify connection flow handles success/rejection correctly

**Acceptance Criteria**:

- Wallet selection modal opens from auth forms
- Detected Solana wallets are visually marked
- Installation guidance shown when no wallets detected
- Wallet connection approval redirects to dashboard
- Connection rejection returns to modal with error message

### Implementation for User Story 3

- [x] T036 [P] [US3] Create WalletModal component skeleton in client/src/components/auth/WalletModal.tsx
- [x] T037 [P] [US3] Create wallet detection utility in client/src/services/auth/walletService.ts
- [x] T038 [US3] Implement Carbon Modal structure in WalletModal.tsx
- [x] T039 [US3] Create wallet list grid with popular Solana wallets (Phantom, Solflare, Backpack, Glow) in WalletModal.tsx
- [x] T040 [US3] Implement wallet detection logic with "Detected" badge in WalletModal.tsx
- [x] T041 [US3] Add wallet selection click handler in WalletModal.tsx
- [x] T042 [US3] Implement blockchain selector dropdown (Solana default) in WalletModal.tsx
- [x] T043 [US3] Add "No wallet detected" empty state in WalletModal.tsx
- [x] T044 [US3] Add wallet installation guidance and links in WalletModal.tsx
- [x] T045 [US3] Add loading state during wallet detection in WalletModal.tsx
- [x] T046 [US3] Add loading state during wallet connection in WalletModal.tsx
- [x] T047 [US3] Add error state for rejected connection with retry in WalletModal.tsx
- [x] T048 [US3] Style WalletModal with Tailwind CSS and Carbon Design System in client/src/components/auth/WalletModal.module.scss
- [x] T049 [US3] Add "Continue with a linked wallet" button to SignInForm.tsx
- [x] T050 [US3] Add "Sign up with an existing wallet(s)" button to SignUpForm.tsx

**Checkpoint**: Wallet modal should open from auth forms, detect wallets, and handle full connection flow

---

## Phase 6: User Story 4 - Google OAuth Authentication (Priority: P2)

**Goal**: Users can sign in or sign up using their Google account for faster onboarding

**Independent Test**: Click "Continue with Google" button, verify OAuth popup initiates, test cancellation returns to form, test successful auth creates/authenticates user

**Acceptance Criteria**:

- "Continue with Google" button on sign-in initiates OAuth
- "Sign up with Google" button on sign-up initiates OAuth
- OAuth cancellation returns to form without errors
- Successful OAuth authenticates or creates account

### Implementation for User Story 4

- [x] T051 [P] [US4] Create GoogleAuthButton component in client/src/components/auth/GoogleAuthButton.tsx
- [x] T052 [P] [US4] Install and configure @react-oauth/google provider in client/src/main.tsx
- [x] T053 [US4] Implement GoogleLogin component with custom styling in GoogleAuthButton.tsx
- [x] T054 [US4] Add OAuth success handler with token validation in GoogleAuthButton.tsx
- [x] T055 [US4] Add OAuth error handler for cancelled/failed authentication in GoogleAuthButton.tsx
- [x] T056 [US4] Style GoogleAuthButton with Carbon and Google branding in client/src/components/auth/GoogleAuthButton.module.scss
- [x] T057 [US4] Integrate GoogleAuthButton into SignInForm.tsx as "Continue with Google"
- [x] T058 [US4] Integrate GoogleAuthButton into SignUpForm.tsx as "Sign up with Google"
- [x] T059 [US4] Update AuthContext to handle Google authentication flow in client/src/contexts/AuthContext.tsx

**Checkpoint**: Google OAuth flow should initiate from both sign-in and sign-up forms with proper error handling

---

## Phase 7: User Story 5 - Navigation Header (Priority: P3)

**Goal**: Authenticated users see consistent navigation with profile, language selector, and theme toggle

**Independent Test**: Render header in authenticated state, verify navigation items (Market, Alert, Dashboard) are visible, test language selector switches languages, test theme toggle switches between light/dark mode, verify unauthenticated state shows sign-up/login buttons

**Acceptance Criteria**:

- Header shows Market, Alert, Dashboard navigation items when authenticated
- Username dropdown shows profile options
- Language selector displays English, Tiếng Việt, 日本語 options
- Language switching updates all i18n text within 200ms
- Theme toggle switches between light and dark mode within 100ms
- Unauthenticated state shows "Sign up" and "Login" buttons instead of username

### Implementation for User Story 5

- [x] T060 [P] [US5] Create Header component skeleton in client/src/components/navigation/Header.tsx
- [x] T061 [P] [US5] Create LanguageSelector component in client/src/components/navigation/LanguageSelector.tsx
- [x] T062 [P] [US5] Create ThemeToggle component in client/src/components/navigation/ThemeToggle.tsx
- [x] T063 [US5] Implement Carbon Header with navigation items (Market, Alert, Dashboard) in Header.tsx
- [x] T064 [US5] Add user profile dropdown with username display in Header.tsx
- [x] T065 [US5] Add sign-out functionality to profile dropdown in Header.tsx
- [x] T066 [US5] Implement LanguageSelector dropdown with i18next integration in LanguageSelector.tsx
- [x] T067 [US5] Add language options (English, Tiếng Việt, 日本語) with flags/labels in LanguageSelector.tsx
- [x] T068 [US5] Implement ThemeToggle button with sun/moon icons in ThemeToggle.tsx
- [x] T069 [US5] Integrate ThemeContext for light/dark mode switching in ThemeToggle.tsx
- [x] T070 [US5] Add unauthenticated state rendering "Sign up" and "Login" buttons in Header.tsx
- [x] T071 [US5] Style Header with Tailwind CSS and Carbon Design System in client/src/components/navigation/Header.module.scss
- [x] T072 [US5] Style LanguageSelector in client/src/components/navigation/LanguageSelector.module.scss
- [x] T073 [US5] Style ThemeToggle in client/src/components/navigation/ThemeToggle.module.scss
- [x] T074 [US5] Create barrel export in client/src/components/navigation/index.ts

**Checkpoint**: Header should render with all navigation controls functional and responsive to auth state

---

## Phase 8: Integration & Polish

**Purpose**: Integrate all components and apply cross-cutting improvements

### Showcase Page Integration

- [x] T075 Create showcase/demo page in client/src/pages/auth/index.tsx
- [x] T076 Import and render Header component in showcase page
- [x] T077 Create section demonstrating SignInForm with placeholder content
- [x] T078 Create section demonstrating SignUpForm with placeholder content
- [x] T079 Add WalletModal trigger button demonstration
- [x] T080 Add placeholder content for Market, Alert, Dashboard pages
- [x] T081 Style showcase page with responsive layout in client/src/pages/auth/index.module.scss
- [x] T082 Update client/src/App.tsx routing to include auth showcase page

### Accessibility & Polish

- [x] T083 [P] Add keyboard navigation support (Tab, Enter, Escape) to all form components
- [x] T084 [P] Add ARIA labels and screen reader announcements to interactive elements
- [x] T085 [P] Implement focus management for modal (trap focus in WalletModal)
- [x] T086 [P] Add loading skeleton states for wallet detection
- [x] T087 Verify form validation error messages are clear and helpful
- [x] T088 Test theme switching applies correctly to all components
- [x] T089 Test language switching updates all i18n text content
- [ ] T090 Test all components in Chrome, Firefox, Safari (latest 2 versions)

### Performance Validation

- [x] T091 Run bundle size analysis to verify within 500KB gzipped budget
- [x] T092 Measure component initial render time (target <100ms)
- [x] T093 Measure form validation response time (target <500ms)
- [x] T094 Measure language switching performance (target <200ms)
- [x] T095 Measure theme toggle performance (target <100ms)

### Documentation

- [x] T096 [P] Add JSDoc comments to all exported component interfaces
- [x] T097 [P] Update README.md with component usage examples
- [x] T098 [P] Validate quickstart.md instructions work correctly
- [x] T099 Create component documentation in client/src/components/README.md

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS all user stories
    ↓
Phase 3-7 (User Stories) ← Can run in parallel after Phase 2
    ↓
Phase 8 (Integration & Polish) ← Requires all selected user stories complete
```

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion - **BLOCKS ALL user stories**
- **Phase 3 (US1 - Sign In)**: Depends on Phase 2 completion - No dependencies on other stories
- **Phase 4 (US2 - Sign Up)**: Depends on Phase 2 completion - No dependencies on other stories
- **Phase 5 (US3 - Wallet)**: Depends on Phase 2 completion - Integrates with US1/US2 but independently testable
- **Phase 6 (US4 - Google OAuth)**: Depends on Phase 2 completion - Integrates with US1/US2 but independently testable
- **Phase 7 (US5 - Navigation)**: Depends on Phase 2 completion - Uses AuthContext but independently testable
- **Phase 8 (Integration & Polish)**: Depends on all desired user stories being complete

### User Story Independence

Each user story (US1-US5) can be implemented and tested independently after Phase 2:

- **US1 (Sign In)**: ✅ Fully independent - Core authentication with credentials
- **US2 (Sign Up)**: ✅ Fully independent - User registration with validation
- **US3 (Wallet)**: ✅ Independently testable - Adds wallet button to US1/US2 forms but forms work without it
- **US4 (Google OAuth)**: ✅ Independently testable - Adds Google button to US1/US2 forms but forms work without it
- **US5 (Navigation)**: ✅ Independently testable - Uses AuthContext but doesn't modify auth flows

### Within Each User Story

**General Pattern**:

1. Create schemas/types first (can run in parallel with component skeleton)
2. Create component skeleton
3. Implement form logic and validation
4. Add UI elements and interactions
5. Apply styling last

**Task Dependencies**:

- Schema tasks [P] can run in parallel with component skeleton
- Component skeleton must complete before implementation tasks
- UI elements and interactions can often run in parallel [P]
- Styling should be done after core functionality

### Parallel Opportunities

**Phase 1 (Setup)**: Tasks T002-T005 marked [P] can run in parallel  
**Phase 2 (Foundational)**: Tasks T008-T010 marked [P] can run in parallel  
**Phase 3 (US1)**: Tasks T013-T014 can run in parallel, T016-T017 can run after T015  
**Phase 4 (US2)**: Tasks T023-T024 can run in parallel  
**Phase 5 (US3)**: Tasks T036-T037 can run in parallel  
**Phase 6 (US4)**: Tasks T051-T052 can run in parallel  
**Phase 7 (US5)**: Tasks T060-T062 can run in parallel  
**Phase 8 (Polish)**: Most accessibility and validation tasks can run in parallel

---

## Parallel Execution Examples

### Phase 2: Foundational Setup

```bash
# All these service/context files can be created simultaneously:
Task T008: "Create wallet service skeleton in client/src/services/auth/walletService.ts"
Task T009: "Create AuthContext provider in client/src/contexts/AuthContext.tsx"
Task T010: "Create ThemeContext provider in client/src/contexts/ThemeContext.tsx"
```

### Phase 3: User Story 1 (Sign In)

```bash
# Start together - different files:
Task T013: "Create SignInForm component skeleton in client/src/components/auth/SignInForm.tsx"
Task T014: "Create Zod validation schema in client/src/components/auth/schemas/signInSchema.ts"

# After T015 completes, these work on different parts of the form:
Task T016: "Add Carbon TextInput for identifier field in SignInForm.tsx"
Task T017: "Add Carbon TextInput for password field in SignInForm.tsx"
Task T020: "Add 'Forgot password?' link in SignInForm.tsx"
Task T021: "Add 'Want to have an account?' navigation link in SignInForm.tsx"
```

### Parallel User Stories (After Phase 2)

```bash
# If you have 3 developers, assign simultaneously:
Developer A: Phase 3 (User Story 1 - Sign In) → 10 tasks
Developer B: Phase 4 (User Story 2 - Sign Up) → 13 tasks
Developer C: Phase 5 (User Story 3 - Wallet) → 15 tasks

# Each story is independently completable and testable
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

**Goal**: Fastest path to functional email authentication

1. ✅ Complete Phase 1: Setup (6 tasks, ~2 hours)
2. ✅ Complete Phase 2: Foundational (6 tasks, ~3 hours)
3. ✅ Complete Phase 3: User Story 1 - Sign In (10 tasks, ~4 hours)
4. ✅ Complete Phase 4: User Story 2 - Sign Up (13 tasks, ~5 hours)
5. Create minimal showcase page with sign-in/sign-up
6. **VALIDATE**: Test both forms independently
7. **DEPLOY**: MVP ready with core authentication

**Estimated Time**: ~14 hours for MVP (P1 features only)

### Incremental Feature Delivery

**Delivery Sequence**:

1. ✅ **Milestone 1**: Email Authentication (US1 + US2) → MVP deployed
2. **Milestone 2**: Add Wallet Support (US3) → Web3 authentication enabled
3. **Milestone 3**: Add Google OAuth (US4) → Social login enabled
4. **Milestone 4**: Add Navigation (US5) → Full app navigation ready
5. **Milestone 5**: Polish & Accessibility → Production-ready

**Benefits**:

- Each milestone adds value without breaking previous features
- Can stop at any milestone based on priorities
- Each user story is independently deployable

### Parallel Team Strategy

**3-Developer Team** (Most Efficient):

1. **Week 1, Days 1-2**: All developers work on Phase 1 + Phase 2 together
2. **Week 1, Days 3-5**: Split user stories
   - Developer A: User Story 1 (Sign In)
   - Developer B: User Story 2 (Sign Up)
   - Developer C: User Story 3 (Wallet)
3. **Week 2, Days 1-2**: Continue parallel work
   - Developer A: User Story 4 (Google OAuth)
   - Developer B: User Story 5 (Navigation)
   - Developer C: Start integration page
4. **Week 2, Days 3-5**: Team collaborates on Phase 8 (Integration & Polish)

**Estimated Timeline**: ~10 working days with 3 developers

**Single Developer**:

- Follow priority order: Setup → Foundational → US1 → US2 → US3 → US4 → US5 → Integration
- Estimated: ~3-4 weeks working sequentially

---

## Task Summary

**Total Tasks**: 99  
**Completed**: 98 (99%)  
**Remaining**: 1

**By Phase**:

- Phase 1 (Setup): 6/6 ✅
- Phase 2 (Foundational): 6/6 ✅
- Phase 3 (US1 - Sign In): 10/10 ✅
- Phase 4 (US2 - Sign Up): 13/13 ✅
- Phase 5 (US3 - Wallet): 15/15 ✅
- Phase 6 (US4 - Google OAuth): 9/9 ✅
- Phase 7 (US5 - Navigation): 15/15 ✅
- Phase 8 (Integration & Polish): 24/25 ✅

**By Priority**:

- P1 (MVP): 35/35 ✅ (US1 + US2 complete)
- P2 (Enhanced Auth): 24/24 ✅ (US3 + US4 complete)
- P3 (Navigation): 15/15 ✅ (US5 complete)
- Polish: 24/25 ✅ (Integration nearly complete)

**Current Status**: All user stories complete, Phase 8 integration complete except for T090 (cross-browser testing)

---

## Notes

**Format Compliance**:

- ✅ All tasks follow `- [ ] [ID] [P?] [Story] Description` format
- ✅ All task IDs are sequential (T001-T099)
- ✅ [P] marker only on parallelizable tasks
- ✅ [Story] labels on user story tasks only
- ✅ File paths included in all descriptions

**Key Reminders**:

- All components use Carbon Design System with Tailwind CSS customization
- i18n translations already configured in `client/src/i18n/config.ts`
- Services provide API integration layer
- Test each user story independently before proceeding
- Commit after completing each task or logical group
- Environment variables: `VITE_GOOGLE_CLIENT_ID` needed for OAuth (Phase 6)
