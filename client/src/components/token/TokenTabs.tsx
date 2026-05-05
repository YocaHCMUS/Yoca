import { useLocalization } from "@/contexts/LocalizationContext";
import { Launch } from "@carbon/icons-react";
import { Tab, TabList, Tabs } from "@carbon/react";
import { Link } from "react-router";
import styles from "./TokenTabs.module.scss";

interface TokenTabsProps {
    activeTab: string;
    onTabChange: (tabId: string) => void;
    symbol: string;
    address: string;
}

const TAB_IDS = ["overview", "markets", "news"];

export function TokenTabs({ activeTab, onTabChange, symbol, address }: TokenTabsProps) {
    const { tr } = useLocalization();
    const tabs = [
        { id: "overview", label: tr("token.tabs.overview") },
        { id: "markets", label: tr("token.tabs.markets") },
        // { id: "news", label: "News" },
    ];
    const selectedIndex = TAB_IDS.indexOf(activeTab);

    return (
        <div className={styles.container}>
            <Tabs
                selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
                onChange={({ selectedIndex: idx }) => onTabChange(TAB_IDS[idx])}
            >
                <TabList aria-label="Token sections" className={styles.tabList}>
                    {tabs.map((tab) => (
                        <Tab key={tab.id}>{tab.label}</Tab>
                    ))}
                    {/* Historical Data — external link, not a real tab */}
                    <Link
                        to={`/historical-data/${address}`}
                        className={styles.tabLink}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {tr("token.tabs.historicalData")} <Launch size={14} className={styles.icon} />
                    </Link>
                </TabList>
            </Tabs>
        </div>
    );
}
