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
import PageWrapper from '../../components/wrapper/PageWrapper';

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  return (
    <PageWrapper>
      <div className={styles.marketPage}>
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
    </PageWrapper>
  );
}