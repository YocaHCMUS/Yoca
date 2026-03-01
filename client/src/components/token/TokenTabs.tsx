import { Tabs, TabList, Tab } from "@carbon/react";
import { Launch } from "@carbon/icons-react";
import { Link } from "react-router";
import styles from "./TokenTabs.module.scss";

interface TokenTabsProps {
    activeTab: string;
    onTabChange: (tabId: string) => void;
    symbol: string;
}

const TABS = [
    { id: "overview", label: "Overview" },
    { id: "markets", label: "Markets" },
    { id: "trending", label: "Trending" },
];

export function TokenTabs({ activeTab, onTabChange, symbol }: TokenTabsProps) {
    const selectedIndex = TABS.findIndex((t) => t.id === activeTab);

    return (
        <div className={styles.container}>
            <Tabs
                selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
                onChange={({ selectedIndex: idx }) => onTabChange(TABS[idx].id)}
            >
                <TabList aria-label="Token sections" className={styles.tabList}>
                    {TABS.map((tab) => (
                        <Tab key={tab.id}>{tab.label}</Tab>
                    ))}
                    {/* Historical Data — external link, not a real tab */}
                    <Link
                        to={`/historical-data/${symbol.toLowerCase()}`}
                        className={styles.tabLink}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Historical Data <Launch size={14} className={styles.icon} />
                    </Link>
                </TabList>
            </Tabs>
        </div>
    );
}
