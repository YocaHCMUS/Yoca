import React from 'react';
import { Tabs, Tab, TabList, TabPanels, TabPanel } from '@carbon/react';
import styles from './MarketTabs.module.scss';

export type TabType = 'overview' | 'fundamental' | 'profitloss' | 'futures';

interface MarketTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: {
    overview: React.ReactNode;
    fundamental: React.ReactNode;
    profitloss: React.ReactNode;
    futures: React.ReactNode;
  };
}

export const MarketTabs: React.FC<MarketTabsProps> = ({ activeTab, onTabChange, children }) => {
  const tabs: { key: TabType; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'fundamental', label: 'FUNDAMENTAL' },
    { key: 'profitloss', label: 'PROFIT&LOSS' },
    { key: 'futures', label: 'FUTURES' },
  ];

  const selectedIndex = tabs.findIndex(tab => tab.key === activeTab);

  return (
    <div className={styles.marketTabs}>
      <Tabs
        selectedIndex={selectedIndex}
        onChange={(e) => {
          const index = e.selectedIndex;
          if (index !== undefined) {
            onTabChange(tabs[index].key);
          }
        }}
      >
        <TabList
          contained
          aria-label="Market tabs" 
          className={styles.tabList}>
          {tabs.map(tab => (
            <Tab key={tab.key}>{tab.label}</Tab>
          ))}
        </TabList>
        <TabPanels>
          <TabPanel>{children.overview}</TabPanel>
          <TabPanel>{children.fundamental}</TabPanel>
          <TabPanel>{children.profitloss}</TabPanel>
          <TabPanel>{children.futures}</TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};