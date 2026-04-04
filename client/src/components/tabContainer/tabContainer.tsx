import React from "react";
import styles from "./tabContainer.module.scss";

export type tabIndex = number;

export interface TabContainerProps {
  activeTab: tabIndex;
  names: string[];
  tabs: React.ReactNode[];
  onTabChange?: (index: tabIndex) => void;
  actions?: React.ReactNode;
}

export const TabContainer: React.FC<TabContainerProps> = ({
  activeTab,
  names,
  tabs,
  onTabChange,
  actions,
}) => {
  const hasActions = Boolean(actions);

  return (
    <div className={styles.tabContainer}>
      {/* Tab Headers */}
      <div
        className={`${styles.tabHeaders} ${hasActions ? styles.tabHeadersWithActions : ""}`.trim()}
      >
        <div className={styles.tabHeaderTabs}>
          {names.map((name, index) => (
            <button
              key={index}
              onClick={() => onTabChange?.(index)}
              className={
                activeTab === index ? styles.tabButtonActive : styles.tabButton
              }
            >
              {name}
            </button>
          ))}
        </div>
        {hasActions ? (
          <div className={styles.tabHeaderActions}>{actions}</div>
        ) : null}
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>{tabs[activeTab]}</div>
    </div>
  );
};

export default TabContainer;
