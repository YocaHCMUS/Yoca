# Wallet Page Layout Refactor Plan

Date: 2026-04-04

## Goal
Refine the wallet page so the layout is easier to scan, more responsive, and better aligned with the information hierarchy of the page.

## Problems To Address
- The page scroll issue is caused by wrapper/header spacing not being updated after the new market ticker component was introduced.
- The main content is currently a single long view, instead of three distinct views tied to the three tabs.
- The header chrome is too prominent and can block content instead of framing it.

## Desired Layout

### 1. Fix page spacing for the market ticker
- Review the page wrapper and header spacing rules so the added market ticker does not push the page into unintended vertical scrolling.
- Adjust padding, margin, and header height calculations at the wrapper level rather than compensating inside individual sections.
- Keep the fix centralized so future header content changes do not reintroduce the same scrolling issue.

### 2. Split the main content into 3 distinct tab views
- Make the page structure mirror the three-tab model already used by the wallet comparison page pattern.
- Each tab should own a distinct category of content, not just a different chart panel inside one continuous feed.
- Each tab should include:
  - charts ordered from most important to least important
  - related tables or data views grouped underneath the charts
- Keep each tab focused on one narrative, for example overview, holdings, and risk/activity.

### 3. Simplify the header chrome
- Make the header visually lighter and more distinct from the content below it.
- Reduce the amount of visual weight in the action area.
- Move the export or utility controls so they do not overlap the content area or create the feeling of a floating block.
- Prefer a compact action bar or an anchored utility strip rather than a large header block.

## Proposed Tab Structure

### Tab 1: Overview
- Highest-level charts first.
- Supporting tables only if they add immediate context.

### Tab 2: Holdings
- Balance and asset distribution views.
- Token-level details and ranked holdings information.
- Any supporting table should appear below the primary charts.

### Tab 3: Activity / Risk
- Swap, transfer, counterparty, exchange, and risk-oriented views.
- Sort charts and tables by analytical importance, not by implementation order.
- Place the highest-signal chart first, then supporting breakdowns.

## Implementation Phases

### Phase 1: Layout foundation
- Update the page wrapper spacing rules so the market ticker no longer creates extra scroll height.

### Phase 2: Tab-based content split
- Reorganize the page into three distinct tab views.
- Move the existing charts and tables into their appropriate tab categories.
- Add summary blocks at the top of each tab.
- Reorder content within each tab so the most important elements appear first.

### Phase 3: Header chrome cleanup
- Reduce the header's visual prominence.
- Relocate export and utility actions so they do not compete with the main content.
- Validate the header behavior with the drawer and tab layout together.

## Constraints
- Do not change the data model unless a layout requirement needs it.
- Keep the changes focused on presentation and content organization.
- Reuse existing chart and table components where possible.
- Avoid introducing a new layout pattern that conflicts with the rest of the wallet pages.

## Acceptance Criteria
- The page no longer scrolls because of stale wrapper or header spacing.
- The main content is clearly separated into three tab views with their own summaries and grouped content.
- The header chrome is lighter, less intrusive, and does not block the content below it.
