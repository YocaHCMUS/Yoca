# Privacy Payment ID & Solana Env Validation Plan

Date: 2026-05-26
Last Updated: 2026-05-26

## Summary

Implement a privacy-focused Payment/Transaction ID display UI and a strict environment variable validation system for the Solana network in Vite. This improves user privacy and system robustness by preventing transactions from being constructed with invalid network parameters.

---

## 1. Privacy Payment ID UI (React/Tailwind)

### Component Objective
Create a highly polished, privacy-preserving component to display a Solana Transaction ID. The component will allow users to toggle visibility and copy the full ID securely.

### Implementation Details:
- **Default State:** Partially masked (e.g., `5aFC••••••••bbsp`).
- **Toggle Visibility:** Add an eye icon button to switch between masked and plain-text.
- **Copy Action:** Add a clipboard icon button. Clicking it MUST copy the full, unmasked ID to the clipboard, regardless of the visibility state. Include a "Copied!" visual feedback.
- **Stack:** React (`useState`), Tailwind CSS for styling, and standard web APIs (`navigator.clipboard`).

---

## 2. Environment Variable Validation (Network Switching)

### Validation Objective
Ensure `VITE_SOLANA_NETWORK` is strictly defined and valid before allowing any transaction flow to proceed.

### Implementation Details:
- **Strict Validation:** Check if `import.meta.env.VITE_SOLANA_NETWORK` is present and matches one of the valid Solana clusters (`devnet`, `testnet`, `mainnet-beta`).
- **Error Handling:** If missing or invalid, immediately throw an error that can be caught by the UI to display a toast notification (e.g., "System Error: Missing network configuration in .env").
- **Dynamic Connection:** Expose a function that utilizes the validated network to dynamically initialize the `@solana/web3.js` `Connection` instance instead of hardcoding the RPC URL.

---

## Step-by-step Execution Order

1. **Add `VITE_SOLANA_NETWORK=devnet`** (or appropriate network) to the `.env` file.
2. **Implement Validation Utility:** Create a utility function to validate the environment variable and return a dynamic `@solana/web3.js` Connection.
3. **Implement UI Component:** Create the `PrivacyTransactionId.tsx` component with Tailwind styling and clipboard functionality.
4. **Integrate and Test:** Ensure the transaction flow halts and shows a toast when the `.env` variable is tampered with, and ensure the Privacy ID UI behaves correctly.
