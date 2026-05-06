# Append Language Suffix to Wallet Comparison PDF Export

**Date**: 2026-04-30

The goal is to update the PDF generation logic in the Wallet Comparison page so that the exported filename includes the current active language code as a suffix.

## User Review Required

Please review this plan to ensure it meets your expectations for the exported filename format. No breaking changes or significant risks are expected.

## Proposed Changes

### `client/src/pages/walletsComparison`

#### [MODIFY] `index.tsx`
- Extract the active language code using the `lang` property returned by the existing `useLocalization()` hook.
- Ensure the language string is cleanly formatted to lowercase.
- Update the `pdf.save` string interpolation (currently `pdf.save(\`Wallet_Comparison_${activeSegment}.pdf\`);`) to include the `_${lang.toLowerCase()}` suffix right before `.pdf`.
  - For example: `Wallet_Comparison_General_vi.pdf` or `Wallet_Comparison_Holdings_en.pdf`.

## Verification Plan

### Manual Verification
- Start the development server (`npm run dev` in `client`).
- Navigate to the Wallet Comparison page.
- Add at least one wallet.
- Select a specific language (e.g., Vietnamese or English).
- Click the "Export PDF" button.
- Verify the downloaded PDF has the correctly formatted filename with the language suffix (e.g., `Wallet_Comparison_General_vi.pdf` for Vietnamese and `Wallet_Comparison_General_en.pdf` for English).
