# TabContainer Actions Integration Plan (2026-04-04)

## Objective
Update TabContainer to support optional action buttons (for example, the wallet export menu), and render the tab header row as two equal sides when actions are present:
- Left side: tab buttons
- Right side: action buttons

## Scope
- Component: `client/src/components/tabContainer/tabContainer.tsx`
- Styles: `client/src/components/tabContainer/tabContainer.module.scss`
- Wallet integration: `client/src/pages/wallet/index.tsx`

## Implementation Plan

### 1. Extend TabContainer API (backward-compatible)
- Add optional prop: `actions?: React.ReactNode`.
- Keep existing props unchanged:
  - `activeTab`
  - `names`
  - `tabs`
  - `onTabChange`
- Existing usages without `actions` must render exactly as today.

### 2. Update Tab header markup for two groups
- Inside TabContainer header row, render:
  - Left group wrapper for tab buttons.
  - Right group wrapper for `actions` (only if provided).
- Add conditional classing so layout changes only when `actions` exists.

### 3. Add equal-split layout styling
- In `tabContainer.module.scss`, add styles for action-enabled header mode:
  - Header row becomes a two-column split (`1fr 1fr`).
  - Left group aligns tabs on the left.
  - Right group aligns actions to the right.
- Keep default non-actions layout unchanged.
- Add responsive fallback for narrow widths (wrap/stack as needed without clipping).

### 4. Integrate Wallet export UI into TabContainer actions slot
- Move export menu block currently in wallet page header section into an `actions` node passed to TabContainer.
- Remove/simplify redundant wrapper around old right header content if no longer needed.
- Preserve all export behavior:
  - open/close menu
  - outside click close
  - disabled/loading states
  - localized labels

### 5. Validation and regression checks
- Confirm tab switching behavior is unchanged.
- Confirm wallet export behavior is unchanged after move.
- Confirm TabContainer still works in places where `actions` is not provided.
- Run client lint/type checks and resolve any issues caused by API/style changes.

## Acceptance Criteria
- TabContainer supports optional action content.
- With actions present, tab header row is split into two equal sides.
- Tabs render on the left side and actions on the right side.
- Wallet export controls are rendered via TabContainer actions and work as before.
- Existing non-actions TabContainer usage remains unchanged.
