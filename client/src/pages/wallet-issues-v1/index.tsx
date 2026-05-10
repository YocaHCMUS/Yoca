import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart";

const TEST_WALLET_ADDRESS = "3nMNd89AxwHUa1AFvQGqohRkxFEQsTsgiEyEyqXFHyyH";

export default function WalletIssuesBalanceV1Page() {
  return (
    <div style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <div>
        <h1 style={{ margin: 0 }}>Wallet Issues - Balance V1</h1>
        <p style={{ margin: "0.5rem 0 0", color: "#666" }}>
          Test wallet: {TEST_WALLET_ADDRESS}
        </p>
      </div>

      <BalanceChart
        title="BalanceChart V1"
        minHeight={460}
        initialFilters={{ timePeriod: "7D", wallets: [TEST_WALLET_ADDRESS] }}
        autoRefresh={false}
      />
    </div>
  );
}
