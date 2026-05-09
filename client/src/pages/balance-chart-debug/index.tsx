import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart";

const DEBUG_WALLET_ADDRESS = "4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk";

export default function BalanceChartDebugPage() {
  return (
    <div style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <div>
        <h1 style={{ margin: 0 }}>BalanceChart V1 Debug</h1>
        <p style={{ margin: "0.5rem 0 0", color: "#666" }}>
          Fixed wallet: {DEBUG_WALLET_ADDRESS}
        </p>
      </div>

      <BalanceChart
        title="BalanceChart V1 Debug"
        minHeight={460}
        initialFilters={{ timePeriod: "7D", wallets: [DEBUG_WALLET_ADDRESS] }}
        autoRefresh={false}
      />
    </div>
  );
}
