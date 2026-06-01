# Profile Settings Tab Implementation Plan (2026-04-13)

## Goal
Add Settings tab on Profile page.
Location for new UI component: profileSettingsTab.
Support actions:
- Link wallet to current provider options from auth provider enum.
- Change password or add password if account no password.
- Delete account (and unbind all linked wallets).
- Change display name and email.

## Current State Quick Read
- Profile tabs now: overview, dashboard, alerts, wallets, activity.
- Wallet linking exists in profile route + linked wallet service.
- User auth supports password, google, solana flows.
- User profile read in auth context via auth me endpoint.

## Schema Check: auth_accounts Multi Login Method Support
Verdict: mostly yes.

What works now:
- auth_accounts has user_id foreign key. One user can have many auth rows.
- Primary key is (provider, provider_user_id). Prevent same provider identity shared by many users.
- Can store many providers for one user: password + google + solana.

Gaps/risk:
- No unique constraint on (user_id, provider). Same user can accidentally get duplicate rows for same provider.
- Password identity key = email in provider_user_id. Email change must also update password auth row key.
- users.email no DB uniqueness guard. Email collision prevention now only app-level.
- login_nounce naming typo; keep for compatibility now, plan migration later.

Recommendation:
- Keep current primary key on auth_accounts(provider, provider_user_id).
- Add unique index on auth_accounts(user_id, provider).
- Add partial unique index on users(email) where email is not null.
- Keep old nonce columns now; optional later migration to login_nonce.

## Frontend Plan (profileSettingsTab)

### 1) Add Settings tab entry
Files:
- client/src/components/profile/profile.constants.ts
- client/src/pages/profile/index.tsx

Tasks:
- Add new tab id: settings.
- Add label and icon.
- Insert new tab panel node after wallets or after activity (pick fixed order, no dynamic jump).

### 2) Create settings tab component
Target location:
- client/src/components/profile/profileSettingsTab/index.tsx
- client/src/components/profile/profileSettingsTab/index.module.scss

Component sections:
- Identity section:
  - Display name input.
  - Email input.
  - Save button.
- Login methods section:
  - Show linked auth providers for account.
  - Show provider options from enumAuthProvider: password, google, github, solana, other.
  - For now, enable flows implemented by backend (password, google info view, solana link), disable unsupported with tooltip.
- Password section:
  - If password exists: old password + new password + confirm.
  - If password missing: new password + confirm + optional re-auth gate.
- Danger zone:
  - Delete account button.
  - Confirmation modal with typed phrase.

State handling:
- Loading/success/error per section, not one global spinner.
- Optimistic update only for display name/email.
- Force sign-out + redirect after account deletion.

### 3) Add profile settings API client
Files:
- client/src/services/profile/profileApi.ts
- Optional split file: client/src/services/profile/profileSettingsApi.ts

Client functions:
- getProfileSettingsSnapshot()
- updateProfileIdentity({ displayName, email })
- updatePassword({ currentPassword?, newPassword })
- createDeleteAccountChallenge()
- deleteAccount({ challengeToken, confirmText })
- getAuthMethods()

## Backend Plan (new requirements in user service)

### 1) Extend validation schemas
File:
- server/src/middlewares/validation.ts

Add schemas:
- profileIdentityUpdateSchema
- passwordUpdateSchema
- deleteAccountSchema
- providerQuery/enum schema from auth provider union

Rules:
- Email valid format, normalized lowercase trim.
- Password min length and complexity (at least current policy + one stronger rule).
- Delete confirm string exact match (example: DELETE MY ACCOUNT).

### 2) Add profile settings routes
Preferred file:
- server/src/routes/profile.ts (same auth domain, reuse jwt middleware)

New endpoints:
- GET /settings
  - Return userId, displayName, email, linked wallets, auth methods, hasPassword.
- PATCH /settings/identity
  - Update users.display_name and users.email.
  - If password provider exists and email changed: update auth_accounts.provider_user_id for provider=password.
- PATCH /settings/password
  - If password method exists: require currentPassword and verify.
  - If no password method: add password provider row.
- GET /settings/auth-methods
  - Return active providers for user.
- DELETE /settings/account
  - Verify challenge/confirm text.
  - Delete users row in transaction.
  - Rely on cascade to remove auth_accounts + user_linked_wallets + wallet_user_tags.
  - Clear auth cookie in response.

### 3) Extend user service
File:
- server/src/services/users.ts

Add functions:
- getUserById(userId)
- getUserAuthMethods(userId)
- getUserSettingsSnapshot(userId)
- updateUserIdentity(userId, { displayName, email })
- addPasswordAuthMethod(userId, email, newPassword)
- changePassword(userId, currentPassword, newPassword)
- deleteUserAccount(userId)

Important behavior:
- updateUserIdentity must run transaction:
  - update users table.
  - if password auth row exists and email changed, update provider_user_id.
- addPasswordAuthMethod must block if provider=password already exists.
- changePassword must fail when provider=password missing.
- deleteUserAccount must verify user exists then hard delete users row.

### 4) Error model updates
Files:
- server/src/config/errors.ts
- client localization files

Add codes:
- PASSWORD_AUTH_NOT_FOUND
- PASSWORD_ALREADY_SET
- CURRENT_PASSWORD_INVALID
- EMAIL_ALREADY_IN_USE
- ACCOUNT_DELETE_CONFIRM_MISMATCH
- ACCOUNT_DELETE_FORBIDDEN

## Data Model / Migration Plan

Constraint policy for auth_accounts:
- Do not replace current primary key (provider, provider_user_id).
- Add secondary uniqueness on (user_id, provider) to prevent duplicate provider method per user.

Migration 1 (safety, required):
- unique index auth_accounts_user_provider_uq on (user_id, provider).

Migration 2 (recommended):
- unique partial index users_email_uq on users(email) where email is not null.

Migration 3 (optional hardening):
- partial unique index on user_linked_wallets(user_id) where is_auth_wallet = true.

Pre-migration cleanup script:
- Detect duplicate auth rows per (user_id, provider).
- Detect duplicate non-null emails.
- Resolve before applying unique indexes.

## API Contract Draft

GET /api/profile/settings response:
- userId
- displayName
- email
- authMethods: provider[]
- hasPassword: boolean
- linkedWallets: { walletAddress, isAuthWallet }[]

PATCH /api/profile/settings/identity body:
- displayName?: string | null
- email?: string | null

PATCH /api/profile/settings/password body:
- currentPassword?: string
- newPassword: string

DELETE /api/profile/settings/account body:
- confirmText: string
- challengeToken?: string

## Security Rules
- Require active JWT for all settings endpoints.
- Rate limit password change + delete account endpoints.
- Re-auth check for sensitive ops:
  - change password (when password exists)
  - delete account
- Never return hashed password or provider_user_id in settings payload.
- Audit log account deletion and auth method changes.

## Testing Plan

Backend unit tests:
- users service: identity update, add password, change password, delete account.
- duplicate/constraint failures mapped to right error codes.

Backend integration tests:
- profile settings endpoints with jwt.
- email change updates password provider_user_id.
- account deletion cascades linked wallets and auth accounts.

Frontend tests:
- settings tab render and section visibility by auth method state.
- password add vs change form branch.
- delete flow confirm modal and post-delete sign-out.

Manual QA matrix:
- Password-only user.
- Google-only user.
- Solana-only user.
- Multi-method user (password + google + solana).

## Delivery Order
1. DB migrations + cleanup checks.
2. Backend service methods.
3. Backend profile settings endpoints.
4. Client API layer.
5. profileSettingsTab component + tab wiring.
6. Localization + error mapping.
7. Tests + QA sweep.

## Notes for This Repo
- Existing linked-wallet challenge flow already stable. Reuse for wallet auth linking UX.
- Current schema already permits multi-login rows per user. Add constraints to make it safe.
- Deleting users row gives cascade cleanup for linked wallet and auth account tables.
