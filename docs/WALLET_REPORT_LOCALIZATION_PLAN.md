# Wallet Report Localization Plan

Date: 2026-04-30

## Summary

Implement localization for the `WalletReportTemplate` component, which renders the Wallet Audit Report PDF template, and append the active language code as a suffix to the exported PDF filename.

## Goals

- Replace all hardcoded English text in the PDF report template with translation keys.
- Add corresponding translation keys to both `en.ts` and `vi.ts`.
- Ensure the exported PDF filename dynamically includes the language suffix (e.g., `_vi` or `_en`).

## Scope

Targets:
- `client/src/components/WalletReportTemplate.tsx`
- `client/src/config/localization/en.ts`
- `client/src/config/localization/vi.ts`
- `client/src/hooks/useExportReport.ts`

## Requirements

- Create a new `wallet_report` namespace in the localization JSONs.
- Use `useLocalization()` to retrieve the `tr` function and `lang` variable.
- Map the active language code to a short suffix (e.g., extracting "en" from "en-US") and inject it into the generated filename right before the `.pdf` extension.

## Implementation Plan

### 1. Generate Locale JSONs
Add a structured `wallet_report` namespace to both `en.ts` and `vi.ts` containing the required keys for the report template (e.g., `wallet_audit_report`, `export_date`, `executive_summary`, etc.).

### 2. Implement Translation Hook in Template
- **Target:** `client/src/components/WalletReportTemplate.tsx`
- Import and initialize `useLocalization` (`const { tr } = useLocalization();`).
- Refactor the component to use `tr("wallet_report.key")` for all labels instead of hardcoded strings. Helper functions like `buildMetrics` will be moved into `useMemo` so they can access the `tr` function.

### 3. Update Exported Filename
- **Target:** `client/src/hooks/useExportReport.ts`
- Import `useLocalization` to get the `lang` variable (which holds the current language code, like "en-US" or "vi-VN").
- Modify the filename generation to extract the short code and append it:
  ```typescript
  const { lang } = useLocalization();
  const langSuffix = lang.split("-")[0].toLowerCase(); // e.g. "en" or "vi"
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const filename = `${filenameBase}-${timestamp}_${langSuffix}.pdf`;
  ```

---

Please review this plan to ensure it meets your expectations. Once approved, I can proceed with the implementation.
