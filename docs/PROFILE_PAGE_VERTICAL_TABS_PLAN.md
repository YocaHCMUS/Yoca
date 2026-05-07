# Profile Page Layout Update Plan - Vertical Tabs

Date: April 9, 2026

## Objective
Update the profile page layout to support vertical tabs with the following changes:
- Update TabContainer component to support vertical tab orientation
- Reorganize profile page tabs to use vertical layout
- Move ProfileOverview to a new "Overview" tab
- Migrate linked wallets table from ProfileWalletTab to the Overview tab

---

## Phase 1: Update TabContainer Component

### 1.1 Add Orientation Support
**File:** `client/src/components/tabContainer/tabContainer.tsx`
- Add `orientation?: 'horizontal' | 'vertical'` prop (default: `'horizontal'`)
- Update TabContainerProps interface
- Conditionally render layout based on orientation

### 1.2 Update TabContainer Styles
**File:** `client/src/components/tabContainer/tabContainer.module.scss`

Create new class groups:
- `.tabContainer--vertical`: Switch flex-direction to `row` to place tabs on the left
- `.tabHeaders--vertical`: Change to `flex-direction: column`, `border-bottom: none`, add `border-right: 1px solid`
- `.tabContent--vertical`: Ensure proper flex layout for vertical orientation
- `.tabHeaderTabs--vertical`: Stack tabs vertically
- `.tabButton--vertical`: Adjust padding and width for vertical layout

---

## Phase 2: Restructure Profile Page Tabs

### 2.1 Create Portfolio Overview Tab
**Decision Point:** Move ProfileOverview into a dedicated tab

Recommended approach: Create new "Overview" tab that contains:
1. ProfileOverview component (moved from page header)
2. Linked wallets table (migrated from ProfileWalletTab)

### 2.2 Update ProfilePage Layout
**File:** `client/src/pages/profile/index.tsx`

Changes:
- Remove ProfileOverview from top section
- Update tab configuration to include new "Overview" tab as first tab
- Pass `orientation="vertical"` to TabContainer
- Update page layout styles if needed

### 2.3 Update ProfileWalletTab
**File:** `client/src/components/profile/ProfileWalletTab.tsx`

Changes:
- Remove linked wallets table
- Keep portfolio table, balance chart, and drawdown chart
- Rename tab display to "Wallets" or "Portfolio Analysis"

---

## Phase 3: Create New Component (Optional)

### 3.1 Create Portfolio/Overview Tab Component
**New File:** `client/src/components/profile/ProfilePortfolioTab.tsx`

Contains:
- ProfileOverview component from page header
- Linked wallets table from ProfileWalletTab

**Rationale:** Keeps code organized and separate concerns (overview/portfolio vs detailed wallet analysis)

---

## Implementation Order

1. **Update TabContainer** → Add vertical orientation support (low risk, backwards compatible)
2. **Create ProfilePortfolioTab** → Extract overview + linked wallets table
3. **Update ProfilePage** → Reorganize tab structure, pass orientation prop
4. **Update ProfileWalletTab** → Remove migrated content
5. **Test layout** → Verify responsive behavior and functionality

---

## Layout Structure After Changes

### Before
```
Horizontal Layout:
┌──────────────────────────────────────────────────┐
│ ProfileOverview Section                          │
├──────────────────────────────────────────────────┤
│ [Dashboard] [Alerts] [Wallets] [Activity]        │
├──────────────────────────────────────────────────┤
│ Tab content (full width)                         │
│                                                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### After
```
Vertical Tabs Layout:
┌──────────────┬────────────────────────────────┐
│  Overview    │ Overview Section + Linked      │
│              │ Wallets Table                  │
│  Dashboard   │                                │
│              ├────────────────────────────────┤
│  Alerts      │ Portfolio Table + Charts       │
│              │                                │
│  Wallets     ├────────────────────────────────┤
│              │ Alert Configuration Table      │
│  Activity    │                                │
│              ├────────────────────────────────┤
│              │ Activity Heatmap + Cards       │
└──────────────┴────────────────────────────────┘
```

---

## Considerations

✅ **Backwards Compatible:** Horizontal tabs remain default  
✅ **Responsive:** May need media queries to switch vertical → horizontal on mobile  
⚠️ **Period Selector:** Currently in ProfileOverview header—ensure it remains accessible in Overview tab  
⚠️ **Styling:** Vertical tab width may need adjustment; consider min-width constraints  
⚠️ **Mobile UX:** Consider switching back to horizontal tabs on small screens (< 768px)

---

## Tab Navigation Structure

### Current Tab Order
1. Dashboard
2. Alerts
3. Wallets
4. Activity

### New Tab Order
1. **Overview** (NEW) - Contains ProfileOverview + Linked Wallets Table
2. **Dashboard** - KPIs, Concentration, Risk, Anomalies
3. **Alerts** - Alert rules and management
4. **Wallets** - Portfolio table, Balance Chart, Drawdown Chart (linked wallets table removed)
5. **Activity** - Swaps/Transfers table, Activity cards, Heatmap

---

## Data Flow Changes

### ProfileOverview
- **Current:** Top-level component in ProfilePage
- **New:** Moved into ProfilePortfolioTab component

### Linked Wallets Table
- **Current:** Part of ProfileWalletTab
- **New:** Moved to ProfilePortfolioTab (Overview tab)

### Period Selector
- **Current:** In ProfileOverview header
- **Current Behavior:** Changes `period` state in ProfilePage
- **New Behavior:** Must continue to affect all tabs' data fetching
- **Implementation:** Keep period selector in ProfileOverview component, ensure it updates parent state

---

## Related Files to Review
- `client/src/hooks/profile/useProfilePageData.ts` - Ensure it handles period changes correctly
- `client/src/types/profile.ts` - Verify all data types are properly defined
- `client/src/components/profile/profile.constants.ts` - May need to update PROFILE_TABS configuration

