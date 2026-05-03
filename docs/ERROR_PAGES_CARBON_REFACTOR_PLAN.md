# Error Pages Carbon Refactor Plan

Date: 2026-04-30

## Summary

Completely redesign the `NotFoundPage` (404) and `UnauthorizedPage` (401) components. The current "Solana" themed styling (neon colors, glowing orbs, rounded corners) will be removed and replaced with a strict adherence to the **Carbon Design System** guidelines for styling (Carbon Dark Theme, Gray 100). The layout alignment will be strictly centered horizontally.

## Goals

- Remove all Solana-specific design artifacts (glowing backgrounds, giant watermarks).
- Standardize the layout to be strictly centered horizontally (`items-center`, `text-center`, `mx-auto`, `justify-center`).
- Apply Carbon Design System typography tokens and high-contrast colors.
- Enforce sharp edges (no rounded corners) on all interactive elements.
- Apply Carbon Dark Theme specific colors to backgrounds, text, buttons, and inputs.

## Scope

Targets:
- `client/src/pages/not-found/index.tsx`
- `client/src/pages/unauthorized/index.tsx`

## Requirements

1. **Remove Solana Artifacts:** 
   - Delete the glowing background orbs (e.g., `bg-[#9945FF]`, `bg-[#14F195]`, `blur-[128px]`, `mix-blend-screen`).
   - Remove the giant background watermark text.

2. **Background & Layout (Centered):**
   - Root background must use Carbon Gray 100 (`bg-[#161616]`).
   - The main content wrapper must center all content horizontally (`items-center`, `text-center`, `mx-auto`).
   - Ensure the `<div>` containing action buttons uses `justify-center` instead of `justify-start` or `items-start`.
   - Ensure headings and paragraphs inherit `text-center` alignment.
   - For the 404 page, the search `<form>` wrapper must not force left alignment and should be centered.

3. **Typography (High Contrast):**
   - **Main Title:** Retain large sizes but use Carbon primary text color (`text-[#f4f4f4]`).
   - **Subtitles/Descriptions:** Use Carbon Gray 30 (`text-[#c6c6c6]`).

4. **Buttons (Strictly Sharp):**
   - Remove ALL `rounded` classes (ensure 90-degree sharp corners).
   - **Primary Buttons** (e.g., "Search", "Go to Login"): Use Carbon Blue 60 (`bg-[#0f62fe] text-white hover:bg-[#0353e9] px-4 py-3`).
   - **Ghost/Text Buttons** (e.g., "Back to Homepage", "Go to Market"): Use `text-[#78a9ff] hover:text-[#a6c8ff] hover:bg-[#353535] px-4 py-3 transition-colors`.

5. **Search Input (404 Page):**
   - Must have sharp edges (`rounded-none`).
   - Use Carbon dark input style: `bg-[#393939] border-b border-[#8d8d8d] text-[#f4f4f4] focus:outline-none focus:border-2 focus:border-[#4589ff] px-4 py-3`.

## Implementation Plan

### 1. Refactor NotFoundPage (404)
- **Target:** `client/src/pages/not-found/index.tsx`
- Ensure the main wrappers center content: change `items-start` to `items-center` and `text-left` to `text-center`. Ensure `mx-auto` is present on the inner wrapper to center it.
- Update the `<form>` wrapper to remove any left-alignment restrictions and center the input and button.
- Ensure the buttons container uses `justify-center` or `items-center` (instead of `items-start`).
- Double-check that all headings and paragraphs align to the center.

### 2. Refactor UnauthorizedPage (401)
- **Target:** `client/src/pages/unauthorized/index.tsx`
- Ensure the main wrappers center content: change `items-start` to `items-center` and `text-left` to `text-center`. Ensure `mx-auto` is present on the inner wrapper to center it.
- Ensure the buttons container uses `justify-center` or `items-center` (instead of `items-start`).
- Double-check that all headings and paragraphs align to the center.

---

Please review this revised plan. Once approved, I will implement the changes in the target components.
