import React from 'react';
import styles from './tabContainer.module.scss';

export type tabIndex = number;

export interface TabContainerProps {
    activeTab: tabIndex;
    names: string[];
    tabs: React.ReactNode[];
    onTabChange?: (index: tabIndex) => void;
}

export const TabContainer: React.FC<TabContainerProps> = ({
    activeTab,
    names,
    tabs,
    onTabChange
}) => {
    return (
        <div className={styles.tabContainer}>
            {/* Tab Headers */}
            <div className={styles.tabHeaders}>
                {names.map((name, index) => (
                    <button
                        key={index}
                        onClick={() => onTabChange?.(index)}
                        className={activeTab === index ? styles.tabButtonActive : styles.tabButton}
                    >
                        {name}
                    </button>
                ))}
            </div>
            
            {/* Tab Content */}
            <div className={styles.tabContent}>
                {tabs[activeTab]}
            </div>
        </div>
    );
}

export default TabContainer;