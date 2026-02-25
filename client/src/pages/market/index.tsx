import {
  FundamentalTab,
  FuturesTab,
  MarketTabs,
  OverviewTab,
  ProfitLossTab,
  TickerBar,
  type TabType,
} from "@/components/market";
import { PageWrapper } from "@/components/wrapper";
import { useState } from "react";
import styles from "./index.module.scss";

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  return (
    <PageWrapper>
      <div className={styles.marketPage}>
        <TickerBar />
        <main className={styles.content}>
          <MarketTabs activeTab={activeTab} onTabChange={setActiveTab}>
            {{
              overview: <OverviewTab />,
              fundamental: <FundamentalTab />,
              profitloss: <ProfitLossTab />,
              futures: <FuturesTab />,
            }}
          </MarketTabs>
        </main>
      </div>
    </PageWrapper>
  );
}
