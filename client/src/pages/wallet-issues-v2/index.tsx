import { BalanceChartV2 } from "@/components/charts/BalanceChartV2/BalanceChartV2";

const TEST_WALLET_ADDRESS = "3nMNd89AxwHUa1AFvQGqohRkxFEQsTsgiEyEyqXFHyyH";

export default function WalletIssuesBalanceV2Page() {
  return (
    <div style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <div>
        <h1 style={{ margin: 0 }}>Wallet Issues - Balance V2</h1>
        <p style={{ margin: "0.5rem 0 0", color: "#666" }}>
          Test wallet: {TEST_WALLET_ADDRESS}
        </p>
      </div>

      <BalanceChartV2 address={TEST_WALLET_ADDRESS} />
    </div>
  );
}
