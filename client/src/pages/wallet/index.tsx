import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { formatNumber } from "../../util/format.ts";
import { useTranslation } from "react-i18next";
import PageWrapper from "@/components/wrapper/PageWrapper.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import { FundamentalTab } from "@/components/market/FundamentalTab.tsx";
import { OverviewTab } from "@/components/market/OverviewTab.tsx";
import { ProfitLossTab } from "@/components/market/ProfitLossTab.tsx";
import styles from "./index.module.scss";
import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart.tsx";
import TabContainer from "@/components/tabContainer/TabContainer.tsx";

export default function WalletPage() {
  const { t } = useTranslation();
  const { address } = useParams<{ address: string }>();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(0);
  const [secondaryActiveTab, setSecondaryActiveTab] = useState(0); // TODO: implement a hook to scale these state

  const headers = [
    {
      key: "token",
      header: "Token",
    },
    {
      key: "balance",
      header: "Balance",
    },
    {
      key: "valueUsd",
      header: "Value",
    },
  ];

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`/api/v0/balances/${address}`);
        const data = await response.json();
        const balances = data.map(
          (
            balance: { symbol: string; balance: string; valueUsd: string },
            index: number,
          ) => ({
            id: index,
            token: balance.symbol,
            balance: formatNumber(Number(balance.balance)),
            valueUsd: formatNumber(Number(balance.valueUsd)),
          }),
        );

        setTransfers(balances);
      } catch (error) {
        console.error("Failed to fetch transfers:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  if (!address) {
    return (
      <PageWrapper>
        <div>Address not found</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <WalletOverview walletAddress={address}/>
      {/* <main style={{ padding: "2rem", maxWidth: "1584px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "1.5rem" }}>{t("nav.wallet", "Wallet")}</h1>
        <Tble loading={loading} rows={transfers} headers={headers} />
      </main> */}

      <h1 className={styles.sectionTitle}>Activity</h1>
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={["Balance History", "Token Balance History", "Profit & Lost"]}
          tabs={
            [<BalanceChart
                height={400}
                initialTimePeriod="30D"
                autoRefresh={true}
                />,
              <BalanceChart
                height={400}
                initialTimePeriod="30D"
                autoRefresh={true} 
                />,
              <PnLChart 
                height={400}
                aggregation="daily"
                autoRefresh={true}              
                />]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
        <TabContainer
          activeTab={secondaryActiveTab}
          names={["Overview", "Transactions", "Holdings"]}
          tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
          onTabChange={(index) => setSecondaryActiveTab(index)}
        />
      </div>

      <h1 className={styles.sectionTitle}>Asset</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={["Overview", "Transactions", "Holdings"]}
          tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
        <TabContainer
          activeTab={activeTab}
          names={["Overview", "Transactions", "Holdings"]}
          tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
      </div>

      <h1 className={styles.sectionTitle}>Top exchange</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={["Overview", "Transactions", "Holdings"]}
          tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
      </div>

      <h1 className={styles.sectionTitle}>Top counterparties</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={["Overview", "Transactions", "Holdings"]}
          tabs={[<OverviewTab />, <FundamentalTab />, <ProfitLossTab />]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
      </div>
    </PageWrapper>
  );
}
