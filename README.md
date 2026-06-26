# Wallet scroll and holdings chart fix

Files in this ZIP:
- client/src/pages/wallet/index.module.scss
- client/src/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.tsx
- client/src/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.module.scss

Changes:
1. Removes the overflow clipping that prevented /wallet/:address from scrolling.
2. Replaces the static CSS allocation ring with an interactive ECharts doughnut chart for holdings.
3. Adds an allocation legend for the leading assets while keeping the existing holdings table and its layout.

Extract into the Yoca project root and replace files when prompted.
