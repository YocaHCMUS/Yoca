import React, { useState } from 'react';
import { Header } from '../../components/navigation';
import {
  TickerBar,
  MarketTabs,
  OverviewTab,
  FundamentalTab,
  ProfitLossTab,
  FuturesTab,
  type TabType,
} from '../../components/market';
import styles from './index.module.scss';

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  return (
    <div className={styles.marketPage}>
      <Header />
      <TickerBar />
      <main className={styles.content}>
        <MarketTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {{
            overview: <OverviewTab />,
            fundamental: <FundamentalTab />,
            profitloss: <ProfitLossTab />,
            futures: <FuturesTab />,
          }}
        </MarketTabs>
      </main>
    </div>
  );
}